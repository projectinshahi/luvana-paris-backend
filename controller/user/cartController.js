const Cart = require('../../model/cartModel');
const ProductVariants = require('../../model/productVariantsModel');
const Coupon = require('../../model/couponModel');

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

    // Get variant details to validate stock
    const variantData = await ProductVariants.findById(variant);
    if (!variantData) {
      return res.status(404).json({ message: 'Variant not found' });
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
const getCart = async (req, res) => {
  try {
    const userId = '699ba09e0f60cad1fb5f3c46';//req.user._id; // Assuming authentication middleware sets req.user

    // Get all cart items for user
    const cartItems = await Cart.find({ user: userId })
      .populate('product', 'nameEnglish nameArabic')
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

    // Calculate prices for each item
    const enrichedItems = cartItems.map(item => {
      const variant = item.variant;
      const itemPrice = variant.price * item.quantity;
      const mrpPrice = variant.mrp * item.quantity;
      const itemDiscount = mrpPrice - itemPrice;

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
          imageUrlArabic: variant.imageUrlArabic
        },
        quantity: item.quantity,
        itemPrice,
        mrpPrice,
        itemDiscount,
        coupon: item.coupon
      };
    });

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
        subtotal: Number(subtotal.toFixed(2)),
        mrpTotal: Number(totalMrp.toFixed(2)),
        discount: Number(discount.toFixed(2)),
        discountPercentage: totalMrp > 0 ? Number(((discount / totalMrp) * 100).toFixed(2)) : 0,
        couponCode: couponCode,
        couponDiscount: Number(couponDiscount.toFixed(2)),
        tax: Number(tax.toFixed(2)),
        total: Number(total.toFixed(2))
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

module.exports = {
  addToCart,
  getCart,
  removeFromCart,
  updateCartItem,
  clearCart
};