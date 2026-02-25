const mongoose = require('mongoose');

const productVariantsSchema = new mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    nameEnglish: String,
    nameArabic: String,
    shortDescriptionEnglish: String,
    shortDescriptionArabic: String,
    color: String,
    stock: Number,
    price: Number,
    mrp: Number,
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    imageUrlEnglish: [{
        imageUrl: String,
    }],
    imageUrlArabic: [{
        imageUrl: String,
    }],
},
{
    timestamps: true, 
});

const ProductVariants = mongoose.model('ProductVariants', productVariantsSchema);

module.exports = ProductVariants;