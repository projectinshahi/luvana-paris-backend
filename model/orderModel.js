const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    orderId: String,
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    coupon: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon' },
    shippingAddress: { type: mongoose.Schema.Types.ObjectId, ref: 'UserAddress' },
    price: Number,
    discount: Number,
    shippingCharges: Number,
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'returned'],
      default: 'pending',
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'authorized', 'paid', 'failed', 'refunded'],
      default: 'pending',
    },
    tapChargeId: { type: String },       // legacy — kept until migration completes
    paymentReference: { type: String },  // provider-neutral reference (use this)
    paymentProvider: { type: String, default: 'tap' },
    orderItem: [
        {
            product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
            productNameEnglish: String,
            productNameArabic: String,
        productImageEnglish: String,
        productImageArabic: String,
            variant: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVariants' },
            quantity: Number,
            price: Number,
            discount: Number,
        }
    ]
},
{
    timestamps: true, 
});

orderSchema.index({ tapChargeId: 1 }, { unique: true, sparse: true });       // legacy
orderSchema.index({ paymentReference: 1 }, { unique: true, sparse: true }); // current
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1, paymentStatus: 1 });

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;