const jwt = require('jsonwebtoken');
const Admin = require('../model/adminModel');

const adminAuthMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    // Verify token
    const decoded = jwt.verify(token, 'this_luvana756#');

    // Get admin from database
    const admin = await Admin.findById(decoded.userId);
    if (!admin) {
      return res.status(401).json({ message: 'Admin not found' });
    }

    // Attach admin to request
    req.admin = admin;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    res.status(500).json({ message: 'Authentication error' });
  }
};

module.exports = adminAuthMiddleware;