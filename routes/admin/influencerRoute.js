const express = require('express');
const router = express.Router();
const influencerController = require('../../controller/admin/influencerController');
const adminAuthMiddleware = require('../../middleware/adminAuthMiddleware');

// Apply admin authentication middleware to all routes
// router.use(adminAuthMiddleware);

// GET /admin/influencer - Get all active influencers
router.get('/', influencerController.getAllInfluencers);

// GET /admin/influencer/:id - Get influencer by ID
router.get('/:id', influencerController.getInfluencerById);

// POST /admin/influencer - Create new influencer
router.post('/', influencerController.createInfluencer);

// PUT /admin/influencer/:id - Update influencer
router.put('/:id', influencerController.updateInfluencer);

// DELETE /admin/influencer/:id - Delete influencer (soft delete)
router.delete('/:id', influencerController.deleteInfluencer);

module.exports = router;
