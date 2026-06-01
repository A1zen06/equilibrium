const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const verifyUser = (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ status: 'error', message: 'Нет токена' });
        req.user = jwt.verify(token, process.env.JWT_SECRET || 'SUPER_SECRET_KEY');
        next();
    } catch (e) { res.status(401).json({ status: 'error', message: 'Неверный токен' }); }
};

// Получить шаблоны владельца
router.get('/templates', verifyUser, async (req, res, next) => {
    try {
        if (req.user.role !== 'OWNER') return res.status(403).json({ status: 'error', message: 'Нет прав' });
        const templates = await prisma.messageTemplate.findMany({ where: { ownerId: req.user.id } });
        res.json({ status: 'success', data: templates });
    } catch (error) { next(error); }
});

// Сохранить шаблоны владельца
router.post('/templates', verifyUser, async (req, res, next) => {
    try {
        if (req.user.role !== 'OWNER') return res.status(403).json({ status: 'error', message: 'Нет прав' });
        
        // Защита от undefined
        const { templates } = req.body || {}; 
        if (!templates || !Array.isArray(templates)) {
            return res.status(400).json({ status: 'error', message: 'Некорректный формат данных' });
        }
        
        for (const t of templates) {
            await prisma.messageTemplate.upsert({
                where: { ownerId_trigger: { ownerId: req.user.id, trigger: t.trigger } },
                update: { content: t.content },
                create: { ownerId: req.user.id, trigger: t.trigger, content: t.content }
            });
        }
        res.json({ status: 'success', message: 'Шаблоны сохранены' });
    } catch (error) { next(error); }
});

// Получить чат по бронированию
router.get('/chat/:bookingId', verifyUser, async (req, res, next) => {
    try {
        const bookingId = Number(req.params.bookingId);
        const messages = await prisma.message.findMany({
            where: { bookingId },
            include: { sender: { select: { id: true, name: true, role: true } } },
            orderBy: { createdAt: 'asc' }
        });
        res.json({ status: 'success', data: messages });
    } catch (error) { next(error); }
});

// Отправить ручное сообщение в чат
router.post('/chat/:bookingId', verifyUser, async (req, res, next) => {
    try {
        const bookingId = Number(req.params.bookingId);
        
        // Защита от undefined
        const { content, receiverId } = req.body || {};
        if (!content || !receiverId) {
            return res.status(400).json({ status: 'error', message: 'Пустое сообщение или не указан получатель' });
        }
        
        const message = await prisma.message.create({
            data: { content, isAuto: false, bookingId, senderId: req.user.id, receiverId: Number(receiverId) }
        });
        res.status(201).json({ status: 'success', data: message });
    } catch (error) { next(error); }
});

module.exports = router;