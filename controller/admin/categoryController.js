const Category = require('../../model/categoryModel');

// Get all categories
const getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find();
    res.json(categories);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get category by ID
const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    res.json(category);
  } catch (error) {
    console.error('Get category error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Create new category
const createCategory = async (req, res) => {
  try {
    const { nameEnglish, nameArabic, descriptionEnglish, descriptionArabic, imageUrlEnglish, imageUrlArabic, status } = req.body;

    if (!nameEnglish || !nameArabic) {
        return res.status(400).json({ message: 'Name English and Name Arabic are required' });
    }
    
    const newCategory = new Category({
      nameEnglish,
      nameArabic,
      descriptionEnglish,
      descriptionArabic,
      imageUrlEnglish,
      imageUrlArabic,
      status: status || 'active'
    });

    const savedCategory = await newCategory.save();
    res.status(201).json(savedCategory);
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Update category
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { nameEnglish, nameArabic, descriptionEnglish, descriptionArabic, imageUrlEnglish, imageUrlArabic, status } = req.body;

    if (!nameEnglish || !nameArabic) {
        return res.status(400).json({ message: 'Name English and Name Arabic are required' });
    }

    const updates = {
        nameEnglish,
        nameArabic,
        descriptionEnglish,
        descriptionArabic,
        imageUrlEnglish,
        imageUrlArabic,
        status
    };

    const updatedCategory = await Category.findByIdAndUpdate(id, updates, { new: true });
    if (!updatedCategory) {
      return res.status(404).json({ message: 'Category not found' });
    }
    res.json(updatedCategory);
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Delete category (soft delete by setting status to inactive)
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedCategory = await Category.findByIdAndUpdate(id, { status: 'inactive' }, { new: true });
    if (!deletedCategory) {
      return res.status(404).json({ message: 'Category not found' });
    }
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory
};