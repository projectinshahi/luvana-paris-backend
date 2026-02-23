const Coupon = require('../../model/couponModel');

// Get all coupons
const getAllCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find({ status: 'active' });
    res.json(coupons);
  } catch (error) {
    console.error('Get coupons error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get coupon by ID
const getCouponById = async (req, res) => {
  try {
    const { id } = req.params;
    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }
    res.json(coupon);
  } catch (error) {
    console.error('Get coupon error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Create new coupon
const createCoupon = async (req, res) => {
  try {
    const { name, code, discount, usage, validity, minimumPurchase, status } = req.body;

    // Validation
    if (!name || !code || discount === undefined || usage === undefined || !validity || minimumPurchase === undefined) {
      return res.status(400).json({ message: 'All fields are required: name, code, discount, usage, validity, minimumPurchase' });
    }

    if (typeof discount !== 'number' || discount <= 0) {
      return res.status(400).json({ message: 'Discount must be a positive number' });
    }

    if (typeof usage !== 'number' || usage <= 0 || !Number.isInteger(usage)) {
      return res.status(400).json({ message: 'Usage must be a positive integer' });
    }

    if (typeof minimumPurchase !== 'number' || minimumPurchase < 0) {
      return res.status(400).json({ message: 'Minimum purchase must be a non-negative number' });
    }

    const validityDate = new Date(validity);

    if (validityDate <= new Date()) {
      return res.status(400).json({ message: 'Validity date must be in the future' });
    }

    // Check if code is unique
    const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (existingCoupon) {
      return res.status(400).json({ message: 'Coupon code already exists' });
    }

    const newCoupon = new Coupon({
      name,
      code: code.toUpperCase(),
      discount,
      usage,
      validity: validity,
      minimumPurchase,
      status: status || 'active'
    });

    const savedCoupon = await newCoupon.save();
    res.status(201).json(savedCoupon);
  } catch (error) {
    console.error('Create coupon error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Update coupon
const updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Validation for provided fields
    if (updates.discount !== undefined && (typeof updates.discount !== 'number' || updates.discount <= 0)) {
      return res.status(400).json({ message: 'Discount must be a positive number' });
    }

    if (updates.usage !== undefined && (typeof updates.usage !== 'number' || updates.usage <= 0 || !Number.isInteger(updates.usage))) {
      return res.status(400).json({ message: 'Usage must be a positive integer' });
    }

    if (updates.minimumPurchase !== undefined && (typeof updates.minimumPurchase !== 'number' || updates.minimumPurchase < 0)) {
      return res.status(400).json({ message: 'Minimum purchase must be a non-negative number' });
    }

        if (updates.validity !== undefined) {
        const validityDate = new Date(updates.validity);

        if (validityDate <= new Date()) {
        return res.status(400).json({ message: 'Validity date must be in the future' });
        }
        if (validityDate <= new Date()) {
            return res.status(400).json({ message: 'Validity date must be in the future' });
        }
    }

    // Check if code is unique (if code is being updated)
    if (updates.code !== undefined) {
      const existingCoupon = await Coupon.findOne({ code: updates.code.toUpperCase(), _id: { $ne: id } });
      if (existingCoupon) {
        return res.status(400).json({ message: 'Coupon code already exists' });
      }
      updates.code = updates.code.toUpperCase();
    }

    const updatedCoupon = await Coupon.findByIdAndUpdate(id, updates, { new: true });
    if (!updatedCoupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }
    res.json(updatedCoupon);
  } catch (error) {
    console.error('Update coupon error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Delete coupon (soft delete by setting status to inactive)
const deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedCoupon = await Coupon.findByIdAndUpdate(id, { status: 'inactive' }, { new: true });
    if (!deletedCoupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }
    res.json({ message: 'Coupon deleted successfully' });
  } catch (error) {
    console.error('Delete coupon error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  getAllCoupons,
  getCouponById,
  createCoupon,
  updateCoupon,
  deleteCoupon
};