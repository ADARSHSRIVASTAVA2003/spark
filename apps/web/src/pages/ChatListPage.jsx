import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useSocket } from '../context/SocketContext';

export default function ChatListPage() {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { socket } = useSocket();

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await api.get('/chat/conversations');
        if (active) setConversations(data.conversations);
      } catch (err) {
        if (active) setError(err.response?.data?.error || 'Could not load conversations');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Refresh the list when a new match or message arrives
  useEffect(() => {
    if (!socket) return undefined;
    const refresh = () => {
      api.get('/chat/conversations').then(({ data }) => setConversations(data.conversations));
    };
    socket.on('new_match', refresh);
    socket.on('message:notify', refresh);
    return () => {
      socket.off('new_match', refresh);
      socket.off('message:notify', refresh);
    };
  }, [socket]);

  return (
    <div className="px-4 pt-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-violet-600">Messages</h1>
        <Link to="/chat/new-group" className="rounded-full border border-gray-300 px-3 py-1 text-xs">
          + New group
        </Link>
      </div>

      {loading && <p className="text-center text-gray-500">Loading...</p>}
      {error && <p className="text-center text-red-500">{error}</p>}
      {!loading && conversations.length === 0 && (
        <p className="text-center text-gray-500">No conversations yet. Match with someone first!</p>
      )}

      <div className="space-y-2 pb-4">
        {conversations.map((c) => {
          const isRoom = c.type === 'room';
          const other = c.participants[0];
          const title = isRoom ? c.name : other?.name;
          const photo = isRoom ? null : other?.profile?.mainPhoto;
          return (
            <Link
              key={c.id}
              to={`/chat/${c.id}`}
              className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-xl">
                {photo ? <img src={photo} alt={title} className="h-full w-full object-cover" /> : isRoom ? '👥' : '🧑'}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-semibold">{title}</p>
                <p className="truncate text-xs text-gray-500">{c.lastMessage?.content || 'Say hi!'}</p>
              </div>
              {c.unreadCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-500 px-1.5 text-xs font-semibold text-white">
                  {c.unreadCount}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
