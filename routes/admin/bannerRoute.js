const express = require('express');
const router = express.Router();
const bannerController = require('../../controller/admin/bannerController');

// GET /admin/banners - Get all active banners
router.get('/', bannerController.getAllBanners);

// GET /admin/banners/:id - Get banner by ID
router.get('/:id', bannerController.getBannerById);

// POST /admin/banners - Create new banner
router.post('/', bannerController.createBanner);

// PUT /admin/banners/:id - Update banner
router.put('/:id', bannerController.updateBanner);

// DELETE /admin/banners/:id - Delete banner (soft delete)
router.delete('/:id', bannerController.deleteBanner);

module.exports = router;