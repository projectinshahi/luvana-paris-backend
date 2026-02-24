const express = require('express');
const router = express.Router();
const brandController = require('../../controller/admin/brandController');

// GET /admin/brands - Get all active brands
router.get('/', brandController.getAllBrands);

// GET /admin/brands/:id - Get brand by ID
router.get('/:id', brandController.getBrandById);

// POST /admin/brands - Create new brand
router.post('/', brandController.createBrand);

// PUT /admin/brands/:id - Update brand
router.put('/:id', brandController.updateBrand);

// DELETE /admin/brands/:id - Delete brand (soft delete)
router.delete('/:id', brandController.deleteBrand);

module.exports = router;