const Country = require('../../model/countryModel');

// Get all countries
const getAllCountries = async (req, res) => {
  try {
    const countries = await Country.find();
    res.json(countries);
  } catch (error) {
    console.error('Get countries error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get country by ID
const getCountryById = async (req, res) => {
  try {
    const { id } = req.params;
    const country = await Country.findById(id);

    if (!country) {
      return res.status(404).json({ message: 'Country not found' });
    }

    res.json(country);
  } catch (error) {
    console.error('Get country error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Create new country
const createCountry = async (req, res) => {
  try {
    const {
      nameEnglish,
      nameArabic,
      abbreviation,
      flagUrl,
      publicId,
      currencyValue,
      status
    } = req.body;

    const newCountry = new Country({
      nameEnglish,
      nameArabic,
      abbreviation,
      flagUrl,
      publicId,
      currencyValue,
      status: status || 'active'
    });

    const savedCountry = await newCountry.save();
    res.status(201).json(savedCountry);
  } catch (error) {
    console.error('Create country error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Update country
const updateCountry = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const updatedCountry = await Country.findByIdAndUpdate(id, updates, { new: true });

    if (!updatedCountry) {
      return res.status(404).json({ message: 'Country not found' });
    }

    res.json(updatedCountry);
  } catch (error) {
    console.error('Update country error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Delete country (soft delete by setting status to inactive)
const deleteCountry = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedCountry = await Country.findByIdAndUpdate(
      id,
      { status: 'inactive' },
      { new: true }
    );

    if (!deletedCountry) {
      return res.status(404).json({ message: 'Country not found' });
    }

    res.json({ message: 'Country deleted successfully' });
  } catch (error) {
    console.error('Delete country error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  getAllCountries,
  getCountryById,
  createCountry,
  updateCountry,
  deleteCountry
};
