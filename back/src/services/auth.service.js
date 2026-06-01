const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

class AuthService {
  async register(data) {
    const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
    if (existingUser) throw new Error('Пользователь с таким email уже существует');

    const hashedPassword = await bcrypt.hash(data.password, 10);
    
    // ЖЕСТКОЕ РАЗГРАНИЧЕНИЕ:
    // Если регистрируется твой email — это OWNER (Владелец). Все остальные — обычные пользователи (USER)
    const adminEmail = "krasnikov@equilibrium.ru"; // Укажи здесь свой email для управления
    const finalRole = data.email.toLowerCase() === adminEmail.toLowerCase() ? 'OWNER' : 'USER';

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        role: finalRole
      }
    });

    return this.generateToken(user);
  }

  async login(email, password) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error('Неверный email или пароль');

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) throw new Error('Неверный email или пароль');

    return this.generateToken(user);
  }

  generateToken(user) {
    return jwt.sign(
      { id: user.id, role: user.role, name: user.name, email: user.email },
      process.env.JWT_SECRET || 'SUPER_SECRET_KEY',
      { expiresIn: '24h' }
    );
  }
}

module.exports = new AuthService();