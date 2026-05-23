var express = require('express');
const { postTabWebhook } = require('../controller/webhookController');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.post('/tap/webhook', postTabWebhook);

module.exports = router;
