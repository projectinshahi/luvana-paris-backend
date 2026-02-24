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

module.exports = router;
