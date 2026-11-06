const express = require('express');
const router = express.Router();
const passport = require('passport');
const googleOAuthController = require('../../controller/user/googleOAuthController');

// Initiate Google OAuth login
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Google OAuth callback — Passport verifies, then controller redirects to frontend with one-time code
router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:4000'}?error=google_auth_failed`,
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
