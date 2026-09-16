
const Banner = require('../../model/bannerModel');
const Category = require('../../model/categoryModel');
const Brand = require('../../model/brandModel');
const Product = require('../../model/productModel');
const ProductVariants = require('../../model/productVariantsModel');
const Influencer = require('../../model/influencerModel');
const { loadCurrencyConverter } = require('./currencyConversions');

const BRAND_FIELDS = 'nameEnglish nameArabic logoUrlEnglish logoUrlArabic brandImageEnglish brandImageArabic';

const getHome = async (req, res) => {
  try {
    // Independent reads run together. Each database round-trip costs ~55 ms and
    // these used to run one after another (32 queries in all for this endpoint).
    const [banners, categories, brands, newProducts, featuredProducts, influencers, convert] = await Promise.all([
      // Active banners sorted by sortOrder
      Banner.find({ status: 'active' }).sort({ sortOrder: 1 }).limit(10),
      // Active categories
      Category.find({ status: 'active' }).limit(10),
      // Active brands
      Brand.find({ status: 'active' }).limit(10),
      // New products (latest 10)
      Product.find({ status: 'active', isNew: true })
        .populate('category', 'nameEnglish nameArabic')
        .populate('brand', BRAND_FIELDS)
        .sort({ createdAt: -1 })
        .limit(10),
      // Featured products
      Product.find({ status: 'active', isFeatured: true })
        .populate('category', 'nameEnglish nameArabic')
        .populate('brand', BRAND_FIELDS)
        .limit(10),
      // Active influencers sorted by sortOrder
      Influencer.find({ status: 'active' })
        .populate('product', 'nameEnglish nameArabic')
        .populate('variant', 'nameEnglish nameArabic color price mrp imageUrlEnglish imageUrlArabic')
        .sort({ sortOrder: 1 })
        .select('titleEnglish titleArabic product variant videoUrl'),
      loadCurrencyConverter()
    ]);

    // Variants for every listed product in one query instead of one per product
    const variants = await ProductVariants.find({
      product: { $in: [...featuredProducts, ...newProducts].map((product) => product._id) },
      status: 'active'
    });
    const variantsByProduct = new Map();
    for (const variant of variants) {
      const key = String(variant.product);
      if (!variantsByProduct.has(key)) variantsByProduct.set(key, []);
      variantsByProduct.get(key).push(variant);
    }

    // Enrich products with variant data (price, stock, etc.)
    const enrich = (product) => {
      const productVariants = variantsByProduct.get(String(product._id)) || [];
      return {
        ...product.toObject(),
        variants: productVariants.map((v) => ({
          _id: v._id,
          nameEnglish: v.nameEnglish,
          nameArabic: v.nameArabic,
          color: v.color,
          stock: v.stock,
          price: v.price,
          mrp: v.mrp,
          imageUrlEnglish: v.imageUrlEnglish,
          imageUrlArabic: v.imageUrlArabic,
          currency: convert(v.mrp, v.price)
        })),
        minPrice: productVariants.length > 0 ? Math.min(...productVariants.map(v => v.price)) : null,
        maxPrice: productVariants.length > 0 ? Math.max(...productVariants.map(v => v.mrp)) : null,
        totalStock: productVariants.reduce((sum, v) => sum + v.stock, 0)
      };
    };

    res.json({
      banners,
      categories,
      brands,
      newProducts: newProducts.map(enrich),
      featuredProducts: featuredProducts.map(enrich),
      influencers
    });
  } catch (error) {
    console.error('Get home error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  getHome
};