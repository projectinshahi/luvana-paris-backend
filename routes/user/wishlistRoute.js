const express = require('express');
const router = express.Router();
const wishlistController = require('../../controller/user/wishlistController');
const authMiddleware = require('../../middleware/authMiddleware');

router.use(authMiddleware);

// POST /users/wishlist - Add item to wishlist
router.post('/', wishlistController.addToWishlist);

// GET /users/wishlist - List all wishlist items
router.get('/', wishlistController.getWishlist);

// DELETE /users/wishlist/:wishlistItemId - Remove item from wishlist
router.delete('/:wishlistItemId', wishlistController.removeFromWishlist);

module.exports = router;
