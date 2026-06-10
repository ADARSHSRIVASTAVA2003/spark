const { Server } = require('socket.io');
const { verifyAccessToken } = require('../utils/tokens');
const User = require('../models/User');
const Conversation = require('../models/Conversation');

const TYPING_TIMEOUT_MS = 3000;

function authMiddleware(socket, next) {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) return next(new Error('Authentication required'));

  try {
    const payload = verifyAccessToken(token);
    socket.userId = payload.sub;
    next();
  } catch (err) {
    next(new Error('Invalid or expired token'));
  }
}

function initSocket(server, corsOrigins) {
  const io = new Server(server, {
    cors: { origin: corsOrigins, credentials: true },
  });

  io.use(authMiddleware);

  io.on('connection', (socket) => {
    socket.join(`user:${socket.userId}`);
    User.findByIdAndUpdate(socket.userId, {
      'status.isOnline': true,
      'status.lastSeen': new Date(),
    }).catch(() => {});
    socket.broadcast.emit('user:online', { userId: socket.userId });

    socket.on('disconnect', () => {
      User.findByIdAndUpdate(socket.userId, {
        'status.isOnline': false,
        'status.lastSeen': new Date(),
      }).catch(() => {});
      socket.broadcast.emit('user:offline', { userId: socket.userId, lastSeen: new Date() });
    });
  });

  const chat = io.of('/chat');
  chat.use(authMiddleware);

  chat.on('connection', (socket) => {
    socket.join(`user:${socket.userId}`);
    const typingTimers = new Map();

    socket.on('conversation:join', async (conversationId, cb) => {
      try {
        const conv = await Conversation.findOne({
          _id: conversationId,
          participants: socket.userId,
        });
        if (!conv) return cb?.({ error: 'Not a participant of this conversation' });
        socket.join(`conv:${conversationId}`);
        cb?.({ success: true });
      } catch (err) {
        cb?.({ error: 'Invalid conversation id' });
      }
    });

    socket.on('conversation:leave', (conversationId) => {
      socket.leave(`conv:${conversationId}`);
    });

    // Typing indicator: debounce on the client (500ms), auto-clear after 3s of inactivity
    socket.on('typing', ({ conversationId }) => {
      if (!conversationId) return;
      socket.to(`conv:${conversationId}`).emit('typing', { conversationId, userId: socket.userId });

      clearTimeout(typingTimers.get(conversationId));
      typingTimers.set(
        conversationId,
        setTimeout(() => {
          socket.to(`conv:${conversationId}`).emit('typing:stop', { conversationId, userId: socket.userId });
        }, TYPING_TIMEOUT_MS)
      );
    });

    socket.on('disconnect', () => {
      typingTimers.forEach((timer) => clearTimeout(timer));
      typingTimers.clear();
    });

    // --- WebRTC call signaling (relay only; conversation membership is checked on offer) ---

    socket.on('call:offer', async ({ conversationId, to, callType, sdp }, cb) => {
      try {
        const conv = await Conversation.findOne({ _id: conversationId, participants: socket.userId });
        if (!conv || !conv.participants.some((p) => p.toString() === to)) {
          return cb?.({ error: 'Not a participant of this conversation' });
        }
        chat.to(`user:${to}`).emit('call:offer', { conversationId, from: socket.userId, callType, sdp });
        cb?.({ success: true });
      } catch (err) {
        cb?.({ error: 'Could not start call' });
      }
    });

    socket.on('call:answer', ({ conversationId, to, sdp }) => {
      chat.to(`user:${to}`).emit('call:answer', { conversationId, from: socket.userId, sdp });
    });

    socket.on('call:ice-candidate', ({ conversationId, to, candidate }) => {
      chat.to(`user:${to}`).emit('call:ice-candidate', { conversationId, from: socket.userId, candidate });
    });

    socket.on('call:reject', ({ conversationId, to, reason }) => {
      chat.to(`user:${to}`).emit('call:reject', { conversationId, from: socket.userId, reason });
    });

    socket.on('call:end', ({ conversationId, to }) => {
      chat.to(`user:${to}`).emit('call:end', { conversationId, from: socket.userId });
    });
  });

  return io;
}

module.exports = initSocket;
