const express = require('express');
const mongoose = require('mongoose');
const { body, query } = require('express-validator');
const User = require('../models/User');
const Like = require('../models/Like');
const Match = require('../models/Match');
const Conversation = require('../models/Conversation');
const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { roundCoord } = require('../utils/geo');

const router = express.Router();

async function recordSwipe(req, res, type) {
  const fromUser = req.user.id;
  const { userId: toUser } = req.body;

  if (fromUser === toUser) {
    return res.status(400).json({ error: 'Cannot like/pass your own profile' });
  }

  const like = await Like.findOneAndUpdate(
    { fromUser, toUser },
    { type },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  let match = null;
  let conversationId = null;
  if (type === 'like' || type === 'superlike') {
    const reciprocal = await Like.findOne({
      fromUser: toUser,
      toUser: fromUser,
      type: { $in: ['like', 'superlike'] },
    });

    if (reciprocal) {
      const sortedUsers = [fromUser, toUser].sort();
      match = await Match.findOne({ users: { $all: sortedUsers, $size: 2 } });
      if (match) {
        match.status = 'matched';
        match.likedBy = fromUser;
        match.likedAt = like.createdAt;
        match.matchedAt = new Date();
        await match.save();
      } else {
        match = await Match.create({
          users: sortedUsers,
          status: 'matched',
          likedBy: fromUser,
          likedAt: like.createdAt,
          matchedAt: new Date(),
        });
      }

      let conversation = await Conversation.findOne({
        type: 'direct',
        participants: { $all: sortedUsers, $size: 2 },
      });
      if (!conversation) {
        conversation = await Conversation.create({
          type: 'direct',
          participants: sortedUsers,
          matchId: match._id,
        });
      }
      conversationId = conversation._id;

      const io = req.app.get('io');
      if (io) {
        io.to(`user:${fromUser}`).to(`user:${toUser}`).emit('new_match', {
          matchId: match._id,
          conversationId: conversation._id,
          users: sortedUsers,
        });
      }
    }
  }

  res.status(201).json({ like, match, conversationId });
}

router.post(
  '/like',
  requireAuth,
  [body('userId').isMongoId(), body('superlike').optional().isBoolean()],
  validate,
  (req, res, next) => recordSwipe(req, res, req.body.superlike ? 'superlike' : 'like').catch(next)
);

router.post(
  '/pass',
  requireAuth,
  [body('userId').isMongoId()],
  validate,
  (req, res, next) => recordSwipe(req, res, 'pass').catch(next)
);

// Return candidate profiles matching the user's preferences, excluding seen/blocked users
router.get(
  '/feed',
  requireAuth,
  [query('limit').optional().isInt({ min: 1, max: 50 })],
  validate,
  async (req, res, next) => {
    try {
      const me = await User.findById(req.user.id);
      if (!me) return res.status(404).json({ error: 'User not found' });

      const limit = req.query.limit ? Number(req.query.limit) : 20;

      const seen = await Like.find({ fromUser: me._id }).select('toUser');
      const excludedIds = new Set([
        me._id.toString(),
        ...seen.map((l) => l.toUser.toString()),
        ...(me.blockedUsers || []).map((id) => id.toString()),
      ]);
      const blockedByOthers = await User.find({ blockedUsers: me._id }).select('_id');
      blockedByOthers.forEach((u) => excludedIds.add(u._id.toString()));

      const lookingFor = me.profile.lookingFor?.length ? me.profile.lookingFor : undefined;

      const filter = {
        _id: { $nin: [...excludedIds].map((id) => new mongoose.Types.ObjectId(id)) },
        'status.isActive': true,
        'status.isBanned': false,
        'profile.age': { $gte: me.settings.ageRange.min, $lte: me.settings.ageRange.max },
        ...(lookingFor ? { 'profile.gender': { $in: lookingFor } } : {}),
      };

      const [lng, lat] = me.location.coordinates;
      const hasLocation = !(lng === 0 && lat === 0);

      let candidates;
      if (hasLocation) {
        candidates = await User.aggregate([
          {
            $geoNear: {
              near: { type: 'Point', coordinates: [lng, lat] },
              distanceField: 'distanceMeters',
              maxDistance: me.settings.maxDistance * 1000,
              spherical: true,
              query: filter,
            },
          },
          { $limit: limit },
        ]);
      } else {
        candidates = await User.find(filter).limit(limit).lean();
      }

      const myInterests = new Set((me.profile.interests || []).map((i) => i.toLowerCase()));

      const feed = candidates
        .map((u) => {
          const theirInterests = new Set((u.profile?.interests || []).map((i) => i.toLowerCase()));
          const union = new Set([...myInterests, ...theirInterests]);
          const intersection = [...myInterests].filter((i) => theirInterests.has(i));
          const jaccard = union.size ? intersection.length / union.size : 0;

          return {
            id: u._id,
            name: u.name,
            profile: {
              age: u.profile?.age,
              gender: u.profile?.gender,
              bio: u.profile?.bio,
              interests: u.profile?.interests,
              photos: u.profile?.photos,
              mainPhoto: u.profile?.mainPhoto,
              isVerified: u.profile?.isVerified,
            },
            location: {
              city: u.location?.city || '',
              coordinates: (u.location?.coordinates || []).map(roundCoord),
            },
            distanceKm:
              u.distanceMeters !== undefined ? Math.round((u.distanceMeters / 1000) * 10) / 10 : undefined,
            score: jaccard,
          };
        })
        .sort((a, b) => b.score - a.score);

      res.json({ feed });
    } catch (err) {
      next(err);
    }
  }
);

// List all matched users for the current user
router.get('/matches', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const matches = await Match.find({ users: userId, status: 'matched' })
      .populate('users', 'name profile.mainPhoto profile.age status.isOnline status.lastSeen')
      .sort({ matchedAt: -1 });

    const conversations = await Conversation.find({ matchId: { $in: matches.map((m) => m._id) } });
    const conversationByMatchId = new Map(conversations.map((c) => [c.matchId.toString(), c._id.toString()]));

    const result = matches.map((m) => {
      const other = m.users.find((u) => u._id.toString() !== userId);
      return {
        matchId: m._id,
        matchedAt: m.matchedAt,
        user: other,
        conversationId: conversationByMatchId.get(m._id.toString()) || null,
      };
    });

    res.json({ matches: result });
  } catch (err) {
    next(err);
  }
});

// List all eligible users (matching gender preference and age range), regardless of like history or location
router.get(
  '/suggestions',
  requireAuth,
  [query('limit').optional().isInt({ min: 1, max: 100 })],
  validate,
  async (req, res, next) => {
    try {
      const me = await User.findById(req.user.id);
      if (!me) return res.status(404).json({ error: 'User not found' });

      const limit = req.query.limit ? Number(req.query.limit) : 50;

      const excludedIds = new Set([me._id.toString(), ...(me.blockedUsers || []).map((id) => id.toString())]);
      const blockedByOthers = await User.find({ blockedUsers: me._id }).select('_id');
      blockedByOthers.forEach((u) => excludedIds.add(u._id.toString()));

      const lookingFor = me.profile.lookingFor?.length ? me.profile.lookingFor : undefined;

      const filter = {
        _id: { $nin: [...excludedIds].map((id) => new mongoose.Types.ObjectId(id)) },
        'status.isActive': true,
        'status.isBanned': false,
        'profile.age': { $gte: me.settings.ageRange.min, $lte: me.settings.ageRange.max },
        ...(lookingFor ? { 'profile.gender': { $in: lookingFor } } : {}),
      };

      const users = await User.find(filter).limit(limit).lean();

      const suggestions = users.map((u) => ({
        id: u._id,
        name: u.name,
        profile: {
          age: u.profile?.age,
          gender: u.profile?.gender,
          bio: u.profile?.bio,
          interests: u.profile?.interests,
          mainPhoto: u.profile?.mainPhoto,
          isVerified: u.profile?.isVerified,
        },
        status: {
          isOnline: u.settings?.showOnline ? !!u.status?.isOnline : undefined,
          lastSeen: u.settings?.showOnline ? u.status?.lastSeen : undefined,
        },
      }));

      res.json({ suggestions });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
