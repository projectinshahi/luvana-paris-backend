const Order = require('../../model/orderModel');
const Cart = require('../../model/cartModel');
const Coupon = require('../../model/couponModel');
const UserAddress = require('../../model/userAddressModel');
const Product = require('../../model/productModel');
const ProductVariants = require('../../model/productVariantsModel');
const PendingPayment = require('../../model/pendingPaymentModel');
const { loadCurrencyConverter } = require('./currencyConversions');


const generateOrderId = () => {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ORD-${Date.now()}-${suffix}`;
};

// Create new order
const createOrder = async (req, res) => {
  try {
    const userId = req.user._id;
    const { items, shippingAddress, coupon, shippingCharges = 0, paymentReference, paymentProvider: providerFromBody, myfPaymentId } = req.body;
    const provider = providerFromBody || 'tap';

    // ── 1. Basic presence checks ─────────────────────────────────────────────
    if (!shippingAddress) return res.status(400).json({ message: 'Shipping address is required' });
    if (!paymentReference) return res.status(400).json({ message: 'Payment reference is required' });

    const address = await UserAddress.findOne({ _id: shippingAddress, user: userId, status: 'active' });
    if (!address) return res.status(404).json({ message: 'Shipping address not found' });

    const orderItems = Array.isArray(items) ? items : [];
    if (orderItems.length === 0) return res.status(400).json({ message: 'Order items are required' });

    const variantIds = orderItems.map(item => item.variant).filter(Boolean);
    if (variantIds.length === 0) return res.status(400).json({ message: 'Variant is required for each item' });

    // ── 2. Idempotency — before any external API calls ────────────────────────
    const existingOrder = await Order.findOne({
      $or: [{ paymentReference }, { tapChargeId: paymentReference }],
    });
    if (existingOrder) return res.status(200).json({ message: 'Order already created', order: existingOrder });

    // ── 3. Load variants (all must be active) ────────────────────────────────
    const variants = await ProductVariants.find({ _id: { $in: variantIds }, status: 'active' });
    if (variants.length !== variantIds.length) {
      return res.status(404).json({ message: 'One or more variants not found' });
    }
    const variantsById = variants.reduce((acc, v) => { acc[String(v._id)] = v; return acc; }, {});

    // ── 4. Load products (active only) and build normalizedItems ─────────────
    const productIds = variants.map(v => v.product);
    const products = await Product.find({ _id: { $in: productIds }, status: 'active' });
    const productsById = products.reduce((acc, p) => { acc[String(p._id)] = p; return acc; }, {});

    let subtotal = 0, itemDiscountTotal = 0;
    // Product photos live on the variant; fall through to product if absent.
    const firstImage = (...lists) =>
      lists.map((list) => Array.isArray(list) && list[0] && list[0].imageUrl).find(Boolean) || undefined;

    const normalizedItems = orderItems.map((item) => {
      const variant = variantsById[String(item.variant)];
      if (!variant) return null;
      const quantity = Number(item.quantity) || 0;
      if (quantity <= 0 || !Number.isInteger(quantity)) return null;
      if (variant.stock !== undefined && variant.stock < quantity) {
        return { error: `Insufficient stock for variant ${variant._id}` };
      }
      const product = productsById[String(variant.product)];
      if (!product) return null;

      const productImageEnglish = firstImage(variant.imageUrlEnglish, product.imageUrlEnglish);
      const productImageArabic = firstImage(variant.imageUrlArabic, product.imageUrlArabic, variant.imageUrlEnglish, product.imageUrlEnglish);
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
        discount: lineDiscount,
      };
    });

    // ── 5. Detect inactive-item conflict BEFORE the amount check ─────────────
    // When items are null (inactive product), the backend subtotal is lower than
    // the amount the customer was actually charged — the amount check would fail even
    // for a legitimate payment. Verify MYF STATUS only here (skip amount), then
    // preserve the payment record for manual recovery.
    const hasNullItems = normalizedItems.some(item => item === null);

    if (hasNullItems && provider === 'myfatoorah' && myfPaymentId) {
      const myfService = require('../../services/myfatoorahService');
      let myfResult;
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          myfResult = await myfService.verifyPayment(myfPaymentId, 'PaymentId');
        } catch (myfErr) {
          console.error('[createOrder/nullItems] MYF verify error:', myfErr.message);
          return res.status(502).json({ message: 'Payment verification failed. Please try again or contact support.' });
        }
        const s = myfResult.invoiceStatus;
        if (s === 'Paid' || s === 'DuplicatePayment') break;
        if (s === 'Failed' || s === 'Cancelled' || s === 'Expired') break;
        if (attempt < 3) await new Promise(r => setTimeout(r, 2000));
      }
      const confirmed = myfResult.invoiceStatus === 'Paid' || myfResult.invoiceStatus === 'DuplicatePayment';
      if (!confirmed) {
        return res.status(400).json({ message: `Payment not confirmed by MyFatoorah (status: ${myfResult.invoiceStatus}). Order not created.` });
      }
      try {
        await PendingPayment.findOneAndUpdate(
          { paymentReference },
          {
            $setOnInsert: {
              paymentReference, myfPaymentId, userId,
              addressId: address._id,
              cartSnapshot: orderItems,
              amount: myfResult.invoiceValue,
              currency: myfResult.currency,
              myfInvoiceStatus: myfResult.invoiceStatus,
              invoiceId: String(myfResult.invoiceId || ''),
              failureReason: 'One or more items are inactive or unavailable',
              status: 'pending_review',
            },
          },
          { upsert: true }
        );
      } catch (ppErr) {
        console.error('[createOrder] PendingPayment save error (null items):', ppErr.message);
      }
      return res.status(202).json({
        status: 'pending_review',
        paymentReference,
        message: 'Payment received. Some items are unavailable. We will contact you within 24 hours.',
      });
    }

    if (hasNullItems) {
      return res.status(400).json({ message: 'Invalid order items' });
    }

    // ── 6. Coupon + total ────────────────────────────────────────────────────
    let couponDiscount = 0, couponId = null;
    if (coupon) {
      const couponData = await Coupon.findOne({ _id: coupon, status: 'active' });
      if (!couponData) return res.status(404).json({ message: 'Coupon not found' });
      if (couponData.minimumPurchase && subtotal < couponData.minimumPurchase) {
        return res.status(400).json({ message: 'Minimum purchase requirement not met' });
      }
      couponDiscount = (subtotal * couponData.discount) / 100;
      couponId = couponData._id;
    }
    const totalPrice = subtotal - couponDiscount + Number(shippingCharges || 0);

    // ── 7. Server-side payment verification ──────────────────────────────────
    let paymentStatus;

    if (provider === 'myfatoorah') {
      const myfService = require('../../services/myfatoorahService');
      const lookupKey = myfPaymentId || paymentReference;
      const keyType = myfPaymentId ? 'PaymentId' : 'InvoiceId';
      let myfResult;
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          myfResult = await myfService.verifyPayment(lookupKey, keyType);
        } catch (myfErr) {
          console.error('MyFatoorah verification error:', myfErr);
          return res.status(502).json({ message: 'Payment verification failed. Please try again or contact support.' });
        }
        const s = myfResult.invoiceStatus;
        if (s === 'Paid' || s === 'DuplicatePayment') break;
        if (s === 'Failed' || s === 'Cancelled' || s === 'Expired') break;
        if (attempt < 3) await new Promise(r => setTimeout(r, 2000));
      }

      console.log(`[MYF Order] verify result: status=${myfResult.invoiceStatus} invoiceValue=${myfResult.invoiceValue} currency=${myfResult.currency} totalPrice=${totalPrice} ref=${paymentReference}`);

      if (myfResult.invoiceStatus !== 'Paid' && myfResult.invoiceStatus !== 'DuplicatePayment') {
        return res.status(400).json({ message: `Payment not confirmed by MyFatoorah (status: ${myfResult.invoiceStatus}). Order not created.` });
      }

      // "KD" is how KNET reports Kuwait Dinar in InvoiceTransactions[0].Currency
      const tolerance = (['KWD', 'KD', 'BHD', 'OMR'].includes(myfResult.currency)) ? 0.001 : 0.01;
      if (Math.abs(myfResult.invoiceValue - totalPrice) > tolerance) {
        console.error(`[MYF] Amount mismatch: verified=${myfResult.invoiceValue}, expected=${totalPrice}, diff=${Math.abs(myfResult.invoiceValue - totalPrice)}, tolerance=${tolerance}, ref=${paymentReference}`);
        return res.status(400).json({ message: 'Payment amount mismatch. Order not created.' });
      }

      paymentStatus = 'paid';

      // Upsert PendingPayment AFTER successful verification. This durable record
      // covers any subsequent failure (stock race, save error) so recovery can
      // re-verify and recreate the order without charging the customer again.
      try {
        await PendingPayment.findOneAndUpdate(
          { paymentReference },
          {
            $setOnInsert: {
              paymentReference, myfPaymentId, userId,
              addressId: address._id,
              cartSnapshot: orderItems,
              amount: myfResult.invoiceValue,
              currency: myfResult.currency,
              myfInvoiceStatus: myfResult.invoiceStatus,
              invoiceId: String(myfResult.invoiceId || ''),
              status: 'pending_review',
            },
          },
          { upsert: true }
        );
      } catch (ppErr) {
        console.error('[createOrder] PendingPayment upsert error:', ppErr.message);
      }
    } else {
      let tapStatus;
      try {
        const tapRes = await fetch(`https://api.tap.company/v2/charges/${encodeURIComponent(paymentReference)}`, {
          headers: {
            Authorization: `Bearer ${process.env.TAP_SECRET_KEY}`,
            Accept: 'application/json',
          },
        });
        const tapData = await tapRes.json();
        tapStatus = tapData?.status;
      } catch (tapErr) {
        console.error('Tap verification error:', tapErr);
        return res.status(502).json({ message: 'Payment verification failed. Please try again or contact support.' });
      }
      if (tapStatus !== 'CAPTURED' && tapStatus !== 'AUTHORIZED') {
        return res.status(400).json({ message: `Payment not confirmed by Tap (status: ${tapStatus}). Order not created.` });
      }
      paymentStatus = tapStatus === 'CAPTURED' ? 'paid' : 'authorized';
    }

    // ── 8. Stock error check (after payment confirmed, PendingPayment exists) ─
    const stockError = normalizedItems.find(item => item && item.error);
    if (stockError) {
      if (provider === 'myfatoorah') {
        PendingPayment.findOneAndUpdate(
          { paymentReference },
          { $set: { failureReason: stockError.error } }
        ).catch(e => console.error('[createOrder] PP stock-error update failed:', e.message));
        return res.status(202).json({
          status: 'pending_review',
          paymentReference,
          message: 'Payment received. Item stock changed during checkout. We will contact you within 24 hours.',
        });
      }
      return res.status(400).json({ message: stockError.error });
    }

    // ── 9. Save order ────────────────────────────────────────────────────────
    const order = new Order({
      orderId: generateOrderId(),
      user: userId,
      coupon: couponId,
      shippingAddress: address._id,
      price: totalPrice,
      discount: itemDiscountTotal + couponDiscount,
      shippingCharges: Number(shippingCharges || 0),
      status: 'pending',
      paymentStatus,
      paymentReference,
      paymentProvider: provider,
      orderItem: normalizedItems,
    });

    let savedOrder;
    try {
      savedOrder = await order.save();
    } catch (saveErr) {
      if (saveErr.code === 11000) {
        // Race condition — another concurrent request saved this order first
        const dup = await Order.findOne({ $or: [{ paymentReference }, { tapChargeId: paymentReference }] });
        if (provider === 'myfatoorah' && dup) {
          PendingPayment.findOneAndUpdate(
            { paymentReference },
            { $set: { status: 'order_created', resolvedOrderId: dup.orderId } }
          ).catch(e => console.error('[createOrder] PP dup-key update failed:', e.message));
        }
        return res.status(200).json({ message: 'Order already created', order: dup });
      }
      // Transient DB failure — PendingPayment was already saved (MYF); route to recovery.
      if (provider === 'myfatoorah') {
        console.error('[createOrder] MYF order.save() failed, PendingPayment preserved for recovery:', saveErr.message);
        return res.status(202).json({
          status: 'pending_review',
          paymentReference,
          message: 'Payment received but order could not be saved. We will contact you within 24 hours.',
        });
      }
      throw saveErr;
    }

    // ── 10. Post-save cleanup ────────────────────────────────────────────────
    if (provider === 'myfatoorah') {
      PendingPayment.findOneAndUpdate(
        { paymentReference },
        { $set: { status: 'order_created', resolvedOrderId: savedOrder.orderId } }
      ).catch(e => console.error('[createOrder] PP order_created update failed:', e.message));
    }

    await Cart.deleteMany({ user: userId, variant: { $in: variantIds } });
    res.status(201).json({ message: 'Order created successfully', order: savedOrder });
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
      .populate('orderItem.variant', 'nameEnglish nameArabic size color price mrp stock imageUrlEnglish imageUrlArabic')
      .sort({ createdAt: -1 });
    const convert = await loadCurrencyConverter();

    // Enrich orders with currency conversions for variant data
    const enrichedOrders = await Promise.all(
      orders.map(async (order) => {
        const orderObj = order.toObject();
        if (orderObj.orderItem) {
          orderObj.orderItem = await Promise.all(
            orderObj.orderItem.map(async (item) => {
              if (item.variant && item.variant.price !== undefined && item.variant.mrp !== undefined) {
                item.variant.currency = convert(item.variant.mrp, item.variant.price);
              }
              return item;
            })
          );
        }
        return orderObj;
      })
    );

    res.json({
      orders: enrichedOrders
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// GET /user/order/lookup/:orderId — fetch a single order by human-readable orderId
const getOrderById = async (req, res) => {
  try {
    const userId = req.user._id;
    const { orderId } = req.params;
    const order = await Order.findOne({ orderId, user: userId })
      .populate('shippingAddress')
      .populate('coupon', 'code discount')
      .populate('orderItem.product', 'nameEnglish nameArabic')
      .populate('orderItem.variant', 'nameEnglish nameArabic size color price mrp stock');
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json({ order });
  } catch (error) {
    console.error('getOrderById error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// POST /user/order/retry-recovery
// Re-verifies a MYF payment and retries order creation from a PendingPayment record.
// Safe to call multiple times — idempotent via paymentReference unique index.
const retryRecovery = async (req, res) => {
  try {
    const userId = req.user._id;
    const { paymentReference, myfPaymentId: myfPmtIdBody } = req.body;

    if (!paymentReference) {
      return res.status(400).json({ message: 'paymentReference is required' });
    }

    const pp = await PendingPayment.findOne({ paymentReference, userId });
    if (!pp) {
      return res.status(404).json({ message: 'No pending payment found for this reference' });
    }

    if (pp.status === 'order_created') {
      const order = await Order.findOne({ paymentReference });
      return res.status(200).json({ status: 'order_created', order });
    }

    // Re-verify with MYF
    const myfService = require('../../services/myfatoorahService');
    const lookupKey = myfPmtIdBody || pp.myfPaymentId || paymentReference;
    const keyType = (myfPmtIdBody || pp.myfPaymentId) ? 'PaymentId' : 'InvoiceId';
    let myfResult;
    try {
      myfResult = await myfService.verifyPayment(lookupKey, keyType);
    } catch (err) {
      console.error('[retryRecovery] MYF verify error:', err);
      return res.status(502).json({ message: 'Payment re-verification failed. Please try again.' });
    }

    if (myfResult.invoiceStatus !== 'Paid' && myfResult.invoiceStatus !== 'DuplicatePayment') {
      return res.status(402).json({
        message: `Payment not confirmed by MyFatoorah (status: ${myfResult.invoiceStatus})`,
      });
    }

    // Idempotency: order may already exist from a concurrent request
    const existingOrder = await Order.findOne({ paymentReference });
    if (existingOrder) {
      await PendingPayment.findOneAndUpdate(
        { paymentReference },
        { status: 'order_created', resolvedOrderId: existingOrder.orderId }
      );
      return res.status(200).json({ status: 'order_created', order: existingOrder });
    }

    const address = await UserAddress.findById(pp.addressId);
    if (!address) {
      return res.status(404).json({ message: 'Shipping address not found' });
    }

    const cartSnapshot = pp.cartSnapshot || [];
    const variantIds = cartSnapshot.map(i => i.variant).filter(Boolean);
    const variants = await ProductVariants.find({ _id: { $in: variantIds }, status: 'active' });
    const variantsById = variants.reduce((acc, v) => { acc[String(v._id)] = v; return acc; }, {});

    const productIds = variants.map(v => v.product);
    const products = await Product.find({ _id: { $in: productIds }, status: 'active' });
    const productsById = products.reduce((acc, p) => { acc[String(p._id)] = p; return acc; }, {});

    let subtotal = 0;
    let itemDiscountTotal = 0;
    const firstImage = (...lists) =>
      lists.map((l) => Array.isArray(l) && l[0] && l[0].imageUrl).find(Boolean) || undefined;

    const normalizedItems = cartSnapshot.map((item) => {
      const variant = variantsById[String(item.variant)];
      if (!variant) return null;
      const qty = Number(item.quantity) || 0;
      if (qty <= 0 || !Number.isInteger(qty)) return null;
      const product = productsById[String(variant.product)];
      if (!product) return null;

      const linePrice = variant.price * qty;
      const lineDiscount = variant.mrp ? (variant.mrp - variant.price) * qty : 0;
      subtotal += linePrice;
      itemDiscountTotal += lineDiscount;

      return {
        product: product._id,
        productNameEnglish: product.nameEnglish,
        productNameArabic: product.nameArabic,
        productImageEnglish: firstImage(variant.imageUrlEnglish, product.imageUrlEnglish),
        productImageArabic: firstImage(variant.imageUrlArabic, product.imageUrlArabic, variant.imageUrlEnglish, product.imageUrlEnglish),
        variant: variant._id,
        quantity: qty,
        price: linePrice,
        discount: lineDiscount,
      };
    });

    if (normalizedItems.some(i => i === null)) {
      await PendingPayment.findOneAndUpdate(
        { paymentReference },
        { failureReason: 'Items still unavailable at retry' }
      );
      return res.status(202).json({
        status: 'pending_review',
        paymentReference,
        message: 'Items are still unavailable. Your payment is recorded and we will contact you.',
      });
    }

    const order = new Order({
      orderId: generateOrderId(),
      user: userId,
      shippingAddress: address._id,
      price: subtotal,
      discount: itemDiscountTotal,
      shippingCharges: 0,
      status: 'pending',
      paymentStatus: 'paid',
      paymentReference,
      paymentProvider: 'myfatoorah',
      orderItem: normalizedItems,
    });

    let savedOrder;
    try {
      savedOrder = await order.save();
    } catch (saveErr) {
      if (saveErr.code === 11000) {
        const dup = await Order.findOne({ paymentReference });
        await PendingPayment.findOneAndUpdate(
          { paymentReference },
          { status: 'order_created', resolvedOrderId: dup?.orderId }
        );
        return res.status(200).json({ status: 'order_created', order: dup });
      }
      throw saveErr;
    }

    await PendingPayment.findOneAndUpdate(
      { paymentReference },
      { status: 'order_created', resolvedOrderId: savedOrder.orderId }
    );
    await Cart.deleteMany({ user: userId, variant: { $in: variantIds } });

    return res.status(201).json({ status: 'order_created', order: savedOrder });
  } catch (err) {
    console.error('retryRecovery error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// GET /user/order/pending/:paymentReference
// Returns the PendingPayment status for a confirmed MYF payment so the
// /payment/processing page can poll and redirect when the order is created.
const getPendingPayment = async (req, res) => {
  try {
    const userId = req.user._id;
    const { paymentReference } = req.params;
    if (!paymentReference) {
      return res.status(400).json({ message: 'paymentReference is required' });
    }
    const pp = await PendingPayment.findOne({ paymentReference, userId }).lean();
    if (!pp) return res.status(404).json({ message: 'Not found' });
    res.json({
      status: pp.status,
      resolvedOrderId: pp.resolvedOrderId || null,
      paymentReference: pp.paymentReference,
    });
  } catch (err) {
    console.error('getPendingPayment error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  createOrder,
  getOrders,
  getOrderById,
  retryRecovery,
  getPendingPayment,
};
