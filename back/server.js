const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express'); // swagger-jsdoc больше не нужен!

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// --- НАДЕЖНАЯ НАСТРОЙКА SWAGGER (БЕЗ КОММЕНТАРИЕВ) ---
const swaggerDocument = {
    openapi: '3.0.0',
    info: {
        title: 'Equilibrium Rental API',
        version: '1.0.0',
        description: 'RESTful API для информационной системы управления краткосрочной арендой',
    },
    servers: [{ url: 'http://localhost:3000', description: 'Локальный сервер' }],
    paths: {
        '/api/properties': {
            get: {
                summary: 'Получить список объектов',
                tags: ['Properties'],
                responses: { '200': { description: 'Массив апартаментов' } }
            },
            post: {
                summary: 'Добавить объект недвижимости',
                tags: ['Properties'],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    title: { type: 'string' },
                                    address: { type: 'string' },
                                    price_per_night: { type: 'number' },
                                    access_code: { type: 'string' },
                                    owner_id: { type: 'integer' }
                                }
                            }
                        }
                    }
                },
                responses: { '201': { description: 'Объект создан' } }
            }
        },
        '/api/bookings': {
            post: {
                summary: 'Создать бронирование',
                tags: ['Bookings'],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    property_id: { type: 'integer' },
                                    guest_name: { type: 'string' },
                                    start_date: { type: 'string', format: 'date' },
                                    end_date: { type: 'string', format: 'date' }
                                }
                            }
                        }
                    }
                },
                responses: {
                    '201': { description: 'Успешно' },
                    '400': { description: 'Овербукинг' }
                }
            }
        }
    }
};

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// --- ПОДКЛЮЧЕНИЕ К ЛОКАЛЬНОЙ БАЗЕ ---
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'rent_db',
    password: '12345', // <-- ВНИМАНИЕ: Вставьте сюда ваш пароль!
    port: 5432,
});

pool.connect((err) => {
    if (err) console.error('Ошибка БД:', err.message);
    else console.log('Подключение к PostgreSQL успешно!');
});

/* ==========================================================================
   RESTful API ЭНДПОИНТЫ
   ========================================================================== */

app.get('/api/properties', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM properties ORDER BY id DESC');
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/properties', async (req, res) => {
    const { title, address, price_per_night, access_code, owner_id } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO properties (title, address, price_per_night, access_code, owner_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [title, address, price_per_night, access_code, owner_id || 1]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/bookings', async (req, res) => {
    const { property_id, guest_name, start_date, end_date } = req.body;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        const checkOverlapQuery = `
            SELECT id FROM bookings 
            WHERE property_id = $1 AND (start_date, end_date) OVERLAPS ($2::DATE, $3::DATE)
        `;
        const overlapResult = await client.query(checkOverlapQuery, [property_id, start_date, end_date]);

        if (overlapResult.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Овербукинг! Выбранные даты для данных апартаментов уже заняты.' });
        }

        const bookingQuery = `
            INSERT INTO bookings (property_id, guest_name, start_date, end_date) 
            VALUES ($1, $2, $3, $4) RETURNING *
        `;
        const bookingResult = await client.query(bookingQuery, [property_id, guest_name, start_date, end_date]);

        await client.query('COMMIT');
        res.status(201).json({ booking: bookingResult.rows[0], message: 'Успешно забронировано' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

app.listen(PORT, () => {
    console.log('===================================================');
    console.log(`Сервер успешно запущен на порту ${PORT}`);
    console.log(`Документация Swagger:  http://localhost:${PORT}/api-docs`);
    console.log(`Базовый URL API:       http://localhost:${PORT}/api/properties`);
    console.log('===================================================');
    console.log('Для остановки сервера нажмите Ctrl + C');
});