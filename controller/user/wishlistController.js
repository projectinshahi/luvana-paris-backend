const Wishlist = require('../../model/wshlistModel');
const Product = require('../../model/productModel');
const ProductVariants = require('../../model/productVariantsModel');

// Add item to wishlist
const addToWishlist = async (req, res) => {
  try {
    const { product, variant } = req.body;
    const userId = req.user._id;

    if (!product && !variant) {
      return res.status(400).json({ message: 'Product or variant is required' });
    }

    let productId = product || null;
    let variantId = variant || null;

    if (variantId) {
      const variantData = await ProductVariants.findById(variantId);
      if (!variantData) {
        return res.status(404).json({ message: 'Variant not found' });
      }
      productId = variantData.product;

      if (productId && product && String(productId) !== String(product)) {
        return res.status(400).json({ message: 'Product does not match variant' });
      }
    }

    if (productId) {
      const productData = await Product.findById(productId);
      if (!productData) {
        return res.status(404).json({ message: 'Product not found' });
      }
    }

    const existingItem = await Wishlist.findOne({
      user: userId,
      product: productId,
      variant: variantId
    });

    if (existingItem) {
      return res.status(409).json({ message: 'Item already in wishlist' });
    }

    const wishlistItem = new Wishlist({
      user: userId,
      product: productId,
      variant: variantId
    });

    await wishlistItem.save();

    res.status(201).json({
      message: 'Item added to wishlist',
      wishlistItem
    });
  } catch (error) {
    console.error('Add to wishlist error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get all wishlist items
const getWishlist = async (req, res) => {
  try {
    const userId = req.user._id;

    const wishlistItems = await Wishlist.find({ user: userId })
      .populate('product', 'nameEnglish nameArabic imageUrlEnglish imageUrlArabic')
      .populate('variant', 'nameEnglish nameArabic color price mrp stock');

    res.json({
      items: wishlistItems
    });
  } catch (error) {
    console.error('Get wishlist error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Remove item from wishlist
const removeFromWishlist = async (req, res) => {
  try {
    const { wishlistItemId } = req.params;
    const userId = req.user._id;

    const wishlistItem = await Wishlist.findOneAndDelete({
      _id: wishlistItemId,
      user: userId
    });

    if (!wishlistItem) {
      return res.status(404).json({ message: 'Wishlist item not found' });
    }

    res.json({ message: 'Item removed from wishlist' });
  } catch (error) {
    console.error('Remove from wishlist error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  addToWishlist,
  getWishlist,
  removeFromWishlist
};
