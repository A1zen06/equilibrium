const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

const verifyUser = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'Необходима авторизация' });
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'SUPER_SECRET_KEY');
    next();
  } catch (e) {
    res.status(401).json({ status: 'error', message: 'Неверный токен' });
  }
};

router.get('/', async (req, res, next) => {
  try {
    const { location, guests } = req.query;
    let whereClause = {};
    if (location) whereClause.address = { contains: location, mode: 'insensitive' };
    if (guests) whereClause.maxGuests = { gte: Number(guests) };

    const properties = await prisma.property.findMany({ where: whereClause, orderBy: { id: 'desc' } });
    res.json({ status: 'success', data: properties });
  } catch (error) { next(error); }
});

router.post('/', verifyUser, upload.single('imageFile'), async (req, res, next) => {
  try {
    if (req.user.role !== 'OWNER') return res.status(403).json({ status: 'error', message: 'Нет прав' });
    
    const { 
      title, description, address, pricePerDay, imageUrl, 
      category, rooms, maxGuests, distanceToMetro, 
      latitude, longitude, amenities, rules, depositAmount 
    } = req.body;
    
    let finalImage = imageUrl || 'https://images.imagesimages.org/placeholder.jpg';
    if (req.file) finalImage = '/uploads/' + req.file.filename;

    const newProp = await prisma.property.create({
      data: { 
        title, 
        description, 
        address, 
        pricePerDay: Number(pricePerDay), 
        image: finalImage,
        category: category || 'Апартаменты',
        rooms: Number(rooms) || 1,
        maxGuests: Number(maxGuests) || 2,
        distanceToMetro,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        amenities: amenities ? JSON.parse(amenities) : [],
        rules,
        depositAmount: Number(depositAmount) || 0,
        ownerId: req.user.id 
      }
    });
    res.status(201).json({ status: 'success', data: newProp });
  } catch (error) { next(error); }
});

router.delete('/:id', verifyUser, async (req, res, next) => {
  try {
    if (req.user.role !== 'OWNER') return res.status(403).json({ status: 'error', message: 'Нет прав' });
    await prisma.property.delete({ where: { id: Number(req.params.id) } });
    res.json({ status: 'success', message: 'Объект удален' });
  } catch (error) { next(error); }
});

router.get('/my/favorites', verifyUser, async (req, res, next) => {
  try {
    const favorites = await prisma.favorite.findMany({
      where: { userId: req.user.id }, include: { property: true }, orderBy: { createdAt: 'desc' }
    });
    res.json({ status: 'success', data: favorites.map(f => f.property) });
  } catch (error) { next(error); }
});

router.get('/owner/pending-reviews', verifyUser, async (req, res, next) => {
  try {
    if (req.user.role !== 'OWNER') return res.status(403).json({ status: 'error', message: 'Нет прав' });
    const properties = await prisma.property.findMany({ where: { ownerId: req.user.id }, select: { id: true } });
    const propertyIds = properties.map(p => p.id);

    const reviews = await prisma.review.findMany({
      where: { propertyId: { in: propertyIds }, status: 'PENDING' },
      include: { user: { select: { name: true } }, property: { select: { title: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ status: 'success', data: reviews });
  } catch (error) { next(error); }
});

router.patch('/reviews/:reviewId/status', verifyUser, async (req, res, next) => {
  try {
    if (req.user.role !== 'OWNER') return res.status(403).json({ status: 'error', message: 'Нет прав' });
    const { status } = req.body; 

    const review = await prisma.review.findUnique({ where: { id: Number(req.params.reviewId) }, include: { property: true } });
    if (!review) return res.status(404).json({ status: 'error', message: 'Отзыв не найден' });
    if (review.property.ownerId !== req.user.id) return res.status(403).json({ status: 'error', message: 'Это не ваш объект' });

    await prisma.review.update({ where: { id: Number(req.params.reviewId) }, data: { status } });
    res.json({ status: 'success', message: `Отзыв ${status === 'APPROVED' ? 'одобрен' : 'отклонен'}` });
  } catch (error) { next(error); }
});

router.post('/:id/favorite', verifyUser, async (req, res, next) => {
  try {
    const propertyId = Number(req.params.id);
    const userId = req.user.id;
    const existingFav = await prisma.favorite.findUnique({ where: { userId_propertyId: { userId, propertyId } } });

    if (existingFav) {
      await prisma.favorite.delete({ where: { id: existingFav.id } });
      return res.json({ status: 'success', action: 'removed' });
    } else {
      await prisma.favorite.create({ data: { userId, propertyId } });
      return res.json({ status: 'success', action: 'added' });
    }
  } catch (error) { next(error); }
});

router.get('/:id/reviews', async (req, res, next) => {
  try {
    const reviews = await prisma.review.findMany({
      where: { propertyId: Number(req.params.id), status: 'APPROVED' },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ status: 'success', data: reviews });
  } catch (error) { next(error); }
});

router.post('/:id/reviews', verifyUser, async (req, res, next) => {
  try {
    if (req.user.role === 'OWNER') return res.status(403).json({ status: 'error', message: 'Владельцы не могут оставлять отзывы' });

    const propertyId = Number(req.params.id);
    const { rating, comment } = req.body;
    if (!rating || !comment) return res.status(400).json({ status: 'error', message: 'Заполните все поля' });

    const hasBooking = await prisma.booking.findFirst({
      where: { userId: req.user.id, propertyId: propertyId, status: 'CONFIRMED' }
    });
    if (!hasBooking) return res.status(403).json({ status: 'error', message: 'Требуется подтвержденная бронь' });

    const existingReview = await prisma.review.findFirst({
      where: { userId: req.user.id, propertyId: propertyId }
    });
    if (existingReview) return res.status(400).json({ status: 'error', message: 'Вы уже оставили отзыв' });

    await prisma.review.create({
      data: { rating: Number(rating), comment: String(comment), status: 'PENDING', propertyId, userId: req.user.id }
    });
    
    res.status(201).json({ status: 'success', message: 'Отзыв отправлен на модерацию владельцу' });
  } catch (error) { next(error); }
});

module.exports = router;