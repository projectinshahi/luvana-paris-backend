const User = require('../../model/userModel');

// Google OAuth callback handler
const googleCallback = async (req, res) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ message: 'Authentication failed' });
    }

    // Generate token
    const token = user.generateAccessToken();

    // Return JSON response with token and user data
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        profilePicture: user.profilePicture
      }
    });
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get current user profile
const getCurrentUser = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Logout
const logout = (req, res) => {
  try {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: 'Logout failed' });
      }
      res.json({ message: 'Logged out successfully' });
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  googleCallback,
  getCurrentUser,
  logout
};