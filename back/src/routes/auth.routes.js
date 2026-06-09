const express = require('express');
const authController = require('../controllers/auth.controller');
const router = express.Router();

// Привязываем методы контроллера к путям
router.post('/register', authController.register.bind(authController));
router.post('/login', authController.login.bind(authController));

module.exports = router;