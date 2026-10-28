const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    variant: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVariants' },
    quantity: Number,
    coupon: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon' },
},
{
    timestamps: true, 
});

cartSchema.index({ user: 1 });
cartSchema.index({ user: 1, variant: 1 });

const Cart = mongoose.model('Cart', cartSchema);

module.exports = Cart;