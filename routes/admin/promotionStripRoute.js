const express = require('express');
const router = express.Router();
const promotionStripController = require('../../controller/admin/promotionStripController');

// GET /admin/promotion-strips - Get all active promotion strips
router.get('/', promotionStripController.getAllPromotionStrips);

// GET /admin/promotion-strips/:id - Get promotion strip by ID
router.get('/:id', promotionStripController.getPromotionStripById);

// POST /admin/promotion-strips - Create new promotion strip
router.post('/', promotionStripController.createPromotionStrip);

// PUT /admin/promotion-strips/:id - Update promotion strip
router.put('/:id', promotionStripController.updatePromotionStrip);

// DELETE /admin/promotion-strips/:id - Delete promotion strip (soft delete)
router.delete('/:id', promotionStripController.deletePromotionStrip);

module.exports = router;