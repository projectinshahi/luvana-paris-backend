const express = require('express');
const router = express.Router();
const influencerController = require('../../controller/user/influencerController');

// GET /user/influencer - Get all active influencers
router.get('/', influencerController.getInfluencers);

module.exports = router;
