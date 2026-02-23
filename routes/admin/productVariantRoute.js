const express = require('express');
const router = express.Router();
const productVariantController = require('../../controller/admin/productVariantController');

// GET /admin/product-variants - Get all active product variants
router.get('/', productVariantController.getAllProductVariants);

// GET /admin/product-variants/product/:productId - Get variants by product ID
router.get('/product/:productId', productVariantController.getVariantsByProductId);

// GET /admin/product-variants/:id - Get product variant by ID
router.get('/:id', productVariantController.getProductVariantById);

// POST /admin/product-variants - Create new product variant
router.post('/', productVariantController.createProductVariant);

// PUT /admin/product-variants/:id - Update product variant
router.put('/:id', productVariantController.updateProductVariant);

// DELETE /admin/product-variants/:id - Delete product variant (soft delete)
router.delete('/:id', productVariantController.deleteProductVariant);

module.exports = router;