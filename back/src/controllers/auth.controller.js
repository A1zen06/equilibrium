const authService = require('../services/auth.service');

class AuthController {
  async register(req, res, next) {
    try {
      const token = await authService.register(req.body);
      res.status(201).json({ status: 'success', token });
    } catch (error) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }

  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const token = await authService.login(email, password);
      res.status(200).json({ status: 'success', token });
    } catch (error) {
      res.status(401).json({ status: 'error', message: error.message });
    }
  }
}

// ЭКСПОРТИРУЕМ ОБЪЕКТ (Экземпляр класса)
module.exports = new AuthController();