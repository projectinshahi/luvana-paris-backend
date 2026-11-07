const express = require('express');
const router = express.Router();
const passport = require('passport');
const googleOAuthController = require('../../controller/user/googleOAuthController');

// Initiate Google OAuth login
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], prompt: 'select_account' }));

// Google OAuth callback — Passport verifies, then controller redirects to frontend with one-time code
router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:4000'}/auth/google?error=google_auth_failed`,
    session: false,
  }),
  googleOAuthController.googleCallback
);

// Exchange one-time code for JWT (called by the frontend /auth/google page)
router.get('/exchange', googleOAuthController.exchangeCode);

// Get current user profile
router.get('/profile', googleOAuthController.getCurrentUser);

// Logout
router.post('/logout', googleOAuthController.logout);

module.exports = router;
