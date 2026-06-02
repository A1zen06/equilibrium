const express = require('express');
const cors = require('cors');
const path = require('path');
const swaggerUi = require('swagger-ui-express'); // Подключение библиотеки для Swagger
const swaggerDocument = require('./swagger.json'); // Подключение твоего файла документации
require('dotenv').config();

const app = express();

// 1. ПАРСЕРЫ
app.use(cors());
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));

// 2. СТАТИКА (РАЗДАЧА ФАЙЛОВ)
// Раздаем загруженные картинки
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));
// Раздаем сам сайт (папку front)! Этого не хватало для работы страниц
app.use(express.static(path.join(__dirname, '../../front')));

// 3. ФОНОВЫЕ ЗАДАЧИ (КРОН)
require('./services/cron.service');

// 4. ДОКУМЕНТАЦИЯ SWAGGER
// Интегрируем Swagger UI по маршруту /api-docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// 5. РОУТЫ БЭКЕНДА
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/properties', require('./routes/property.routes'));
app.use('/api/bookings', require('./routes/booking.routes'));
app.use('/api/messages', require('./routes/message.routes'));

// 6. ГЛОБАЛЬНЫЙ ОБРАБОТЧИК ОШИБОК
app.use((err, req, res, next) => {
    console.error('Ошибка на сервере:', err);
    res.status(500).json({ status: 'error', message: 'Внутренняя ошибка сервера' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Сервер Equilibrium запущен http://localhost:${PORT}`);
    console.log(`Документация Swagger доступна по адресу: http://localhost:${PORT}/api-docs`);
});