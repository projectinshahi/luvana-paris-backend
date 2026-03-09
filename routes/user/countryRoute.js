const express = require('express');
const router = express.Router();
const countryController = require('../../controller/user/countryController');

// GET /user/country - Get all active countries
router.get('/', countryController.getCountries);

module.exports = router;
