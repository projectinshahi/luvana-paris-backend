const Product = require('../../model/productModel');
const ProductVariants = require('../../model/productVariantsModel');

// Get single product details with similar products
const getProductDetails = async (req, res) => {
  try {
    const { id } = req.params;

    // Get product by ID with populated references
    const product = await Product.findById(id)
      .populate('category', 'nameEnglish nameArabic')
      .populate('brand', 'nameEnglish nameArabic');

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (product.status !== 'active') {
      return res.status(404).json({ message: 'Product not available' });
    }

    // Get all variants for this product
    const variants = await ProductVariants.find({
      product: product._id,
      status: 'active'
    });

    // Enrich product with variant data
    const enrichedProduct = {
      ...product.toObject(),
      variants: variants.map(v => ({
        _id: v._id,
        nameEnglish: v.nameEnglish,
        nameArabic: v.nameArabic,
        shortDescriptionEnglish: v.shortDescriptionEnglish,
        shortDescriptionArabic: v.shortDescriptionArabic,
        color: v.color,
        stock: v.stock,
        price: v.price,
        mrp: v.mrp,
        discount: v.mrp ? Math.round(((v.mrp - v.price) / v.mrp) * 100) : 0
      })),
      minPrice: variants.length > 0 ? Math.min(...variants.map(v => v.price)) : null,
      maxPrice: variants.length > 0 ? Math.max(...variants.map(v => v.mrp)) : null,
      totalStock: variants.reduce((sum, v) => sum + v.stock, 0),
      averageDiscount: variants.length > 0 
        ? Math.round(
            variants.reduce((sum, v) => sum + (v.mrp ? ((v.mrp - v.price) / v.mrp) * 100 : 0), 0) / variants.length
          )
        : 0
    };

    // Get similar products from same category
    const similarProducts = await Product.find({
      _id: { $ne: product._id },
      category: product.category._id,
      status: 'active'
    })
      .populate('category', 'nameEnglish nameArabic')
      .populate('brand', 'nameEnglish nameArabic')
      .limit(8);

    // Enrich similar products with variant data
    const enrichedSimilarProducts = await Promise.all(
      similarProducts.map(async (p) => {
        const pVariants = await ProductVariants.find({
          product: p._id,
          status: 'active'
        });

        return {
          ...p.toObject(),
          variants: pVariants.map(v => ({
            _id: v._id,
            nameEnglish: v.nameEnglish,
            nameArabic: v.nameArabic,
            color: v.color,
            stock: v.stock,
            price: v.price,
            mrp: v.mrp,
            discount: v.mrp ? Math.round(((v.mrp - v.price) / v.mrp) * 100) : 0
          })),
          minPrice: pVariants.length > 0 ? Math.min(...pVariants.map(v => v.price)) : null,
          maxPrice: pVariants.length > 0 ? Math.max(...pVariants.map(v => v.mrp)) : null,
          totalStock: pVariants.reduce((sum, v) => sum + v.stock, 0)
        };
      })
    );

    res.json({
      product: enrichedProduct,
      similarProducts: enrichedSimilarProducts,
    });
  } catch (error) {
    console.error('Get product details error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  getProductDetails
};