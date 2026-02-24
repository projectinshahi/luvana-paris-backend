const express = require('express');
const router = express.Router();
const productController = require('../../controller/user/productController');

// GET /users/product/:id - Get product details with similar products
router.get('/:id', productController.getProductDetails);

module.exports = router;