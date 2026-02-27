var express = require('express');
var router = express.Router();

// Use user auth routes
router.use('/', require('./user/userLoginRoute'));

// Use Google OAuth routes
router.use('/google-auth', require('./user/googleOAuthRoute'));

// Home route for users
router.use('/home', require('./user/homeRoute'));

// Product details route
router.use('/product', require('./user/productRoute'));

// Cart routes
router.use('/cart', require('./user/cartRoute'));

// Wishlist routes
router.use('/wishlist', require('./user/wishlistRoute'));

// Address routes
router.use('/address', require('./user/addressRoute'));

// Profile routes
router.use('/profile', require('./user/profileRoute'));

// Orders routes
router.use('/order', require('./user/orderRoute'));

// Promotion strips route
router.use('/promotion-strip', require('./user/promotionStripRoute'));

// Influencer route
router.use('/influencer', require('./user/influencerRoute'));

module.exports = router;
