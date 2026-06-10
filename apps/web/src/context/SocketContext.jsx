import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { token, user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [chatSocket, setChatSocket] = useState(null);

  useEffect(() => {
    if (!token || !user) {
      setSocket(null);
      setChatSocket(null);
      return undefined;
    }

    const base = io({ auth: { token } });
    const chat = io('/chat', { auth: { token } });

    setSocket(base);
    setChatSocket(chat);

    return () => {
      base.disconnect();
      chat.disconnect();
    };
  }, [token, user]);

  return <SocketContext.Provider value={{ socket, chatSocket }}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within SocketProvider');
  return ctx;
}
