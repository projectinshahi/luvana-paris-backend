const express = require('express');
const router = express.Router();
const productController = require('../../controller/admin/productController');

// GET /admin/products - Get all active products
router.get('/', productController.getAllProducts);

// GET /admin/products/:id - Get product by ID
router.get('/:id', productController.getProductById);

// POST /admin/products - Create new product
router.post('/', productController.createProduct);

// PUT /admin/products/:id - Update product
router.put('/:id', productController.updateProduct);

// DELETE /admin/products/:id - Delete product (soft delete)
router.delete('/:id', productController.deleteProduct);

module.exports = router;