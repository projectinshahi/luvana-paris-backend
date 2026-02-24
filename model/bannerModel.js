const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema({
    name: String,
    titleEnglish: String,
    titleArabic: String,
    descriptionEnglish: String,
    descriptionArabic: String,
    imageUrlEnglish: String,
    imageUrlArabic: String,
    sortOrder: Number,
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
},
{
    timestamps: true, 
});

const Banner = mongoose.model('Banner', bannerSchema);

module.exports = Banner;