document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('properties-container');
    const searchForm = document.getElementById('main-search-form');

    function syncHeader() {
        const token = localStorage.getItem('token');
        const link = document.getElementById('main-cabinet-link');

        if (token) {
            try {
                const user = JSON.parse(atob(token.split('.')[1]));
                if (link) link.innerText = user.role === 'OWNER' ? 'Панель владельца' : 'Профиль';
            } catch (e) { localStorage.clear(); }
        }
    }
    syncHeader();

    function getUserRole() {
        const token = localStorage.getItem('token');
        if (!token) return 'GUEST';
        try {
            const base64Url = token.split('.')[1];
            return JSON.parse(atob(base64Url.replace(/-/g, '+').replace(/_/g, '/'))).role || 'GUEST';
        } catch (e) { return 'GUEST'; }
    }

    const currentRole = getUserRole();
    const token = localStorage.getItem('token');

    async function loadProperties(queryString = '') {
        if (!container) return;
        container.innerHTML = '<div class="loading-placeholder">Синхронизация с базой данных...</div>';

        let userFavorites = new Set();
        if (token && currentRole === 'USER') {
            try {
                const favRes = await fetch('/api/properties/my/favorites', { headers: { 'Authorization': `Bearer ${token}` } });
                const favData = await favRes.json();
                if (favData.status === 'success') favData.data.forEach(p => userFavorites.add(p.id));
            } catch (e) { }
        }

        try {
            const response = await fetch(`/api/properties${queryString}`);
            const result = await response.json();

            if (result.status === 'success' && result.data.length > 0) {
                container.innerHTML = '';

                result.data.forEach((item, index) => {
                    const card = document.createElement('div');
                    card.className = 'property-premium-card';
                    card.style.animation = `fadeInUp 0.6s cubic-bezier(0.25, 1, 0.5, 1) forwards`;
                    card.style.animationDelay = `${index * 0.1}s`;
                    card.style.opacity = '0';
                    card.style.cursor = 'pointer';

                    card.onclick = () => { window.location.href = `html/property.html?id=${item.id}`; };

                    let actionButtonHtml = '';
                    let favHtml = '';
                    
                    // Проверяем, есть ли картинка. Если нет - ставим заглушку
                    const firstImg = (item.images && item.images.length > 0) ? item.images[0] : 'https://images.imagesimages.org/placeholder.jpg';

                    if (currentRole === 'OWNER') {
                        // Кнопка удаления для владельца
                        actionButtonHtml = `<button class="delete-prop-btn" data-id="${item.id}" style="position: absolute; top: 15px; right: 15px; background: #ffc444ff; color: black; border: none; padding: 8px 14px; border-radius: 8px; font-family: 'Montserrat', sans-serif; font-size: 12px; font-weight: 600; cursor: pointer; z-index: 100; transition: all 0.2s ease;">Удалить</button>`;
                    } else {
                        // Кнопка "В избранное" (Темное стекло + золотая рамка)
                        const isFavorited = userFavorites.has(item.id);
                        const heartIcon = isFavorited ? '💛' : '🤍';
                        const activeClass = isFavorited ? 'active' : '';

                        favHtml = `
                        <div class="fav-btn ${activeClass}" style="
                            position: absolute; 
                            top: 15px; 
                            right: 15px; 
                            z-index: 100; 
                            width: 36px;
                            height: 36px;
                            background: rgba(20, 20, 20, 0.65);
                            backdrop-filter: blur(4px);
                            -webkit-backdrop-filter: blur(4px);
                            border: 1px solid rgba(255, 196, 68, 0.3);
                            border-radius: 50%;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-size: 16px;
                            cursor: pointer;
                            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.4);
                            transition: all 0.2s ease;
                        " onmouseover="this.style.transform='scale(1.15)'" onmouseout="this.style.transform='scale(1)'">
                            ${heartIcon}
                        </div>`;
                    }

                    // Единый чистый HTML блок для карточки
                    card.innerHTML = `
                        <div style="position: relative; width: 100%; height: 100%;">
                            ${actionButtonHtml}
                            ${favHtml}

                            <div class="property-card-image-wrapper" style="height: 220px; overflow: hidden; position: relative; border-bottom: 1px solid var(--border-color);">
                                <img src="${firstImg}" alt="${item.title}" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s ease;">
                            </div>
                            
                            <div class="property-card-body">
                                <h3 class="property-card-title">${item.title}</h3>
                                <p style="color: var(--text-secondary); font-size: 14px; margin-bottom: 10px;">${item.address}</p>
                                <div class="property-card-price" style="margin: 0;">${item.pricePerDay.toLocaleString()} ₽ / сутки</div>
                            </div>
                        </div>
                    `;

                    // Логика клика по сердечку (только для НЕ владельцев)
                    if (currentRole !== 'OWNER') {
                        const favBtn = card.querySelector('.fav-btn');
                        if (favBtn) {
                            favBtn.onclick = async (e) => {
                                e.stopPropagation(); 
                                if (!token) {
                                    alert('Для сохранения в избранное необходимо войти в систему.');
                                    window.location.href = 'html/login.html';
                                    return;
                                }
                                try {
                                    const res = await fetch(`/api/properties/${item.id}/favorite`, {
                                        method: 'POST',
                                        headers: { 'Authorization': `Bearer ${token}` }
                                    });
                                    const result = await res.json();
                                    
                                    if (result.status === 'success') {
                                        if (result.action === 'added') {
                                            favBtn.classList.add('active');
                                            favBtn.innerHTML = '💛';
                                        } else {
                                            favBtn.classList.remove('active');
                                            favBtn.innerHTML = '🤍';
                                        }
                                    }
                                } catch (err) { console.error('Ошибка добавления в избранное:', err); }
                            };
                        }
                    }

                    container.appendChild(card);
                });

                // Логика кнопки удаления (только для Владельцев)
                if (currentRole === 'OWNER') {
                    document.querySelectorAll('.delete-prop-btn').forEach(button => {
                        button.onclick = async (e) => {
                            e.stopPropagation();
                            const id = button.getAttribute('data-id');
                            if (confirm('Вы уверены, что хотите навсегда удалить это объявление из базы данных?')) {
                                try {
                                    const res = await fetch(`/api/properties/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
                                    const delResult = await res.json();
                                    if (delResult.status === 'success') {
                                        alert(delResult.message);
                                        loadProperties(); 
                                    } else { 
                                        alert(delResult.message); 
                                    }
                                } catch(err) { console.error('Ошибка удаления:', err); }
                            }
                        };
                    });
                }

            } else {
                container.innerHTML = '<div class="loading-placeholder">По вашему запросу ничего не найдено. Попробуйте изменить параметры поиска.</div>';
            }
        } catch (error) {
            container.innerHTML = '<div class="loading-placeholder" style="color: #ff4a4a;">Ошибка загрузки данных от сервера БД.</div>';
            console.error('Ошибка загрузки объявлений:', error);
        }
    }

    loadProperties();

    if (searchForm) {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const locationVal = document.getElementById('search-location').value.trim();
            const guestsVal = document.getElementById('search-guests').value;
            const params = new URLSearchParams();
            
            if (locationVal) params.append('location', locationVal);
            if (guestsVal) params.append('guests', guestsVal);
            
            loadProperties(params.toString() ? `?${params.toString()}` : '');
            document.getElementById('properties-container').scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }
});