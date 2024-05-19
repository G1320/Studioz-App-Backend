const { JWT_SECRET_KEY } = require('../../config');
const jwt = require('jsonwebtoken');

function verifyTokenMw(req, res, next) {
  const token = req.signedCookies.accessToken;

  if (!token) return res.status(401).json({ message: 'Access denied. No token provided.' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET_KEY);
    req.decodedJwt = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ message: 'Token expired' });
    } else {
      return res.status(400).json({ message: 'Invalid access token' });
    }
  }
}

module.exports = verifyTokenMw;
