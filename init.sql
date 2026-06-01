-- 1. Таблица фонда недвижимости
CREATE TABLE IF NOT EXISTS properties (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    price_per_night NUMERIC(10, 2) NOT NULL,
    access_code VARCHAR(50) NOT NULL,
    owner_id INT NOT NULL
);

-- 2. Таблица транзакций бронирования (Интерфейс Гостя)
CREATE TABLE IF NOT EXISTS bookings (
    id SERIAL PRIMARY KEY,
    property_id INT REFERENCES properties(id) ON DELETE CASCADE,
    guest_name VARCHAR(150) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'CONFIRMED'
);

-- 3. Таблица автоматических задач для сервисного персонала (ERP-клининг)
CREATE TABLE IF NOT EXISTS cleaning_tasks (
    id SERIAL PRIMARY KEY,
    property_id INT REFERENCES properties(id) ON DELETE CASCADE,
    task_date DATE NOT NULL,
    cost NUMERIC(10, 2) DEFAULT 1500.00,
    status VARCHAR(50) DEFAULT 'SCHEDULED'
);

-- Инъекция демонстрационных данных для первичного рендеринга страниц
INSERT INTO properties (title, address, price_per_night, access_code, owner_id) VALUES
('Клубный апартамент с террасой №4', 'микрорайон Равновесие, дом 6, корп. 1', 6500.00, '99#04', 1),
('Премиум студия с патио и отдельным входом', 'микрорайон Равновесие, дом 4', 5200.00, '12#88', 1),
('Евроформат лофт с панорамными окнами', 'микрорайон Равновесие, дом 6, корп. 2', 7800.00, '44#11', 1)
ON CONFLICT DO NOTHING;