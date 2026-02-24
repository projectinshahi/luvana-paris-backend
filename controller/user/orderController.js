const Order = require('../../model/orderModel');
const Cart = require('../../model/cartModel');
const Coupon = require('../../model/couponModel');
const UserAddress = require('../../model/userAddressModel');
const Product = require('../../model/productModel');
const ProductVariants = require('../../model/productVariantsModel');

const generateOrderId = () => {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ORD-${Date.now()}-${suffix}`;
};

// Create new order
const createOrder = async (req, res) => {
  try {
    const userId = req.user._id;
    const { items, shippingAddress, coupon, shippingCharges = 0 } = req.body;

    if (!shippingAddress) {
      return res.status(400).json({ message: 'Shipping address is required' });
    }

    const address = await UserAddress.findOne({
      _id: shippingAddress,
      user: userId,
      status: 'active'
    });

    if (!address) {
      return res.status(404).json({ message: 'Shipping address not found' });
    }

    let orderItems = Array.isArray(items) ? items : [];

    if (orderItems.length === 0) {
      return res.status(400).json({ message: 'Order items are required' });
    }

    const variantIds = orderItems.map(item => item.variant).filter(Boolean);
    if (variantIds.length === 0) {
      return res.status(400).json({ message: 'Variant is required for each item' });
    }

    const variants = await ProductVariants.find({
      _id: { $in: variantIds },
      status: 'active'
    });

    if (variants.length !== variantIds.length) {
      return res.status(404).json({ message: 'One or more variants not found' });
    }

    const variantsById = variants.reduce((acc, variant) => {
      acc[String(variant._id)] = variant;
      return acc;
    }, {});

    const productIds = variants.map(variant => variant.product);
    const products = await Product.find({ _id: { $in: productIds }, status: 'active' });
    const productsById = products.reduce((acc, product) => {
      acc[String(product._id)] = product;
      return acc;
    }, {});

    let subtotal = 0;
    let itemDiscountTotal = 0;

    const normalizedItems = orderItems.map((item) => {
      const variant = variantsById[String(item.variant)];
      if (!variant) {
        return null;
      }

      const quantity = Number(item.quantity) || 0;
      if (quantity <= 0 || !Number.isInteger(quantity)) {
        return null;
      }

      if (variant.stock !== undefined && variant.stock < quantity) {
        return { error: `Insufficient stock for variant ${variant._id}` };
      }

      const product = productsById[String(variant.product)];
      if (!product) {
        return null;
      }

      const productImageEnglish = Array.isArray(product.imageUrlEnglish) && product.imageUrlEnglish[0]
        ? product.imageUrlEnglish[0].imageUrl
        : undefined;
      const productImageArabic = Array.isArray(product.imageUrlArabic) && product.imageUrlArabic[0]
        ? product.imageUrlArabic[0].imageUrl
        : undefined;

      const linePrice = variant.price * quantity;
      const lineDiscount = variant.mrp ? (variant.mrp - variant.price) * quantity : 0;

      subtotal += linePrice;
      itemDiscountTotal += lineDiscount;

      return {
        product: product._id,
        productNameEnglish: product.nameEnglish,
        productNameArabic: product.nameArabic,
        productImageEnglish,
        productImageArabic,
        variant: variant._id,
        quantity,
        price: linePrice,
        discount: lineDiscount
      };
    });

    if (normalizedItems.some(item => item === null)) {
      return res.status(400).json({ message: 'Invalid order items' });
    }

    const stockError = normalizedItems.find(item => item && item.error);
    if (stockError) {
      return res.status(400).json({ message: stockError.error });
    }

    let couponDiscount = 0;
    let couponId = null;

    if (coupon) {
      const couponData = await Coupon.findOne({ _id: coupon, status: 'active' });
      if (!couponData) {
        return res.status(404).json({ message: 'Coupon not found' });
      }

      if (couponData.minimumPurchase && subtotal < couponData.minimumPurchase) {
        return res.status(400).json({ message: 'Minimum purchase requirement not met' });
      }

      couponDiscount = (subtotal * couponData.discount) / 100;
      couponId = couponData._id;
    }

    const totalPrice = subtotal - couponDiscount + Number(shippingCharges || 0);

    const order = new Order({
      orderId: generateOrderId(),
      user: userId,
      coupon: couponId,
      shippingAddress: address._id,
      price: totalPrice,
      discount: itemDiscountTotal + couponDiscount,
      shippingCharges: Number(shippingCharges || 0),
      status: 'pending',
      paymentStatus: 'pending',
      orderItem: normalizedItems
    });

    const savedOrder = await order.save();

    await Cart.deleteMany({
      user: userId,
      variant: { $in: variantIds }
    });

    res.status(201).json({
      message: 'Order created successfully',
      order: savedOrder
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get all orders for user
const getOrders = async (req, res) => {
  try {
    const userId = req.user._id;

    const orders = await Order.find({ user: userId })
      .populate('shippingAddress')
      .populate('coupon', 'code discount')
      .populate('orderItem.product', 'nameEnglish nameArabic')
      .sort({ createdAt: -1 });

    res.json({
      orders
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  createOrder,
  getOrders
};
