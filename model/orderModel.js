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
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
    },
    orderItem: [
        {
            product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
            productNameEnglish: String,
            productNameArabic: String,
            variant: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVarients' },
            quantity: Number,
            price: Number,
            discount: Number,
        }
    ]
},
{
    timestamps: true, 
});

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;