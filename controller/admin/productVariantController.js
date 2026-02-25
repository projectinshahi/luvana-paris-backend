const ProductVariants = require('../../model/productVariantsModel');

// Get all product variants
const getAllProductVariants = async (req, res) => {
  try {
    const variants = await ProductVariants.find({ status: 'active' })
      .select('nameEnglish nameArabic shortDescriptionEnglish shortDescriptionArabic color stock price mrp status imageUrlEnglish imageUrlArabic product createdAt updatedAt')
      .populate('product', 'nameEnglish nameArabic');
    res.json(variants);
  } catch (error) {
    console.error('Get product variants error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get product variants by product ID
const getVariantsByProductId = async (req, res) => {
  try {
    const { productId } = req.params;
    const variants = await ProductVariants.find({ product: productId, status: 'active' })
      .select('nameEnglish nameArabic shortDescriptionEnglish shortDescriptionArabic color stock price mrp status imageUrlEnglish imageUrlArabic product createdAt updatedAt');
    res.json(variants);
  } catch (error) {
    console.error('Get variants by product ID error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get product variant by ID
const getProductVariantById = async (req, res) => {
  try {
    const { id } = req.params;
    const variant = await ProductVariants.findById(id)
      .select('nameEnglish nameArabic shortDescriptionEnglish shortDescriptionArabic color stock price mrp status imageUrlEnglish imageUrlArabic product createdAt updatedAt')
      .populate('product', 'nameEnglish nameArabic');
    if (!variant) {
      return res.status(404).json({ message: 'Product variant not found' });
    }
    res.json(variant);
  } catch (error) {
    console.error('Get product variant error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Create new product variant
const createProductVariant = async (req, res) => {
  try {
    const { product, nameEnglish, nameArabic, shortDescriptionEnglish, shortDescriptionArabic, color, stock, price, mrp, status, imageUrlEnglish, imageUrlArabic } = req.body;

    // Validation
    if (!product || !nameEnglish || !nameArabic || stock === undefined || price === undefined || mrp === undefined) {
      return res.status(400).json({ message: 'All fields are required: product, nameEnglish, nameArabic, stock, price, mrp' });
    }

    if (typeof stock !== 'number' || stock < 0 || !Number.isInteger(stock)) {
      return res.status(400).json({ message: 'Stock must be a non-negative integer' });
    }

    if (typeof price !== 'number' || price <= 0) {
      return res.status(400).json({ message: 'Price must be a positive number' });
    }

    if (typeof mrp !== 'number' || mrp <= 0) {
      return res.status(400).json({ message: 'MRP must be a positive number' });
    }

    if (price > mrp) {
      return res.status(400).json({ message: 'Price cannot be greater than MRP' });
    }

    const newVariant = new ProductVariants({
      product,
      nameEnglish,
      nameArabic,
      shortDescriptionEnglish,
      shortDescriptionArabic,
      color,
      stock,
      price,
      mrp,
      status: status || 'active',
      imageUrlEnglish: imageUrlEnglish || [],
      imageUrlArabic: imageUrlArabic || []
    });

    const savedVariant = await newVariant.save();
    const populatedVariant = await ProductVariants.findById(savedVariant._id)
      .select('nameEnglish nameArabic shortDescriptionEnglish shortDescriptionArabic color stock price mrp status imageUrlEnglish imageUrlArabic product createdAt updatedAt')
      .populate('product', 'nameEnglish nameArabic');
    res.status(201).json(populatedVariant);
  } catch (error) {
    console.error('Create product variant error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Update product variant
const updateProductVariant = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Validation for provided fields
    if (updates.stock !== undefined && (typeof updates.stock !== 'number' || updates.stock < 0 || !Number.isInteger(updates.stock))) {
      return res.status(400).json({ message: 'Stock must be a non-negative integer' });
    }

    if (updates.price !== undefined && (typeof updates.price !== 'number' || updates.price <= 0)) {
      return res.status(400).json({ message: 'Price must be a positive number' });
    }

    if (updates.mrp !== undefined && (typeof updates.mrp !== 'number' || updates.mrp <= 0)) {
      return res.status(400).json({ message: 'MRP must be a positive number' });
    }

    if ((updates.price !== undefined || updates.mrp !== undefined) && updates.price > updates.mrp) {
      return res.status(400).json({ message: 'Price cannot be greater than MRP' });
    }

    // Ensure imageUrlEnglish and imageUrlArabic are arrays if provided
    if (updates.imageUrlEnglish !== undefined && !Array.isArray(updates.imageUrlEnglish)) {
      return res.status(400).json({ message: 'imageUrlEnglish must be an array' });
    }

    if (updates.imageUrlArabic !== undefined && !Array.isArray(updates.imageUrlArabic)) {
      return res.status(400).json({ message: 'imageUrlArabic must be an array' });
    }

    const updatedVariant = await ProductVariants.findByIdAndUpdate(id, updates, { new: true })
      .select('nameEnglish nameArabic shortDescriptionEnglish shortDescriptionArabic color stock price mrp status imageUrlEnglish imageUrlArabic product createdAt updatedAt')
      .populate('product', 'nameEnglish nameArabic');
    if (!updatedVariant) {
      return res.status(404).json({ message: 'Product variant not found' });
    }
    res.json(updatedVariant);
  } catch (error) {
    console.error('Update product variant error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Delete product variant (soft delete by setting status to inactive)
const deleteProductVariant = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedVariant = await ProductVariants.findByIdAndUpdate(id, { status: 'inactive' }, { new: true });
    if (!deletedVariant) {
      return res.status(404).json({ message: 'Product variant not found' });
    }
    res.json({ message: 'Product variant deleted successfully' });
  } catch (error) {
    console.error('Delete product variant error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  getAllProductVariants,
  getVariantsByProductId,
  getProductVariantById,
  createProductVariant,
  updateProductVariant,
  deleteProductVariant
};