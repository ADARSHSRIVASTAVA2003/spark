const fs = require('fs/promises');
const path = require('path');
const express = require('express');
const sharp = require('sharp');
const { body, param } = require('express-validator');
const User = require('../models/User');
const Like = require('../models/Like');
const Match = require('../models/Match');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const upload = require('../middleware/upload');

const router = express.Router();

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads', 'photos');

function uploadPhoto(req, res, next) {
  upload.single('photo')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

router.get(
  '/profile/:id',
  [param('id').isMongoId()],
  validate,
  async (req, res, next) => {
    try {
      const user = await User.findById(req.params.id);
      if (!user || !user.status.isActive) return res.status(404).json({ error: 'User not found' });
      res.json({ user: user.toPublicProfile() });
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/profile',
  requireAuth,
  [
    body('bio').optional().isLength({ max: 500 }),
    body('interests').optional().isArray(),
    body('interests.*').optional().isString().trim(),
    body('photos').optional().isArray({ max: 9 }),
    body('photos.*').optional().isString(),
    body('mainPhoto').optional().isString(),
    body('lookingFor').optional().isArray({ min: 1 }),
    body('lookingFor.*').optional().isIn(['male', 'female', 'nonbinary', 'other']),
    body('age').optional().isInt({ min: 18, max: 120 }),
    body('gender').optional().isIn(['male', 'female', 'nonbinary', 'other']),
    body('orientation').optional().isIn(['straight', 'gay', 'lesbian', 'bisexual', 'other']),
  ],
  validate,
  async (req, res, next) => {
    try {
      const allowed = ['bio', 'interests', 'photos', 'mainPhoto', 'lookingFor', 'age', 'gender', 'orientation'];
      const update = {};
      for (const field of allowed) {
        if (req.body[field] !== undefined) update[`profile.${field}`] = req.body[field];
      }

      const user = await User.findByIdAndUpdate(
        req.user.id,
        { $set: update },
        { new: true, runValidators: true }
      );
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json({ user });
    } catch (err) {
      next(err);
    }
  }
);

router.post('/photo', requireAuth, uploadPhoto, async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image file provided' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.profile.photos.length >= 9) {
      return res.status(400).json({ error: 'Maximum of 9 photos allowed' });
    }

    const filename = `${user._id}-${Date.now()}.jpg`;
    await sharp(req.file.buffer)
      .rotate()
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toFile(path.join(UPLOADS_DIR, filename));

    const url = `/uploads/photos/${filename}`;
    user.profile.photos.push(url);
    if (!user.profile.mainPhoto) user.profile.mainPhoto = url;
    await user.save();

    res.status(201).json({ photos: user.profile.photos, mainPhoto: user.profile.mainPhoto });
  } catch (err) {
    next(err);
  }
});

router.delete(
  '/photo',
  requireAuth,
  [body('url').isString().isLength({ min: 1, max: 2048 })],
  validate,
  async (req, res, next) => {
    try {
      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ error: 'User not found' });

      const { url } = req.body;
      if (!user.profile.photos.includes(url)) {
        return res.status(404).json({ error: 'Photo not found' });
      }

      user.profile.photos = user.profile.photos.filter((p) => p !== url);
      if (user.profile.mainPhoto === url) {
        user.profile.mainPhoto = user.profile.photos[0] || '';
      }
      await user.save();

      if (url.startsWith('/uploads/photos/')) {
        await fs.unlink(path.join(UPLOADS_DIR, path.basename(url))).catch(() => {});
      }

      res.json({ photos: user.profile.photos, mainPhoto: user.profile.mainPhoto });
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/photo/main',
  requireAuth,
  [body('url').isString().isLength({ min: 1, max: 2048 })],
  validate,
  async (req, res, next) => {
    try {
      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ error: 'User not found' });

      if (!user.profile.photos.includes(req.body.url)) {
        return res.status(400).json({ error: 'Photo not in profile' });
      }

      user.profile.mainPhoto = req.body.url;
      await user.save();
      res.json({ mainPhoto: user.profile.mainPhoto });
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/settings',
  requireAuth,
  [
    body('maxDistance').optional().isInt({ min: 1, max: 500 }),
    body('ageRange.min').optional().isInt({ min: 18, max: 120 }),
    body('ageRange.max').optional().isInt({ min: 18, max: 120 }),
    body('showOnline').optional().isBoolean(),
    body('notifications').optional().isBoolean(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const update = {};
      if (req.body.maxDistance !== undefined) update['settings.maxDistance'] = req.body.maxDistance;
      if (req.body.ageRange?.min !== undefined) update['settings.ageRange.min'] = req.body.ageRange.min;
      if (req.body.ageRange?.max !== undefined) update['settings.ageRange.max'] = req.body.ageRange.max;
      if (req.body.showOnline !== undefined) update['settings.showOnline'] = req.body.showOnline;
      if (req.body.notifications !== undefined) update['settings.notifications'] = req.body.notifications;

      const user = await User.findByIdAndUpdate(
        req.user.id,
        { $set: update },
        { new: true, runValidators: true }
      );
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json({ settings: user.settings });
    } catch (err) {
      next(err);
    }
  }
);

// GDPR delete: remove user document and all related data
router.delete('/account', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const conversations = await Conversation.find({ participants: userId }).select('_id');
    const conversationIds = conversations.map((c) => c._id);

    await Promise.all([
      Message.deleteMany({ conversationId: { $in: conversationIds } }),
      Conversation.deleteMany({ participants: userId }),
      Match.deleteMany({ users: userId }),
      Like.deleteMany({ $or: [{ fromUser: userId }, { toUser: userId }] }),
      User.findByIdAndDelete(userId),
    ]);

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
