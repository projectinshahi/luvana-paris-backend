const express = require('express');
const router = express.Router();
const countryController = require('../../controller/admin/countryController');

// GET /admin/country - Get all countries
router.get('/', countryController.getAllCountries);

// GET /admin/country/:id - Get country by ID
router.get('/:id', countryController.getCountryById);

// POST /admin/country - Create new country
router.post('/', countryController.createCountry);

// PUT /admin/country/:id - Update country
router.put('/:id', countryController.updateCountry);

// DELETE /admin/country/:id - Delete country (soft delete)
router.delete('/:id', countryController.deleteCountry);

module.exports = router;
