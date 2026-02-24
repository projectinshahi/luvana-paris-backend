const express = require('express');
const router = express.Router();

// Use login route
router.use('/login', require('./admin/loginRoute'));

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

module.exports = router;