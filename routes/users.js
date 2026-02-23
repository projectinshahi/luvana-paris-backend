var express = require('express');
var router = express.Router();

// Use user auth routes
router.use('/', require('./user/userLoginRoute'));

module.exports = router;
