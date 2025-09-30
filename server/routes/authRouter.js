const express = require('express');
const router = express.Router();
const { handleLogin, handleAdminLogin } = require('../handlers/authHandler');

// Student login
router.post('/login', handleLogin);

// Admin login
router.post('/admin-login', handleAdminLogin);

module.exports = router;