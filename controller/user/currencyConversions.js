const Country = require('../../model/countryModel');

// Load the active countries once per request and convert prices from that list.
// Every controller used to run its own identical Country query for each variant
// (11 on the home page alone), and each round-trip to the database costs ~55 ms.
const loadCurrencyConverter = async () => {
  const activeCountries = await Country.find({ status: 'active' }).lean();

  return (mrp, price) => activeCountries.map(country => ({
    country: country.nameEnglish || country.nameArabic,
    mrp: parseFloat((mrp * parseFloat(country.currencyValue || 1)).toFixed(2)),
    price: parseFloat((price * parseFloat(country.currencyValue || 1)).toFixed(2))
  }));
};

module.exports = { loadCurrencyConverter };
