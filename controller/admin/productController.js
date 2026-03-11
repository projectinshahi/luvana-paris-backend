const Product = require('../../model/productModel');

const parseBoolean = (value, defaultValue = undefined) => {
  if (value === undefined) return defaultValue;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return Boolean(value);
};

// Get all products with filters
const getAllProducts = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status, category, brand } = req.query;

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const limitNumber = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);

    const query = {};

    // Search filter
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { nameEnglish: searchRegex },
        { nameArabic: searchRegex }
      ];
    }

    // Status filter
    if (status) {
      query.status = status;
    }

    // Category filter
    if (category) {
      query.category = category;
    }

    // Brand filter
    if (brand) {
      query.brand = brand;
    }

    const totalItems = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalItems / limitNumber);

    const products = await Product.find(query)
      .populate('category', 'nameEnglish nameArabic')
      .populate('brand', 'nameEnglish nameArabic logoUrlEnglish logoUrlArabic brandImageEnglish brandImageArabic')
      .sort({ createdAt: -1 })
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber);

    res.json({
      items: products,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        totalItems,
        totalPages
      }
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get product by ID
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id)
      .populate('category', 'nameEnglish nameArabic')
      .populate('brand', 'nameEnglish nameArabic logoUrlEnglish logoUrlArabic brandImageEnglish brandImageArabic');
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Create new product
const createProduct = async (req, res) => {
  try {
    const { 
      category, 
      brand, 
      nameEnglish, 
      nameArabic, 
      shortDescriptionEnglish, 
      shortDescriptionArabic, 
      description, 
      // imageUrlEnglish, 
      // imageUrlArabic,
      isNew,
      isFeatured,
      hasVariants,
      status 
    } = req.body;

    // Validate imageUrlEnglish structure
    // if (imageUrlEnglish && !Array.isArray(imageUrlEnglish)) {
    //   return res.status(400).json({ message: 'imageUrlEnglish must be an array' });
    // }

    // // Validate imageUrlArabic structure
    // if (imageUrlArabic && !Array.isArray(imageUrlArabic)) {
    //   return res.status(400).json({ message: 'imageUrlArabic must be an array' });
    // }

    const newProduct = new Product({
      category,
      brand,
      nameEnglish,
      nameArabic,
      shortDescriptionEnglish,
      shortDescriptionArabic,
      description,
      // imageUrlEnglish: imageUrlEnglish || [],
      // imageUrlArabic: imageUrlArabic || [],
      isNew: parseBoolean(isNew, false),
      isFeatured: parseBoolean(isFeatured, false),
      hasVariants: parseBoolean(hasVariants, false),
      status: status || 'active'
    });

    const savedProduct = await newProduct.save();
    const populatedProduct = await Product.findById(savedProduct._id)
      .populate('category', 'nameEnglish nameArabic')
      .populate('brand', 'nameEnglish nameArabic logoUrlEnglish logoUrlArabic brandImageEnglish brandImageArabic');
    res.status(201).json(populatedProduct);
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Update product
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    if (updates.hasVariants !== undefined) {
      updates.hasVariants = parseBoolean(updates.hasVariants);
    }

    // Validate imageUrlEnglish structure if provided
    // if (updates.imageUrlEnglish !== undefined && !Array.isArray(updates.imageUrlEnglish)) {
    //   return res.status(400).json({ message: 'imageUrlEnglish must be an array' });
    // }

    // // Validate imageUrlArabic structure if provided
    // if (updates.imageUrlArabic !== undefined && !Array.isArray(updates.imageUrlArabic)) {
    //   return res.status(400).json({ message: 'imageUrlArabic must be an array' });
    // }

    const updatedProduct = await Product.findByIdAndUpdate(id, updates, { new: true })
      .populate('category', 'nameEnglish nameArabic')
      .populate('brand', 'nameEnglish nameArabic logoUrlEnglish logoUrlArabic brandImageEnglish brandImageArabic');
    if (!updatedProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(updatedProduct);
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Delete product (soft delete by setting status to inactive)
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedProduct = await Product.findByIdAndUpdate(id, { status: 'inactive' }, { new: true });
    if (!deletedProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct
};