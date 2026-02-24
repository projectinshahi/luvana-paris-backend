const Product = require('../../model/productModel');
const ProductVariants = require('../../model/productVariantsModel');

// Get products list with pagination and filters
const getProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      minPrice,
      maxPrice,
      category,
      brand,
      search
    } = req.query;

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const limitNumber = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);

    const productQuery = { status: 'active' };

    if (category) {
      productQuery.category = category;
    }

    if (brand) {
      productQuery.brand = brand;
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      productQuery.$or = [
        { nameEnglish: searchRegex },
        { nameArabic: searchRegex }
      ];
    }

    const hasMinPrice = minPrice !== undefined && minPrice !== '';
    const hasMaxPrice = maxPrice !== undefined && maxPrice !== '';
    if (hasMinPrice || hasMaxPrice) {
      const priceFilter = { status: 'active' };
      if (hasMinPrice) {
        priceFilter.price = { ...priceFilter.price, $gte: Number(minPrice) };
      }
      if (hasMaxPrice) {
        priceFilter.price = { ...priceFilter.price, $lte: Number(maxPrice) };
      }

      const productIds = await ProductVariants.distinct('product', priceFilter);
      if (productIds.length === 0) {
        return res.json({
          items: [],
          pagination: {
            page: pageNumber,
            limit: limitNumber,
            totalItems: 0,
            totalPages: 0
          }
        });
      }

      productQuery._id = { $in: productIds };
    }

    const totalItems = await Product.countDocuments(productQuery);
    const totalPages = Math.ceil(totalItems / limitNumber);

    const products = await Product.find(productQuery)
      .populate('category', 'nameEnglish nameArabic')
      .populate('brand', 'nameEnglish nameArabic')
      .sort({ createdAt: -1 })
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber);

    const productIds = products.map(p => p._id);
    const variants = await ProductVariants.find({
      product: { $in: productIds },
      status: 'active'
    }).select('product nameEnglish nameArabic color stock price mrp');

    const variantsByProduct = variants.reduce((acc, variant) => {
      const key = String(variant.product);
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(variant);
      return acc;
    }, {});

    const enrichedProducts = products.map((product) => {
      const productVariants = variantsByProduct[String(product._id)] || [];
      // const prices = productVariants.map(v => v.price);
      // const mrps = productVariants.map(v => v.mrp);

      return {
        ...product.toObject(),
        variants: productVariants,
        // minPrice: prices.length > 0 ? Math.min(...prices) : null,
        // maxPrice: mrps.length > 0 ? Math.max(...mrps) : null,
        totalStock: productVariants.reduce((sum, v) => sum + v.stock, 0)
      };
    });

    res.json({
      items: enrichedProducts,
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
  getProducts,
  getProductDetails
};