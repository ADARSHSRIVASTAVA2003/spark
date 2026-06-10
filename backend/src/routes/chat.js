const express = require('express');
const { body, param, query } = require('express-validator');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Match = require('../models/Match');
const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

const PAGE_SIZE = 30;

async function requireParticipant(conversationId, userId) {
  return Conversation.findOne({ _id: conversationId, participants: userId });
}

router.get('/conversations', requireAuth, async (req, res, next) => {
  try {
    const conversations = await Conversation.find({ participants: req.user.id })
      .populate('participants', 'name profile.mainPhoto status.isOnline status.lastSeen')
      .sort({ updatedAt: -1 });

    const result = conversations.map((c) => ({
      id: c._id,
      type: c.type,
      name: c.name,
      participants: c.participants.filter((p) => p._id.toString() !== req.user.id),
      lastMessage: c.lastMessage,
      unreadCount: c.unreadCount.get(req.user.id) || 0,
      updatedAt: c.updatedAt,
    }));

    res.json({ conversations: result });
  } catch (err) {
    next(err);
  }
});

router.get(
  '/conversations/:id',
  requireAuth,
  [param('id').isMongoId()],
  validate,
  async (req, res, next) => {
    try {
      const conversation = await Conversation.findOne({ _id: req.params.id, participants: req.user.id })
        .populate('participants', 'name profile.mainPhoto status.isOnline status.lastSeen');
      if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

      if (conversation.type === 'room') {
        return res.json({
          conversation: {
            id: conversation._id,
            type: conversation.type,
            name: conversation.name,
            createdBy: conversation.createdBy,
            participants: conversation.participants,
          },
        });
      }

      const otherUser = conversation.participants.find((p) => p._id.toString() !== req.user.id);

      res.json({ conversation: { id: conversation._id, type: conversation.type, otherUser } });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/rooms',
  requireAuth,
  [
    body('name').isString().trim().isLength({ min: 1, max: 50 }),
    body('participantIds').isArray({ min: 1, max: 19 }),
    body('participantIds.*').isMongoId(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { name, participantIds } = req.body;
      const uniqueIds = [...new Set(participantIds.map(String))].filter((id) => id !== req.user.id);

      if (uniqueIds.length === 0) {
        return res.status(400).json({ error: 'Select at least one match to add' });
      }

      const matches = await Match.find({ users: req.user.id, status: 'matched' });
      const matchedUserIds = new Set();
      matches.forEach((m) => {
        m.users.forEach((u) => {
          const uid = u.toString();
          if (uid !== req.user.id) matchedUserIds.add(uid);
        });
      });

      const invalid = uniqueIds.some((id) => !matchedUserIds.has(id));
      if (invalid) {
        return res.status(400).json({ error: 'You can only add your matches to a group' });
      }

      const conversation = await Conversation.create({
        type: 'room',
        name,
        createdBy: req.user.id,
        participants: [req.user.id, ...uniqueIds],
      });

      res.status(201).json({ conversation: { id: conversation._id, type: 'room', name: conversation.name } });
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/rooms/:id/leave',
  requireAuth,
  [param('id').isMongoId()],
  validate,
  async (req, res, next) => {
    try {
      const conversation = await Conversation.findOne({
        _id: req.params.id,
        type: 'room',
        participants: req.user.id,
      });
      if (!conversation) return res.status(404).json({ error: 'Room not found' });

      conversation.participants = conversation.participants.filter((p) => p.toString() !== req.user.id);
      conversation.unreadCount.delete(req.user.id);

      if (conversation.participants.length === 0) {
        await Message.deleteMany({ conversationId: conversation._id });
        await conversation.deleteOne();
      } else {
        await conversation.save();
      }

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/conversations/:id/read',
  requireAuth,
  [param('id').isMongoId()],
  validate,
  async (req, res, next) => {
    try {
      const conversation = await requireParticipant(req.params.id, req.user.id);
      if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

      conversation.unreadCount.set(req.user.id, 0);
      await conversation.save();

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/messages/:convId',
  requireAuth,
  [param('convId').isMongoId(), query('before').optional().isISO8601()],
  validate,
  async (req, res, next) => {
    try {
      const conversation = await requireParticipant(req.params.convId, req.user.id);
      if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

      const filter = { conversationId: req.params.convId };
      if (req.query.before) {
        filter.createdAt = { $lt: new Date(req.query.before) };
      }

      const messages = await Message.find(filter)
        .sort({ createdAt: -1 })
        .limit(PAGE_SIZE);

      const nextCursor = messages.length === PAGE_SIZE ? messages[messages.length - 1].createdAt : null;

      res.json({ messages: messages.reverse(), nextCursor });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/messages',
  requireAuth,
  [
    body('conversationId').isMongoId(),
    body('type').optional().isIn(['text', 'image', 'emoji']),
    body('content').optional().isString().isLength({ max: 5000 }),
    body('mediaUrl').optional().isString().isLength({ max: 2048 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { conversationId, content = '', mediaUrl = '' } = req.body;
      const type = req.body.type || (mediaUrl ? 'image' : 'text');

      if (!content && !mediaUrl) {
        return res.status(400).json({ error: 'Message must have content or mediaUrl' });
      }

      const conversation = await requireParticipant(conversationId, req.user.id);
      if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

      const otherParticipants = conversation.participants.filter((p) => p.toString() !== req.user.id);
      const receiverId = conversation.type === 'direct' ? otherParticipants[0] : undefined;

      const message = await Message.create({
        conversationId,
        senderId: req.user.id,
        receiverId,
        type,
        content,
        mediaUrl,
        status: 'sent',
      });

      conversation.lastMessage = { content: content || '[image]', senderId: req.user.id, sentAt: message.createdAt };
      otherParticipants.forEach((p) => {
        const pid = p.toString();
        const currentUnread = conversation.unreadCount.get(pid) || 0;
        conversation.unreadCount.set(pid, currentUnread + 1);
      });
      await conversation.save();

      const io = req.app.get('io');
      if (io) {
        io.of('/chat').to(`conv:${conversationId}`).emit('message:new', message);
        otherParticipants.forEach((p) => {
          io.to(`user:${p.toString()}`).emit('message:notify', { conversationId, message });
        });
      }

      res.status(201).json({ message });
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/messages/:id/read',
  requireAuth,
  [param('id').isMongoId()],
  validate,
  async (req, res, next) => {
    try {
      const message = await Message.findById(req.params.id);
      if (!message) return res.status(404).json({ error: 'Message not found' });

      if (!message.receiverId || message.receiverId.toString() !== req.user.id) {
        return res.status(403).json({ error: 'Only the recipient can mark a message as read' });
      }

      message.status = 'read';
      message.readAt = new Date();
      await message.save();

      await Conversation.findByIdAndUpdate(message.conversationId, {
        $set: { [`unreadCount.${req.user.id}`]: 0 },
      });

      const io = req.app.get('io');
      if (io) {
        io.of('/chat').to(`conv:${message.conversationId}`).emit('message:read', {
          messageId: message._id,
          conversationId: message.conversationId,
          readAt: message.readAt,
          readBy: req.user.id,
        });
      }

      res.json({ message });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
