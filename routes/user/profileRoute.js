const express = require('express');
const router = express.Router();
const profileController = require('../../controller/user/profileController');
const authMiddleware = require('../../middleware/authMiddleware');

router.use(authMiddleware);

// GET /users/profile - Get user profile
router.get('/', profileController.getProfile);

// PUT /users/profile - Update user profile
router.put('/', profileController.updateProfile);

module.exports = router;
