const express = require('express');
const axios = require('axios');
const { body, query } = require('express-validator');
const mongoose = require('mongoose');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { isPrivateIp, getClientIp, roundCoord } = require('../utils/geo');

const router = express.Router();

const IP_API_URL = process.env.IP_API_URL || 'http://ip-api.com/json';

// Detect approximate location from the requester's IP via ip-api.com
router.post('/detect', requireAuth, async (req, res, next) => {
  try {
    const clientIp = getClientIp(req);
    const target = isPrivateIp(clientIp) ? '' : `/${clientIp}`;

    const { data } = await axios.get(`${IP_API_URL}${target}`, {
      params: { fields: 'status,message,lat,lon,city,country,query' },
      timeout: 5000,
    });

    if (data.status !== 'success') {
      return res.status(502).json({ error: 'Location lookup failed', details: data.message });
    }

    res.json({
      lat: data.lat,
      lng: data.lon,
      city: data.city,
      country: data.country,
      ip: data.query,
    });
  } catch (err) {
    next(err);
  }
});

// Persist the user's location as a GeoJSON Point
router.put(
  '/location',
  requireAuth,
  [
    body('lat').isFloat({ min: -90, max: 90 }),
    body('lng').isFloat({ min: -180, max: 180 }),
    body('city').optional().isString().trim(),
    body('country').optional().isString().trim(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { lat, lng, city, country } = req.body;
      const clientIp = getClientIp(req);

      const user = await User.findByIdAndUpdate(
        req.user.id,
        {
          $set: {
            'location.type': 'Point',
            'location.coordinates': [lng, lat],
            'location.city': city || '',
            'location.country': country || '',
            'location.ipAddress': clientIp,
          },
        },
        { new: true }
      );
      if (!user) return res.status(404).json({ error: 'User not found' });

      res.json({
        location: {
          city: user.location.city,
          country: user.location.country,
          coordinates: [roundCoord(lng), roundCoord(lat)],
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// Find nearby users matching gender preference and within maxDistance
router.get(
  '/nearby',
  requireAuth,
  [query('maxDistance').optional().isInt({ min: 1, max: 500 })],
  validate,
  async (req, res, next) => {
    try {
      const me = await User.findById(req.user.id);
      if (!me) return res.status(404).json({ error: 'User not found' });

      const [lng, lat] = me.location.coordinates;
      if (lng === 0 && lat === 0) {
        return res.status(400).json({ error: 'Location not set. Call PUT /api/geo/location first.' });
      }

      const maxDistanceKm = req.query.maxDistance
        ? Number(req.query.maxDistance)
        : me.settings.maxDistance;

      const excludedIds = new Set([me._id.toString(), ...(me.blockedUsers || []).map((id) => id.toString())]);
      const blockedByOthers = await User.find({ blockedUsers: me._id }).select('_id');
      blockedByOthers.forEach((u) => excludedIds.add(u._id.toString()));

      const lookingFor = me.profile.lookingFor?.length ? me.profile.lookingFor : undefined;

      const pipeline = [
        {
          $geoNear: {
            near: { type: 'Point', coordinates: [lng, lat] },
            distanceField: 'distanceMeters',
            maxDistance: maxDistanceKm * 1000,
            spherical: true,
            query: {
              _id: { $nin: [...excludedIds].map((id) => new mongoose.Types.ObjectId(id)) },
              'status.isActive': true,
              'status.isBanned': false,
              ...(lookingFor ? { 'profile.gender': { $in: lookingFor } } : {}),
              'profile.age': { $gte: me.settings.ageRange.min, $lte: me.settings.ageRange.max },
            },
          },
        },
        { $limit: 50 },
      ];

      const results = await User.aggregate(pipeline);

      const nearby = results.map((u) => ({
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
        location: {
          city: u.location?.city || '',
          coordinates: (u.location?.coordinates || []).map(roundCoord),
        },
        distanceKm: Math.round((u.distanceMeters / 1000) * 10) / 10,
        status: {
          isOnline: u.settings?.showOnline ? !!u.status?.isOnline : undefined,
          lastSeen: u.settings?.showOnline ? u.status?.lastSeen : undefined,
        },
      }));

      res.json({ nearby });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
