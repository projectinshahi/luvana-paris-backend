const express = require('express');
const router = express.Router();
const userLoginController = require('../../controller/user/userLoginController');
const authMiddleware = require('../../middleware/authMiddleware');

// POST /users/register
router.post('/register', userLoginController.register);

// POST /users/login
router.post('/login', userLoginController.login);

// POST /users/logout
router.post('/logout', authMiddleware, userLoginController.logout);

module.exports = router;