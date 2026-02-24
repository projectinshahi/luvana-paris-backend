const express = require('express');
const router = express.Router();
const cartController = require('../../controller/user/cartController');
const authMiddleware = require('../../middleware/authMiddleware');

// Apply auth middleware to all cart routes
// router.use(authMiddleware);

// POST /users/cart - Add item to cart
router.post('/', cartController.addToCart);

// GET /users/cart - Get all cart items with calculations
router.get('/', cartController.getCart);

// PUT /users/cart/:cartItemId - Update cart item quantity
router.put('/:cartItemId', cartController.updateCartItem);

// DELETE /users/cart/:cartItemId - Remove item from cart
router.delete('/:cartItemId', cartController.removeFromCart);

// DELETE /users/cart/clear-all - Clear entire cart
router.delete('/clear-all', cartController.clearCart);

module.exports = router;