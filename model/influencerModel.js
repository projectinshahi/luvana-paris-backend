const mongoose = require('mongoose');

const influencerSchema = new mongoose.Schema({
    titleEnglish: String,
    titleArabic: String,
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    variant: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVariants' },
    videoUrl: String,
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

const Influencer = mongoose.model('Influencer', influencerSchema);

module.exports = Influencer;