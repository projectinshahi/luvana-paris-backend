const Country = require('../../model/countryModel');

// ponytail: process-level TTL cache — Country rows are admin-managed and stable.
// Cache for 5 minutes; any admin update to Country data takes effect within 5 min.
let _cache = null;
let _cacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

const loadCurrencyConverter = async () => {
  const now = Date.now();
  if (_cache && now - _cacheTime < CACHE_TTL_MS) return _cache;

  const activeCountries = await Country.find({ status: 'active' }).lean();

  _cache = (mrp, price) => activeCountries.map(country => ({
    country: country.nameEnglish || country.nameArabic,
    mrp: parseFloat((mrp * parseFloat(country.currencyValue || 1)).toFixed(2)),
    price: parseFloat((price * parseFloat(country.currencyValue || 1)).toFixed(2))
  }));
  _cacheTime = now;
  return _cache;
};

// Call after admin updates Country data so the next request re-fetches.
const invalidateCurrencyCache = () => { _cacheTime = 0; };

module.exports = { loadCurrencyConverter, invalidateCurrencyCache };
