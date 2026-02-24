const mongoose = require('mongoose');

const wishlistSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    variant: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVariants' },
},
{
    timestamps: true, 
});

const Wishlist = mongoose.model('Wishlist', wishlistSchema);

module.exports = Wishlist;