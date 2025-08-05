const jwt = require('jsonwebtoken');

const verifySession = async (req, res, next) => {
  const { ip } = req.body;
  const token = req.cookies.authToken;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'No authentication token provided'
    });
  }

  if (!ip) {
    return res.status(400).json({
      success: false,
      message: 'IP address required'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Log IPs for debugging
    console.log('Token IP:', decoded.ip);
    console.log('Request IP:', ip);
    
    // Verify IP matches the one stored in token
    if (decoded.ip !== ip) {
      console.log('IP mismatch detected');
      return res.status(401).json({
        success: false,
        message: 'IP address mismatch',
        details: {
          tokenIp: decoded.ip,
          currentIp: ip
        }
      });
    }
    
    // Check token expiration
    const currentTime = Math.floor(Date.now() / 1000);
    if (decoded.exp <= currentTime) {
      return res.status(401).json({
        success: false,
        message: 'Token has expired'
      });
    }

    // Add user info to request for downstream middleware/routes
    req.user = {
      studentId: decoded.studentId,
      ip: decoded.ip,
      exp: decoded.exp
    };
    
    next();
  } catch (error) {
    console.error('Session verification error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
      error: error.message
    });
  }
};

module.exports = verifySession;