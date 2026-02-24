const express = require('express');
const router = express.Router();
const orderController = require('../../controller/user/orderController');
const authMiddleware = require('../../middleware/authMiddleware');

router.use(authMiddleware);

// POST /users/orders - Create new order
router.post('/', orderController.createOrder);

// GET /users/orders - List all orders
router.get('/', orderController.getOrders);

module.exports = router;
