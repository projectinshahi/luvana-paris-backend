const express = require('express');
const router = express.Router();
const dashboardController = require('../../controller/admin/dashboardController');
const adminAuthMiddleware = require('../../middleware/adminAuthMiddleware');

// Apply admin authentication middleware to all routes
// router.use(adminAuthMiddleware);

// GET /admin/dashboard - Get dashboard metrics and data
router.get('/', dashboardController.getDashboard);

module.exports = router;
