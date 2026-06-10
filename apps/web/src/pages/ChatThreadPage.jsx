import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useCall } from '../context/CallContext';

export default function ChatThreadPage() {
  const { convId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { chatSocket } = useSocket();
  const { startCall, callState } = useCall();

  const [messages, setMessages] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [text, setText] = useState('');
  const [otherTyping, setOtherTyping] = useState(false);
  const [conversation, setConversation] = useState(null);
  const [error, setError] = useState('');

  const bottomRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const isRoom = conversation?.type === 'room';
  const otherUser = conversation?.otherUser;

  const memberNames = useMemo(() => {
    const map = new Map();
    if (isRoom) {
      conversation.participants.forEach((p) => map.set(p._id, p.name));
    }
    return map;
  }, [isRoom, conversation]);

  const markRead = useCallback((msg) => {
    if (isRoom) {
      api.put(`/chat/conversations/${convId}/read`).catch(() => {});
      return;
    }
    if (msg.receiverId === user.id && msg.status !== 'read') {
      api.put(`/chat/messages/${msg._id}/read`).catch(() => {});
    }
  }, [user.id, isRoom, convId]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await api.get(`/chat/messages/${convId}`);
        if (!active) return;
        setMessages(data.messages);
        setNextCursor(data.nextCursor);
        if (isRoom) {
          if (data.messages.length > 0) markRead();
        } else {
          data.messages.forEach(markRead);
        }
      } catch (err) {
        if (active) setError(err.response?.data?.error || 'Could not load messages');
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convId, isRoom]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await api.get(`/chat/conversations/${convId}`);
        if (active) setConversation(data.conversation);
      } catch {
        // ignore
      }
    })();
    return () => {
      active = false;
    };
  }, [convId]);

  useEffect(() => {
    if (!chatSocket) return undefined;

    chatSocket.emit('conversation:join', convId);

    function onNewMessage(msg) {
      if (msg.conversationId !== convId) return;
      setMessages((prev) => [...prev, msg]);
      markRead(msg);
    }

    function onRead({ messageId }) {
      setMessages((prev) => prev.map((m) => (m._id === messageId ? { ...m, status: 'read' } : m)));
    }

    function onTyping({ conversationId, userId }) {
      if (conversationId === convId && userId !== user.id) {
        setOtherTyping(true);
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setOtherTyping(false), 3500);
      }
    }

    function onTypingStop({ conversationId, userId }) {
      if (conversationId === convId && userId !== user.id) setOtherTyping(false);
    }

    chatSocket.on('message:new', onNewMessage);
    chatSocket.on('message:read', onRead);
    chatSocket.on('typing', onTyping);
    chatSocket.on('typing:stop', onTypingStop);

    return () => {
      chatSocket.emit('conversation:leave', convId);
      chatSocket.off('message:new', onNewMessage);
      chatSocket.off('message:read', onRead);
      chatSocket.off('typing', onTyping);
      chatSocket.off('typing:stop', onTypingStop);
      clearTimeout(typingTimeoutRef.current);
    };
  }, [chatSocket, convId, user.id, markRead]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadOlder() {
    if (!nextCursor) return;
    const { data } = await api.get(`/chat/messages/${convId}`, { params: { before: nextCursor } });
    setMessages((prev) => [...data.messages, ...prev]);
    setNextCursor(data.nextCursor);
  }

  const typingDebounce = useRef(null);
  function handleChange(e) {
    setText(e.target.value);
    if (!chatSocket) return;
    clearTimeout(typingDebounce.current);
    typingDebounce.current = setTimeout(() => {
      chatSocket.emit('typing', { conversationId: convId });
    }, 300);
  }

  async function sendMessage(e) {
    e.preventDefault();
    const content = text.trim();
    if (!content) return;
    setText('');
    try {
      await api.post('/chat/messages', { conversationId: convId, content });
    } catch (err) {
      setError(err.response?.data?.error || 'Could not send message');
    }
  }

  async function leaveRoom() {
    try {
      await api.delete(`/chat/rooms/${convId}/leave`);
      navigate('/chat');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not leave group');
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-gray-800 px-4 py-3">
        <Link to="/chat" className="text-gray-400">
          ←
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold">
            {isRoom ? `👥 ${conversation?.name}` : otherUser?.name || 'Chat'}
          </h1>
          {isRoom && (
            <p className="truncate text-xs text-gray-500">{conversation.participants.length} members</p>
          )}
        </div>
        {otherTyping && <span className="text-xs text-pink-400">typing...</span>}
        {isRoom && (
          <button onClick={leaveRoom} className="rounded-full border border-gray-700 px-3 py-1 text-xs text-gray-400">
            Leave
          </button>
        )}
        {otherUser && (
          <div className="flex gap-2">
            <button
              onClick={() => startCall(convId, otherUser, 'audio')}
              disabled={callState !== 'idle'}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-800 text-lg disabled:opacity-50"
              title="Voice call"
            >
              📞
            </button>
            <button
              onClick={() => startCall(convId, otherUser, 'video')}
              disabled={callState !== 'idle'}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-800 text-lg disabled:opacity-50"
              title="Video call"
            >
              🎥
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {nextCursor && (
          <button onClick={loadOlder} className="mx-auto block text-xs text-gray-500 underline">
            Load older messages
          </button>
        )}
        {error && <p className="text-center text-sm text-red-400">{error}</p>}
        {messages.map((m) => {
          const mine = m.senderId === user.id;
          return (
            <div key={m._id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                  mine ? 'bg-pink-500 text-white' : 'bg-gray-800 text-gray-100'
                }`}
              >
                {isRoom && !mine && (
                  <p className="mb-0.5 text-xs font-semibold text-pink-300">
                    {memberNames.get(m.senderId) || 'Member'}
                  </p>
                )}
                {m.type === 'image' && m.mediaUrl ? (
                  <img src={m.mediaUrl} alt="shared" className="mb-1 max-w-full rounded-lg" />
                ) : null}
                {m.content && <p>{m.content}</p>}
                {mine && !isRoom && (
                  <p className="mt-1 text-right text-[10px] opacity-70">
                    {m.status === 'read' ? 'Read' : m.status === 'delivered' ? 'Delivered' : 'Sent'}
                  </p>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={sendMessage} className="flex gap-2 border-t border-gray-800 p-3">
        <input
          value={text}
          onChange={handleChange}
          placeholder="Type a message..."
          className="flex-1 rounded-full border border-gray-700 bg-gray-900 px-4 py-2 text-sm focus:border-pink-400 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-full bg-pink-500 px-4 py-2 text-sm font-semibold text-white"
        >
          Send
        </button>
      </form>
    </div>
  );
}
