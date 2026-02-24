const express = require('express');
const router = express.Router();
const passport = require('passport');
const googleOAuthController = require('../../controller/user/googleOAuthController');

// Initiate Google OAuth login
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email']
  })
);

// Google OAuth callback
router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/users/auth/failure',
    session: false
  }),
  googleOAuthController.googleCallback
);

// Get current user profile
router.get('/profile', googleOAuthController.getCurrentUser);

// Logout
router.post('/logout', googleOAuthController.logout);

module.exports = router;