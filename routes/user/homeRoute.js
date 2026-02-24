const express = require('express');
const router = express.Router();
const userHomeController = require('../../controller/user/homeController');

// GET /users/home
router.get('/', userHomeController.getHome);


module.exports = router;