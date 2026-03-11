const Country = require('../../model/countryModel');

// Get all active countries for users
const getCountries = async (req, res) => {
  try {
    const countries = await Country.find({ status: 'active' })
      .select('nameEnglish nameArabic abbreviation flagUrl currencyValue')
      .sort({ nameEnglish: 1 });

    res.json({
      countries
    });
  } catch (error) {
    console.error('Get countries error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  getCountries
};
