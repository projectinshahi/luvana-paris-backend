const express = require('express');
const router = express.Router();

// Use login route
router.use('/login', require('./admin/loginRoute'));

// Use categories route
router.use('/categories', require('./admin/categoryRoute'));

// Use brands route
router.use('/brands', require('./admin/brandRoute'));

// Use promotion strips route
router.use('/promotion-strips', require('./admin/promotionStripRoute'));

// Use coupons route
router.use('/coupons', require('./admin/couponRoute'));

module.exports = router;