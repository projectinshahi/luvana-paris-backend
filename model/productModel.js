const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    brand: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand' },
    nameEnglish: String,
    nameArabic: String,
    shortDescriptionEnglish: String,
    shortDescriptionArabic: String,
    isNew: {
      type: Boolean,
      default: false,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    description: [{
        titleEnglish: String,
        titleArabic: String,
        descriptionEnglish: [
            {
                description: String,
            }
        ],
        descriptionArabic: [
            {
                description: String,
            }
        ],
    }],
    imageUrlEnglish: [{
        imageUrl: String,
        publicId: String,
    }],
    imageUrlArabic: [{
        imageUrl: String,
        publicId: String,
    }],
},
{
    timestamps: true, 
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;