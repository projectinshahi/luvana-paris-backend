const express = require('express');
const router = express.Router();
const orderController = require('../../controller/admin/orderController');
const adminAuthMiddleware = require('../../middleware/adminAuthMiddleware');

// Apply admin authentication middleware to all routes
// router.use(adminAuthMiddleware);

// Get order statistics
router.get('/stats', orderController.getOrderStats);

// Get all orders with pagination and filters
router.get('/', orderController.getAllOrders);

// Get single order by ID
router.get('/:id', orderController.getOrderById);

// Update order status
router.patch('/:id/status', orderController.updateOrderStatus);

// Update payment status
router.patch('/:id/payment-status', orderController.updatePaymentStatus);

// Delete/cancel order
router.delete('/:id', orderController.deleteOrder);

module.exports = router;
