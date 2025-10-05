const express = require('express');
const router = express.Router();
const { handleMarking } = require('../handlers/markingHandler');

router.post('/marking', handleMarking);

module.exports = router;