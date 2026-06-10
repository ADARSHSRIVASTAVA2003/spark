import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useSocket } from './SocketContext';
import api from '../api/client';

const CallContext = createContext(null);

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

export function CallProvider({ children }) {
  const { chatSocket } = useSocket();

  const [callState, setCallState] = useState('idle'); // idle | outgoing | incoming | connected
  const [callType, setCallType] = useState('video'); // video | audio
  const [conversationId, setConversationId] = useState(null);
  const [peer, setPeer] = useState(null); // { id, name, profile }
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [error, setError] = useState('');

  const pcRef = useRef(null);
  const pendingOfferRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const localStreamRef = useRef(null);

  const cleanup = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    pendingOfferRef.current = null;
    pendingCandidatesRef.current = [];
    setLocalStream(null);
    setRemoteStream(null);
    setCallState('idle');
    setConversationId(null);
    setPeer(null);
  }, []);

  const createPeerConnection = useCallback(
    (convId, toUserId) => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          chatSocket.emit('call:ice-candidate', { conversationId: convId, to: toUserId, candidate: e.candidate });
        }
      };

      pc.ontrack = (e) => {
        setRemoteStream(e.streams[0]);
      };

      pc.onconnectionstatechange = () => {
        if (['failed', 'closed'].includes(pc.connectionState)) {
          cleanup();
        }
      };

      pcRef.current = pc;
      return pc;
    },
    [chatSocket, cleanup]
  );

  const startCall = useCallback(
    async (convId, otherUser, type) => {
      if (!chatSocket) return;
      setError('');
      setConversationId(convId);
      setPeer(otherUser);
      setCallType(type);
      setCallState('outgoing');

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: type === 'video', audio: true });
        localStreamRef.current = stream;
        setLocalStream(stream);

        const pc = createPeerConnection(convId, otherUser.id);
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        chatSocket.emit('call:offer', { conversationId: convId, to: otherUser.id, callType: type, sdp: offer }, (ack) => {
          if (ack?.error) {
            setError(ack.error);
            cleanup();
          }
        });
      } catch (err) {
        setError('Could not access camera/microphone');
        cleanup();
      }
    },
    [chatSocket, createPeerConnection, cleanup]
  );

  const acceptCall = useCallback(async () => {
    const offer = pendingOfferRef.current;
    if (!offer || !chatSocket) return;
    setError('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: offer.callType === 'video', audio: true });
      localStreamRef.current = stream;
      setLocalStream(stream);

      const pc = createPeerConnection(offer.conversationId, offer.from);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(offer.sdp));
      for (const candidate of pendingCandidatesRef.current) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
      }
      pendingCandidatesRef.current = [];

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      chatSocket.emit('call:answer', { conversationId: offer.conversationId, to: offer.from, sdp: answer });

      pendingOfferRef.current = null;
      setCallState('connected');
    } catch (err) {
      setError('Could not access camera/microphone');
      chatSocket.emit('call:reject', { conversationId: offer.conversationId, to: offer.from, reason: 'media-error' });
      cleanup();
    }
  }, [chatSocket, createPeerConnection, cleanup]);

  const rejectCall = useCallback(() => {
    const offer = pendingOfferRef.current;
    if (offer && chatSocket) {
      chatSocket.emit('call:reject', { conversationId: offer.conversationId, to: offer.from, reason: 'declined' });
    }
    cleanup();
  }, [chatSocket, cleanup]);

  const endCall = useCallback(() => {
    if (chatSocket && conversationId && peer) {
      chatSocket.emit('call:end', { conversationId, to: peer.id });
    }
    cleanup();
  }, [chatSocket, conversationId, peer, cleanup]);

  const toggleMute = useCallback((muted) => {
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !muted;
    });
  }, []);

  const toggleVideo = useCallback((off) => {
    localStreamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = !off;
    });
  }, []);

  useEffect(() => {
    if (!chatSocket) return undefined;

    async function onOffer({ conversationId: convId, from, callType: type, sdp }) {
      if (callState !== 'idle') {
        chatSocket.emit('call:reject', { conversationId: convId, to: from, reason: 'busy' });
        return;
      }
      pendingOfferRef.current = { conversationId: convId, from, callType: type, sdp };
      setConversationId(convId);
      setCallType(type);
      setCallState('incoming');

      try {
        const { data } = await api.get(`/users/profile/${from}`);
        setPeer({ id: from, name: data.user.name, profile: data.user.profile });
      } catch {
        setPeer({ id: from, name: 'Someone', profile: {} });
      }
    }

    async function onAnswer({ from, sdp }) {
      const pc = pcRef.current;
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      for (const candidate of pendingCandidatesRef.current) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
      }
      pendingCandidatesRef.current = [];
      setCallState('connected');
    }

    async function onIceCandidate({ candidate }) {
      const pc = pcRef.current;
      if (pc && pc.remoteDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
      } else {
        pendingCandidatesRef.current.push(candidate);
      }
    }

    function onReject() {
      cleanup();
    }

    function onEnd() {
      cleanup();
    }

    chatSocket.on('call:offer', onOffer);
    chatSocket.on('call:answer', onAnswer);
    chatSocket.on('call:ice-candidate', onIceCandidate);
    chatSocket.on('call:reject', onReject);
    chatSocket.on('call:end', onEnd);

    return () => {
      chatSocket.off('call:offer', onOffer);
      chatSocket.off('call:answer', onAnswer);
      chatSocket.off('call:ice-candidate', onIceCandidate);
      chatSocket.off('call:reject', onReject);
      chatSocket.off('call:end', onEnd);
    };
  }, [chatSocket, callState, cleanup]);

  return (
    <CallContext.Provider
      value={{
        callState,
        callType,
        peer,
        localStream,
        remoteStream,
        error,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleVideo,
      }}
    >
      {children}
    </CallContext.Provider>
  );
}

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used within CallProvider');
  return ctx;
}
