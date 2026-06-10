const express = require('express');
const bcrypt = require('bcryptjs');
const { body } = require('express-validator');
const User = require('../models/User');
const validate = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimit');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} = require('../utils/tokens');

const router = express.Router();

const REFRESH_COOKIE_NAME = 'refreshToken';
const REFRESH_COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
  path: '/api/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
};

async function issueTokens(res, user) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  user.refreshTokenHash = await bcrypt.hash(refreshToken, 12);
  await user.save();
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, REFRESH_COOKIE_OPTS);
  return accessToken;
}

router.post(
  '/register',
  authLimiter,
  [
    body('name').trim().isLength({ min: 1, max: 50 }),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('age').isInt({ min: 18, max: 120 }),
    body('gender').isIn(['male', 'female', 'nonbinary', 'other']),
    body('lookingFor').isArray({ min: 1 }),
    body('lookingFor.*').isIn(['male', 'female', 'nonbinary', 'other']),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { name, email, password, age, gender, lookingFor, orientation } = req.body;

      const existing = await User.findOne({ email });
      if (existing) return res.status(409).json({ error: 'Email already registered' });

      const passwordHash = await bcrypt.hash(password, 12);

      const user = await User.create({
        name,
        email,
        password: passwordHash,
        profile: { age, gender, lookingFor, orientation },
      });

      const accessToken = await issueTokens(res, user);
      res.status(201).json({
        accessToken,
        user: { id: user._id, name: user.name, email: user.email, role: user.role },
      });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/login',
  authLimiter,
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const user = await User.findOne({ email }).select('+password');
      if (!user || !user.password) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

      if (user.status.isBanned) return res.status(403).json({ error: 'Account banned' });

      const accessToken = await issueTokens(res, user);
      res.json({
        accessToken,
        user: { id: user._id, name: user.name, email: user.email, role: user.role },
      });
    } catch (err) {
      next(err);
    }
  }
);

router.post('/refresh', async (req, res, next) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!token) return res.status(401).json({ error: 'Refresh token missing' });

    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const user = await User.findById(payload.sub).select('+refreshTokenHash');
    if (!user || !user.refreshTokenHash) {
      return res.status(401).json({ error: 'Session not found' });
    }

    const valid = await bcrypt.compare(token, user.refreshTokenHash);
    if (!valid) return res.status(401).json({ error: 'Session not found' });

    const accessToken = await issueTokens(res, user); // rotate refresh token
    res.json({ accessToken });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', async (req, res, next) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    if (token) {
      try {
        const payload = verifyRefreshToken(token);
        await User.findByIdAndUpdate(payload.sub, { $unset: { refreshTokenHash: 1 } });
      } catch (err) {
        // token already invalid, nothing to clean up
      }
    }
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Temporary guest session - account auto-expires after 24h via TTL index
router.post('/guest', authLimiter, async (req, res, next) => {
  try {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const user = await User.create({
      name: `Guest${Math.floor(Math.random() * 1000000)}`,
      isGuest: true,
      expiresAt,
      profile: { lookingFor: [] },
    });

    const accessToken = signAccessToken(user);
    res.status(201).json({
      accessToken,
      user: { id: user._id, name: user.name, isGuest: true },
      expiresAt,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
