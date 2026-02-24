const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    nameEnglish: String,
    nameArabic: String,
    descriptionEnglish: String,
    descriptionArabic: String,
    imageUrlEnglish: String,
    imageUrlArabic: String,
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
},
{
    timestamps: true, 
});

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;