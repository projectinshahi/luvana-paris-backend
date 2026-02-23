const Product = require('../../model/productModel');

// Get all products
const getAllProducts = async (req, res) => {
  try {
    const products = await Product.find({ status: 'active' })
      .populate('category', 'nameEnglish nameArabic')
      .populate('brand', 'nameEnglish nameArabic');
    res.json(products);
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
      .populate('brand', 'nameEnglish nameArabic');
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
      imageUrlEnglish, 
      imageUrlArabic, 
      status 
    } = req.body;

    const newProduct = new Product({
      category,
      brand,
      nameEnglish,
      nameArabic,
      shortDescriptionEnglish,
      shortDescriptionArabic,
      description,
      imageUrlEnglish,
      imageUrlArabic,
      status: status || 'active'
    });

    const savedProduct = await newProduct.save();
    const populatedProduct = await Product.findById(savedProduct._id)
      .populate('category', 'nameEnglish nameArabic')
      .populate('brand', 'nameEnglish nameArabic');
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
    const updates = req.body;

    const updatedProduct = await Product.findByIdAndUpdate(id, updates, { new: true })
      .populate('category', 'nameEnglish nameArabic')
      .populate('brand', 'nameEnglish nameArabic');
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