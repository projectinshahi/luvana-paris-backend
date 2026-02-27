const express = require('express');
const router = express.Router();
const adminAuthMiddleware = require('../middleware/adminAuthMiddleware');

// Use login route
router.use('/login', require('./admin/loginRoute'));

// Apply admin authentication middleware to all routes below
// router.use(adminAuthMiddleware);

// Use categories route
router.use('/category', require('./admin/categoryRoute'));

// Use brands route
router.use('/brand', require('./admin/brandRoute'));

// Use banners route
router.use('/banner', require('./admin/bannerRoute'));

// Use promotion strips route
router.use('/promotion-strip', require('./admin/promotionStripRoute'));

// Use coupons route
router.use('/coupon', require('./admin/couponRoute'));

// Use products route
router.use('/product', require('./admin/productRoute'));

// Use product variants route
router.use('/product-variant', require('./admin/productVariantRoute'));

// Use orders route
router.use('/order', require('./admin/orderRoute'));

// Use users route
router.use('/customer', require('./admin/userRoute'));

// Use influencer route
router.use('/influencer', require('./admin/influencerRoute'));

// Use dashboard route
router.use('/dashboard', require('./admin/dashboardRoute'));

// Image upload route
router.use('/general', require('./admin/generalRoute'));

module.exports = router;