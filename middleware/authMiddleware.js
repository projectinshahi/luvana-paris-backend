const jwt = require('jsonwebtoken');
const User = require('../model/userModel');

const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verify user still exists and is active. Use lean + minimal select to
    // reduce payload (~500 B → ~50 B) — controllers only need req.user._id.
    const user = await User.findById(decoded.userId).select('_id status').lean();
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    if (user.status === 'inactive') {
      return res.status(401).json({ message: 'Account is inactive' });
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    // Mongoose CastError: decoded.userId is not a valid ObjectId
    if (error.name === 'CastError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    res.status(500).json({ message: 'Authentication error' });
  }
};

module.exports = authMiddleware;