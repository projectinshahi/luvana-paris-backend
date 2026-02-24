const express = require('express');
const router = express.Router();
const promotionStripController = require('../../controller/user/promotionStripController');

// GET /users/promotion-strips - Get all active promotion strips
router.get('/', promotionStripController.getActivePromotionStrips);

module.exports = router;
