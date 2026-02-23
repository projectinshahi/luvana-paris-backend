const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
    name: String,
    code: String,
    discount: Number,
    usage: Number,
    validity: String,
    minimumPurchase: Number,
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
},
{
    timestamps: true, 
});

const Coupon = mongoose.model('Coupon', couponSchema);

module.exports = Coupon;