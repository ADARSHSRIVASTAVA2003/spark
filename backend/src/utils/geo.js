const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^::1$/,
  /^::ffff:127\./,
];

function isPrivateIp(ip) {
  if (!ip) return true;
  return PRIVATE_IP_PATTERNS.some((re) => re.test(ip));
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.ip;
}

function roundCoord(value) {
  return Math.round(value * 100) / 100;
}

module.exports = { isPrivateIp, getClientIp, roundCoord };
