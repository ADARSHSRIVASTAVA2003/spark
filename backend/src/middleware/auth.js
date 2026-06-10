const { verifyAccessToken } = require('../utils/tokens');

function getTokenFromHeader(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme === 'Bearer' && token) return token;
  return null;
}

function requireAuth(req, res, next) {
  const token = getTokenFromHeader(req);
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role, isGuest: payload.isGuest };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function optionalAuth(req, _res, next) {
  const token = getTokenFromHeader(req);
  if (!token) return next();

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role, isGuest: payload.isGuest };
  } catch (err) {
    // ignore invalid token, proceed as anonymous
  }
  next();
}

module.exports = { requireAuth, optionalAuth };
