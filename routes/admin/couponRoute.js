const express = require('express');
const router = express.Router();
const couponController = require('../../controller/admin/couponController');

// GET /admin/coupons - Get all active coupons
router.get('/', couponController.getAllCoupons);

// GET /admin/coupons/:id - Get coupon by ID
router.get('/:id', couponController.getCouponById);

// POST /admin/coupons - Create new coupon
router.post('/', couponController.createCoupon);

// PUT /admin/coupons/:id - Update coupon
router.put('/:id', couponController.updateCoupon);

// DELETE /admin/coupons/:id - Delete coupon (soft delete)
router.delete('/:id', couponController.deleteCoupon);

module.exports = router;