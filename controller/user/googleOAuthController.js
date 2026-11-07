const crypto = require('crypto');
const AuthCode = require('../../model/authCodeModel');

const googleCallback = async (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4000';
  try {
    const user = req.user;
    if (!user) return res.redirect(`${frontendUrl}/auth/google?error=auth_failed`);

    const token = user.generateAccessToken();
    const code = crypto.randomBytes(32).toString('hex');

    await AuthCode.create({ code, token, user: { id: user._id, name: user.name, email: user.email, phone: user.phone } });

    res.redirect(`${frontendUrl}/auth/google?code=${code}`);
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    res.redirect(`${frontendUrl}/auth/google?error=auth_failed`);
  }
};

const exchangeCode = async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ message: 'Missing code' });

  try {
    const entry = await AuthCode.findOneAndDelete({ code });
    if (!entry) return res.status(401).json({ message: 'Invalid or expired code' });
    res.json({ token: entry.token, user: entry.user });
  } catch (error) {
    console.error('Exchange code error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const getCurrentUser = async (req, res) => {
  try {
    const User = require('../../model/userModel');
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
