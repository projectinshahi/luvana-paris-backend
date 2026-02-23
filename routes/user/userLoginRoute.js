const express = require('express');
const router = express.Router();
const userLoginController = require('../../controller/user/userLoginController');

// POST /users/register
router.post('/register', userLoginController.register);

// POST /users/login
router.post('/login', userLoginController.login);

module.exports = router;