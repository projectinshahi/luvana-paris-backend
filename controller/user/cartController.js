const Cart = require('../../model/cartModel');
const ProductVariants = require('../../model/productVariantsModel');
const Product = require('../../model/productModel');
const Coupon = require('../../model/couponModel');
const { loadCurrencyConverter } = require('./currencyConversions');


// Add to cart
const addToCart = async (req, res) => {
  try {
    const { variant, quantity, coupon } = req.body;
    const userId = req.user._id; // Assuming authentication middleware sets req.user

    // Validation
    if (!variant || !quantity) {
      return res.status(400).json({ message: 'Variant and quantity are required' });
    }

    if (typeof quantity !== 'number' || quantity <= 0 || !Number.isInteger(quantity)) {
      return res.status(400).json({ message: 'Quantity must be a positive integer' });
    }

    // Get variant details to validate status and stock
    const variantData = await ProductVariants.findById(variant);
    if (!variantData) {
      return res.status(404).json({ message: 'Variant not found' });
    }

    if (variantData.status !== 'active') {
      return res.status(400).json({ message: 'This item is no longer available' });
    }

    const productData = await Product.findById(variantData.product).select('status').lean();
    if (!productData || productData.status !== 'active') {
      return res.status(400).json({ message: 'This product is no longer available' });
    }

    if (variantData.stock < quantity) {
      return res.status(400).json({ message: `Insufficient stock. Available: ${variantData.stock}` });
    }

    // Check if item already in cart
    let cartItem = await Cart.findOne({
      user: userId,
      variant: variant
    });

    if (cartItem) {
      // Update quantity if already exists
      const newQuantity = cartItem.quantity + quantity;
      if (variantData.stock < newQuantity) {
        return res.status(400).json({ message: `Insufficient stock. Maximum available: ${variantData.stock}` });
      }
      cartItem.quantity = newQuantity;
    } else {
      // Create new cart item
      cartItem = new Cart({
        user: userId,
        product: variantData.product,
        variant: variant,
        quantity: quantity,
        coupon: coupon || null
      });
    }

    await cartItem.save();

    res.status(201).json({
      message: 'Item added to cart successfully',
      cartItem
    });
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get cart with all calculations
const CART_DP = { KWD: 3, BHD: 3, OMR: 3 };
function cartRound(n, currency = 'KWD') {
  const dp = CART_DP[currency] ?? 2;
  return Number(n.toFixed(dp));
}

const getCart = async (req, res) => {
  try {
    const userId = req.user._id; // Assuming authentication middleware sets req.user

    // Get all cart items for user
    const cartItems = await Cart.find({ user: userId })
      .populate('product', 'nameEnglish nameArabic status')
      .populate('variant')
      .populate('coupon');

    if (cartItems.length === 0) {
      return res.json({
        items: [],
        summary: {
          subtotal: 0,
          discount: 0,
          tax: 0,
          total: 0,
          itemCount: 0
        }
      });
    }

    const convert = await loadCurrencyConverter();

    // Calculate prices for each item; flag unavailable items so the frontend
    // can inform the customer without silently removing their cart data.
    const enrichedItems = await Promise.all(
      cartItems.map(async (item) => {
        const variant = item.variant;
        const itemPrice = variant.price * item.quantity;
        const mrpPrice = variant.mrp * item.quantity;
        const itemDiscount = mrpPrice - itemPrice;

        let unavailable = null;
        if (variant.status !== 'active') {
          unavailable = 'variant_inactive';
        } else if (item.product && item.product.status !== 'active') {
          unavailable = 'product_inactive';
        } else if (variant.stock !== undefined && variant.stock < item.quantity) {
          unavailable = 'out_of_stock';
        }

        return {
          _id: item._id,
          product: item.product,
          variant: {
            _id: variant._id,
            nameEnglish: variant.nameEnglish,
            nameArabic: variant.nameArabic,
            color: variant.color,
            price: variant.price,
            mrp: variant.mrp,
            imageUrlEnglish: variant.imageUrlEnglish,
            imageUrlArabic: variant.imageUrlArabic,
            currency: convert(variant.mrp, variant.price)
          },
          quantity: item.quantity,
          itemPrice,
          mrpPrice,
          itemDiscount,
          coupon: item.coupon,
          unavailable,
        };
      })
    );

    // Calculate subtotal (selling price)
    let subtotal = enrichedItems.reduce((sum, item) => sum + item.itemPrice, 0);

    // Calculate total original price (MRP)
    let totalMrp = enrichedItems.reduce((sum, item) => sum + item.mrpPrice, 0);

    // Calculate discount (MRP - Selling Price)
    let discount = totalMrp - subtotal;

    // Apply coupon discount if exists
    let couponDiscount = 0;
    let couponCode = null;
    const couponItem = enrichedItems.find(item => item.coupon);
    if (couponItem && couponItem.coupon) {
      const coupon = couponItem.coupon;
      couponDiscount = (subtotal * coupon.discount) / 100;
      couponCode = coupon.code;
    }

    // Calculate tax (assuming 10% tax)
    const taxRate = 0.10;
    const tax = (subtotal - couponDiscount) * taxRate;

    // Calculate final total
    const total = subtotal - couponDiscount + tax;

    res.json({
      items: enrichedItems,
      summary: {
        itemCount: enrichedItems.length,
        totalQuantity: enrichedItems.reduce((sum, item) => sum + item.quantity, 0),
        subtotal: cartRound(subtotal),
        mrpTotal: cartRound(totalMrp),
        discount: cartRound(discount),
        discountPercentage: totalMrp > 0 ? Number(((discount / totalMrp) * 100).toFixed(2)) : 0,
        couponCode: couponCode,
        couponDiscount: cartRound(couponDiscount),
        tax: cartRound(tax),
        total: cartRound(total)
      }
    });
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Remove from cart
const removeFromCart = async (req, res) => {
  try {
    const { cartItemId } = req.params;
    const userId = req.user._id;

    const cartItem = await Cart.findOneAndDelete({
      _id: cartItemId,
      user: userId
    });

    if (!cartItem) {
      return res.status(404).json({ message: 'Cart item not found' });
    }

    res.json({ message: 'Item removed from cart' });
  } catch (error) {
    console.error('Remove from cart error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Update cart item quantity
const updateCartItem = async (req, res) => {
  try {
    const { cartItemId } = req.params;
    const { quantity } = req.body;
    const userId = req.user._id;

    // Validation
    if (!quantity || typeof quantity !== 'number' || quantity <= 0 || !Number.isInteger(quantity)) {
      return res.status(400).json({ message: 'Quantity must be a positive integer' });
    }

    const cartItem = await Cart.findOne({
      _id: cartItemId,
      user: userId
    }).populate('variant');

    if (!cartItem) {
      return res.status(404).json({ message: 'Cart item not found' });
    }

    // Reject updates to inactive or unavailable items
    if (cartItem.variant.status !== 'active') {
      return res.status(400).json({ message: 'This item is no longer available' });
    }

    const productData = await Product.findById(cartItem.variant.product).select('status').lean();
    if (!productData || productData.status !== 'active') {
      return res.status(400).json({ message: 'This product is no longer available' });
    }

    // Check stock availability
    if (cartItem.variant.stock < quantity) {
      return res.status(400).json({ message: `Insufficient stock. Available: ${cartItem.variant.stock}` });
    }

    cartItem.quantity = quantity;
    await cartItem.save();

    res.json({
      message: 'Cart item updated',
      cartItem
    });
  } catch (error) {
    console.error('Update cart error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Clear cart
const clearCart = async (req, res) => {
  try {
    const userId = req.user._id;

    await Cart.deleteMany({ user: userId });

    res.json({ message: 'Cart cleared successfully' });
  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Validate cart items before payment — checks active status and stock
// POST /user/cart/validate  body: { items: [{ variant, quantity }] }
const validateCart = async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'items array is required' });
    }

    const variantIds = items.map(i => i.variant).filter(Boolean);
    const variants = await ProductVariants.find({ _id: { $in: variantIds } })
      .populate('product', 'nameEnglish status');

    const variantsById = variants.reduce((acc, v) => { acc[String(v._id)] = v; return acc; }, {});

    const unavailable = [];
    for (const item of items) {
      const vid = String(item.variant);
      const variant = variantsById[vid];

      if (!variant) {
        unavailable.push({ variantId: vid, name: 'Unknown item', reason: 'not_found' });
        continue;
      }
      if (variant.status !== 'active') {
        const name = variant.nameEnglish || variant.nameArabic || 'Item';
        unavailable.push({ variantId: vid, name, reason: 'variant_inactive' });
        continue;
      }
      if (variant.product && variant.product.status !== 'active') {
        const name = variant.product.nameEnglish || variant.nameEnglish || 'Item';
        unavailable.push({ variantId: vid, name, reason: 'product_inactive' });
        continue;
      }
      if (variant.stock !== undefined && variant.stock < Number(item.quantity || 1)) {
        const name = variant.nameEnglish || 'Item';
        unavailable.push({ variantId: vid, name, reason: 'out_of_stock' });
      }
    }

    return res.json({ valid: unavailable.length === 0, unavailable });
  } catch (error) {
    console.error('validateCart error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  addToCart,
  getCart,
  removeFromCart,
  updateCartItem,
  clearCart,
  validateCart,
};