const mongoose = require('mongoose');

const PromotionStripSchema = new mongoose.Schema({
    name: String,
    contentEnglish: String,
    contentArabic: String,
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

const PromotionStrip = mongoose.model('PromotionStrip', PromotionStripSchema);

module.exports = PromotionStrip;