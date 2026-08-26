const mongoose = require('mongoose');

const brandSchema = new mongoose.Schema({
    nameEnglish: String,
    nameArabic: String,
    descriptionEnglish: String,
    descriptionArabic: String,
    logoUrlEnglish: String,
    logoUrlArabic: String,
    logoPublicIdEnglish: String,
    logoPublicIdArabic: String,
    brandImageEnglish: String,
    brandMobileImageEnglish: String,
    brandImageArabic: String,
    brandMobileImageArabic: String,
    brandImagePublicIdEnglish: String,
    brandMobileImagePublicIdEnglish: String,
    brandImagePublicIdArabic: String,
    brandMobileImagePublicIdArabic: String,
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
},
{
    timestamps: true, 
});

const Brand = mongoose.model('Brand', brandSchema);

module.exports = Brand;