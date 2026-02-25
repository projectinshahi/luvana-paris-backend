const express = require('express');
const router = express.Router();
const userController = require('../../controller/admin/userController');
const adminAuthMiddleware = require('../../middleware/adminAuthMiddleware');

// Apply admin authentication middleware to all routes
// router.use(adminAuthMiddleware);

// Get user statistics
router.get('/stats', userController.getUserStats);

// Get all users with pagination, search, and filter
router.get('/', userController.getAllUsers);

// Get single user by ID
router.get('/:id', userController.getUserById);

// Update user status
router.patch('/:id/status', userController.updateUserStatus);

// Delete/deactivate user
router.delete('/:id', userController.deleteUser);

module.exports = router;
