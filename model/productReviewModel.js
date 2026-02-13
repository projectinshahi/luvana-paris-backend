const mongoose = require('mongoose');

const productReviewSchema = new mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rating: Number,
    review: String,
},
{
    timestamps: true, 
});

const ProductReview = mongoose.model('ProductReview', productReviewSchema);

module.exports = ProductReview;