const express = require('express');
const router = express.Router();
const loginController = require('../../controller/admin/loginController');

// POST /admin/login
router.post('/', loginController.login);

module.exports = router;