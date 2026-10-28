const express = require('express');
const router = express.Router();
const orderController = require('../../controller/user/orderController');
const authMiddleware = require('../../middleware/authMiddleware');

router.use(authMiddleware);

// POST /user/order - Create new order
router.post('/', orderController.createOrder);

// GET /user/order - List all orders for the authenticated user
router.get('/', orderController.getOrders);

// GET /user/order/lookup/:orderId - Fetch a single order by human-readable ID (e.g. ORD-…)
// Must be declared before any /:id route to avoid shadowing
router.get('/lookup/:orderId', orderController.getOrderById);

// POST /user/order/retry-recovery - Re-verify and retry order creation for a confirmed MYF payment
router.post('/retry-recovery', orderController.retryRecovery);

// GET /user/order/pending/:paymentReference - Poll pending payment status (for /payment/processing page)
// Must be declared before any /:id route to avoid shadowing
router.get('/pending/:paymentReference', orderController.getPendingPayment);

module.exports = router;
