const express = require('express');
const router = express.Router();
const categoryController = require('../../controller/admin/categoryController');

// GET /admin/categories - Get all active categories
router.get('/', categoryController.getAllCategories);

// GET /admin/categories/:id - Get category by ID
router.get('/:id', categoryController.getCategoryById);

// POST /admin/categories - Create new category
router.post('/', categoryController.createCategory);

// PUT /admin/categories/:id - Update category
router.put('/:id', categoryController.updateCategory);

// DELETE /admin/categories/:id - Delete category (soft delete)
router.delete('/:id', categoryController.deleteCategory);

module.exports = router;