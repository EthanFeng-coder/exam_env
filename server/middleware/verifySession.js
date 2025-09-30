const jwt = require('jsonwebtoken');

function getClientIp(req) {
  // Use x-forwarded-for first (when behind proxy) then remoteAddress
  let ip = (req.headers['x-forwarded-for'] || '')
    .split(',')[0]
    .trim() || req.socket.remoteAddress || '';
  // Normalize IPv6 mapped
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  if (ip === '::1') ip = '127.0.0.1';
  return ip;
}

const verifySession = async (req, res, next) => {
  const token = req.cookies.authToken;

  if (!token) {
    return res.status(401).json({ success: false, message: 'No authentication token provided', reason: 'tokenMissing' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const currentIp = getClientIp(req);

    // (Optional) strict IP match – comment out to disable
    if (decoded.ip && decoded.ip !== currentIp) {
      console.warn(`IP mismatch: token=${decoded.ip} current=${currentIp}`);
      // return res.status(401).json({
      //   success: false,
      //   message: 'IP changed. Please login again.',
      //   reason: 'tokenIpMismatch',
      //   details: { tokenIp: decoded.ip, currentIp }
      // });
    }

    // Expiry check (jwt.verify already throws on exp, but keeping explicit is fine)
    const nowSec = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp <= nowSec) {
      return res.status(401).json({ success: false, message: 'Token expired', reason: 'tokenExpired' });
    }

    req.user = {
      studentId: decoded.studentId,
      ip: decoded.ip,
      exp: decoded.exp
    };
    next();
  } catch (error) {
    console.error('Session verification error:', error);
    // return res.status(401).json({
    //   success: false,
    //   message: 'Invalid or expired token',
    //   reason: 'tokenInvalid',
    //   error: error.message
    // });
  }
};

module.exports = verifySession;