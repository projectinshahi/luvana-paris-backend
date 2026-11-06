const crypto = require('crypto');
const User = require('../../model/userModel');

// ponytail: in-memory Map is fine for single-process; swap for Redis if multi-process
const authCodes = new Map();

const googleCallback = async (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:4000';
  try {
    const user = req.user;
    if (!user) return res.redirect(`${frontendUrl}?error=auth_failed`);

    const token = user.generateAccessToken();
    const code = crypto.randomBytes(32).toString('hex');

    authCodes.set(code, {
      token,
      user: { id: user._id, name: user.name, email: user.email, phone: user.phone },
      exp: Date.now() + 5 * 60 * 1000,
    });

    // Opportunistic cleanup of expired codes
    for (const [k, v] of authCodes) {
      if (v.exp < Date.now()) authCodes.delete(k);
    }

    res.redirect(`${frontendUrl}/auth/google?code=${code}`);
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    res.redirect(`${frontendUrl}?error=auth_failed`);
  }
};

const exchangeCode = (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ message: 'Missing code' });

  const entry = authCodes.get(code);
  if (!entry || entry.exp < Date.now()) {
    if (entry) authCodes.delete(code);
    return res.status(401).json({ message: 'Invalid or expired code' });
  }

  authCodes.delete(code);
  res.json({ token: entry.token, user: entry.user });
};

const getCurrentUser = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const logout = (req, res) => {
  try {
    req.logout((err) => {
      if (err) return res.status(500).json({ message: 'Logout failed' });
      res.json({ message: 'Logged out successfully' });
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = { googleCallback, exchangeCode, getCurrentUser, logout };
