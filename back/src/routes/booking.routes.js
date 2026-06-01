const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const verifyUser = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'Необходима авторизация' });
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'SUPER_SECRET_KEY');
    next();
  } catch (e) {
    return res.status(401).json({ status: 'error', message: 'Сессия устарела, войдите заново' });
  }
};

// 1. СОЗДАТЬ БРОНИРОВАНИЕ
router.post('/', verifyUser, async (req, res, next) => {
  try {
    const { propertyId, startDate, endDate, totalPrice } = req.body;
    const newBooking = await prisma.booking.create({
      data: {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        totalPrice: Number(totalPrice),
        userId: req.user.id,
        propertyId: Number(propertyId)
      }
    });
    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    const template = await prisma.messageTemplate.findUnique({
      where: { ownerId_trigger: { ownerId: property.ownerId, trigger: 'AFTER_BOOKING' } }
    });
    if (template && template.isActive) {
      await prisma.message.create({
        data: {
          content: template.content,
          isAuto: true,
          bookingId: newBooking.id,
          senderId: property.ownerId,
          receiverId: req.user.id
        }
      });
    }
    res.status(201).json({ status: 'success', data: newBooking });
  } catch (error) { next(error); }
});

// 2. ПОЛУЧИТЬ БРОНИ ТЕКУЩЕГО КЛИЕНТА
router.get('/my', verifyUser, async (req, res, next) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { userId: req.user.id },
      include: { property: true },
      orderBy: { id: 'desc' }
    });
    res.json({ status: 'success', data: bookings });
  } catch (error) { next(error); }
});

// 3. СТАТИСТИКА ДАШБОРДА ВЛАДЕЛЬЦА
router.get('/owner/stats', verifyUser, async (req, res, next) => {
  try {
    if (req.user.role !== 'OWNER') return res.status(403).json({ status: 'error', message: 'Нет прав доступа' });

    const properties = await prisma.property.findMany({ where: { ownerId: req.user.id }, select: { id: true } });
    if (properties.length === 0) return res.json({ status: 'success', data: { revenue: 0, clients: 0, occupancy: 0 } });

    const propertyIds = properties.map(p => p.id);
    const bookings = await prisma.booking.findMany({ where: { propertyId: { in: propertyIds } } });

    // Считаем выручку только с ПОДТВЕРЖДЕННЫХ броней
    const confirmedBookings = bookings.filter(b => b.status === 'CONFIRMED');
    const revenue = confirmedBookings.reduce((sum, b) => sum + b.totalPrice, 0);

    const uniqueClients = new Set(bookings.map(b => b.userId)).size;

    const today = new Date();
    const activeBookingsToday = confirmedBookings.filter(b => {
      const start = new Date(b.startDate);
      const end = new Date(b.endDate);
      return today >= start && today <= end;
    });

    const occupiedPropertyIds = new Set(activeBookingsToday.map(b => b.propertyId)).size;
    const occupancy = Math.round((occupiedPropertyIds / properties.length) * 100);

    res.json({ status: 'success', data: { revenue, clients: uniqueClients, occupancy } });
  } catch (error) { next(error); }
});

// ==========================================
// НОВЫЕ РОУТЫ: УПРАВЛЕНИЕ ЗАЯВКАМИ
// ==========================================

// 4. ПОЛУЧИТЬ ВСЕ ВХОДЯЩИЕ ЗАЯВКИ (ДЛЯ ВЛАДЕЛЬЦА)
router.get('/owner', verifyUser, async (req, res, next) => {
  try {
    if (req.user.role !== 'OWNER') return res.status(403).json({ status: 'error', message: 'Нет прав' });

    const properties = await prisma.property.findMany({ where: { ownerId: req.user.id }, select: { id: true } });
    const propertyIds = properties.map(p => p.id);

    const bookings = await prisma.booking.findMany({
      where: { propertyId: { in: propertyIds } },
      include: { property: true, user: { select: { name: true, email: true } } },
      orderBy: { id: 'desc' }
    });

    res.json({ status: 'success', data: bookings });
  } catch (error) { next(error); }
});

// 5. ИЗМЕНИТЬ СТАТУС БРОНИ
router.patch('/:id/status', verifyUser, async (req, res, next) => {
  try {
    const { status } = req.body;
    const bookingId = Number(req.params.id);
    const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { property: true } });

    if (!booking) return res.status(404).json({ status: 'error', message: 'Бронь не найдена' });

    const isOwner = req.user.role === 'OWNER' && booking.property.ownerId === req.user.id;
    const isClient = booking.userId === req.user.id;

    if (!isOwner && !isClient) return res.status(403).json({ status: 'error', message: 'Нет прав' });

    // Клиент может только отменять бронь
    if (isClient && status !== 'CANCELLED') {
      return res.status(403).json({ status: 'error', message: 'Клиент может только отменить бронирование' });
    }

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: { status }
    });

    res.json({ status: 'success', data: updated });
  } catch (error) { next(error); }
});

module.exports = router;