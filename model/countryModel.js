const mongoose = require('mongoose');

const countrySchema = new mongoose.Schema({
    nameEnglish: String,
    nameArabic: String,
    flagUrl: String,
    publicId: String,
    currencyValue: String,
    abbreviation: String,
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
},
{
    timestamps: true, 
});

const Country = mongoose.model('Country', countrySchema);

module.exports = Country;