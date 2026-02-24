
const Banner = require('../../model/bannerModel');
const Category = require('../../model/categoryModel');
const Brand = require('../../model/brandModel');
const Product = require('../../model/productModel');
const ProductVariants = require('../../model/productVariantsModel');

const getHome = async (req, res) => {
  try {
    // Get active banners sorted by sortOrder
    const banners = await Banner.find({ status: 'active' }).sort({ sortOrder: 1 }).limit(10);

    // Get active categories
    const categories = await Category.find({ status: 'active' }).limit(10);

    // Get active brands
    const brands = await Brand.find({ status: 'active' }).limit(10);

    // Get new products (latest 10)
    const newProducts = await Product.find({ status: 'active', isNew: true })
      .populate('category', 'nameEnglish nameArabic')
      .populate('brand', 'nameEnglish nameArabic')
      .sort({ createdAt: -1 })
      .limit(10);

    // Get featured products with variants and pricing
    const featuredProducts = await Product.find({ status: 'active' })
      .populate('category', 'nameEnglish nameArabic')
      .populate('brand', 'nameEnglish nameArabic')
      .limit(10);

    // Enrich products with variant data (price, stock, etc.)
    const enrichedFeaturedProducts = await Promise.all(
      featuredProducts.map(async (product) => {
        const variants = await ProductVariants.find({
          product: product._id,
          status: 'active'
        });

        return {
          ...product.toObject(),
          variants: variants.map(v => ({
            _id: v._id,
            nameEnglish: v.nameEnglish,
            nameArabic: v.nameArabic,
            color: v.color,
            stock: v.stock,
            price: v.price,
            mrp: v.mrp
          })),
          minPrice: variants.length > 0 ? Math.min(...variants.map(v => v.price)) : null,
          maxPrice: variants.length > 0 ? Math.max(...variants.map(v => v.mrp)) : null,
          totalStock: variants.reduce((sum, v) => sum + v.stock, 0)
        };
      })
    );

    // Enrich new products with variant data
    const enrichedNewProducts = await Promise.all(
      newProducts.map(async (product) => {
        const variants = await ProductVariants.find({
          product: product._id,
          status: 'active'
        });

        return {
          ...product.toObject(),
          variants: variants.map(v => ({
            _id: v._id,
            nameEnglish: v.nameEnglish,
            nameArabic: v.nameArabic,
            color: v.color,
            stock: v.stock,
            price: v.price,
            mrp: v.mrp
          })),
          minPrice: variants.length > 0 ? Math.min(...variants.map(v => v.price)) : null,
          maxPrice: variants.length > 0 ? Math.max(...variants.map(v => v.mrp)) : null,
          totalStock: variants.reduce((sum, v) => sum + v.stock, 0)
        };
      })
    );

    res.json({
      banners,
      categories,
      brands,
      newProducts: enrichedNewProducts,
      featuredProducts: enrichedFeaturedProducts,
    });
  } catch (error) {
    console.error('Get home error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  getHome
};