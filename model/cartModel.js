const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    variant: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVarients' },
    quantity: Number,
    coupon: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon' },
},
{
    timestamps: true, 
});

const Cart = mongoose.model('Cart', cartSchema);

module.exports = Cart;