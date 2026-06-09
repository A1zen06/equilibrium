document.addEventListener('DOMContentLoaded', () => {
    // 1. УПРАВЛЕНИЕ ВКЛАДКАМИ И ФОРМАМИ
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    if (tabLogin && tabRegister) {
        tabLogin.onclick = () => {
            loginForm.style.display = 'block'; registerForm.style.display = 'none';
            tabLogin.style.color = 'var(--text-primary)'; tabRegister.style.color = 'var(--text-secondary)';
        };
        tabRegister.onclick = () => {
            loginForm.style.display = 'none'; registerForm.style.display = 'block';
            tabLogin.style.color = 'var(--text-secondary)'; tabRegister.style.color = 'var(--text-primary)';
        };
    }

    function setupTabs() {
        const btnBookings = document.getElementById('tab-my-bookings');
        const btnFavorites = document.getElementById('tab-my-favorites');
        const contBookings = document.getElementById('bookings-container');
        const contFavorites = document.getElementById('favorites-container');

        if (btnBookings && btnFavorites) {
            btnBookings.onclick = () => {
                btnBookings.classList.add('active'); btnFavorites.classList.remove('active');
                contBookings.style.display = 'block'; contFavorites.style.display = 'none';
            };
            btnFavorites.onclick = () => {
                btnFavorites.classList.add('active'); btnBookings.classList.remove('active');
                contFavorites.style.display = 'block'; contBookings.style.display = 'none';
            };
        }
    }
    setupTabs();

    // 2. АВТОРИЗАЦИЯ И МАРШРУТИЗАЦИЯ РОЛЕЙ
    function parseJwt(token) {
        try {
            const base64Url = token.split('.')[1];
            return JSON.parse(decodeURIComponent(atob(base64Url.replace(/-/g, '+').replace(/_/g, '/')).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')));
        } catch (e) { return null; }
    }

    let currentUser = null;

    function checkAuth() {
        const token = localStorage.getItem('token');
        const cabinetLink = document.getElementById('nav-cabinet-link');
        const authBlock = document.getElementById('auth-form-block');
        const dashboardBlock = document.getElementById('cabinet-dashboard');

        if (!token) {
            if (authBlock) authBlock.style.display = 'block';
            if (dashboardBlock) dashboardBlock.style.display = 'none';
            if (cabinetLink) cabinetLink.innerText = 'Личный кабинет';
            return;
        }

        currentUser = parseJwt(token);
        if (!currentUser) { localStorage.clear(); checkAuth(); return; }

        if (authBlock) authBlock.style.display = 'none';
        if (dashboardBlock) dashboardBlock.style.display = 'block';

        document.getElementById('welcome-title').innerText = `Добро пожаловать, ${currentUser.name}!`;
        document.getElementById('cabinet-email-info').innerText = `${currentUser.email}`;

        if (currentUser.role === 'OWNER') {
            document.getElementById('owner-only-zone').style.display = 'block';
            document.getElementById('user-only-zone').style.display = 'none';
            if (cabinetLink) cabinetLink.innerText = 'Панель владельца';

            loadOwnerStats(token);
            loadOwnerBookings(token);
            loadPendingReviews(token);
            loadTemplates(token);
        } else {
            document.getElementById('owner-only-zone').style.display = 'none';
            document.getElementById('user-only-zone').style.display = 'block';
            if (cabinetLink) cabinetLink.innerText = 'Профиль';

            loadMyBookings(token);
            loadMyFavorites(token);
        }
    }

    if (loginForm) {
        loginForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            try {
                const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
                const result = await res.json();
                if (result.status === 'success') { localStorage.setItem('token', result.token); checkAuth(); }
                else { alert(result.message || 'Ошибка входа'); }
            } catch (err) { alert('Ошибка сети'); }
        };
    }

    if (registerForm) {
        registerForm.onsubmit = async (e) => {
            e.preventDefault();
            const name = document.getElementById('reg-name').value;
            const email = document.getElementById('reg-email').value;
            const password = document.getElementById('reg-password').value;
            try {
                const res = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, password }) });
                const result = await res.json();
                if (result.status === 'success') { localStorage.setItem('token', result.token); checkAuth(); }
                else { alert(result.message || 'Ошибка регистрации'); }
            } catch (err) { alert('Ошибка сети'); }
        };
    }

    if (document.getElementById('logout-btn')) {
        document.getElementById('logout-btn').onclick = () => { localStorage.clear(); checkAuth(); window.location.reload(); };
    }

    // 3. ДОБАВЛЕНИЕ ОБЪЕКТА (СО ВСЕМИ ПОЛЯМИ)
    const addPropertyForm = document.getElementById('add-property-form');
    if (addPropertyForm) {
        addPropertyForm.onsubmit = async (e) => {
            e.preventDefault();
            const token = localStorage.getItem('token');
            const formData = new FormData();

            formData.append('title', document.getElementById('prop-title').value);
            formData.append('address', document.getElementById('prop-address').value);
            formData.append('pricePerDay', document.getElementById('prop-price').value);
            formData.append('imageUrl', document.getElementById('prop-image').value);
            formData.append('description', document.getElementById('prop-desc').value);
            formData.append('category', document.getElementById('prop-category').value);
            formData.append('rooms', document.getElementById('prop-rooms').value);
            formData.append('maxGuests', document.getElementById('prop-guests').value);
            formData.append('distanceToMetro', document.getElementById('prop-metro').value);
            formData.append('depositAmount', document.getElementById('prop-deposit').value);
            formData.append('rules', document.getElementById('prop-rules').value);

            const amenitiesStr = document.getElementById('prop-amenities').value;
            if (amenitiesStr) {
                const amenitiesArray = amenitiesStr.split(',').map(item => item.trim()).filter(item => item !== '');
                formData.append('amenities', JSON.stringify(amenitiesArray));
            }

            // Добавляем все фото в FormData
            const fileInput = document.getElementById('prop-file');
            if (fileInput && fileInput.files.length > 0) {
                for (let i = 0; i < fileInput.files.length; i++) {
                    formData.append('imageFiles', fileInput.files[i]);
                }
            }

            // Отправляем запрос
            try {
                const res = await fetch('/api/properties', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData });
                const result = await res.json();
                if (result.status === 'success') {
                    alert('Объект успешно добавлен!');
                    addPropertyForm.reset();
                } else { alert(result.message); }
            } catch (err) { alert('Ошибка при отправке данных'); }
        };
    } // <-- ЗДЕСЬ БЫЛА УТЕРЯНА ВАЖНАЯ СКОБКА

    // 4. СТАТУСЫ И ОТОБРАЖЕНИЕ БРОНИРОВАНИЙ
    const statusMap = { PENDING: 'Ожидает', CONFIRMED: 'Подтверждена', CANCELLED: 'Отменена' };

    window.updateBookingStatus = async (id, status, role) => {
        if (!confirm(`Вы уверены, что хотите ${status === 'CANCELLED' ? 'отменить/отклонить' : 'подтвердить'} эту бронь?`)) return;
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`/api/bookings/${id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ status })
            });
            const result = await res.json();
            if (result.status === 'success') {
                if (role === 'OWNER') { loadOwnerBookings(token); loadOwnerStats(token); }
                else { loadMyBookings(token); }
            } else { alert(result.message); }
        } catch (e) { console.error('Ошибка обновления статуса'); }
    };

    async function loadMyBookings(token) {
        const zone = document.getElementById('bookings-container');
        if (!zone) return;
        try {
            const res = await fetch('/api/bookings/my', { headers: { 'Authorization': `Bearer ${token}` } });
            const result = await res.json();
            if (result.status === 'success' && result.data.length > 0) {
                let html = '';
                result.data.forEach(b => {
                    const start = new Date(b.startDate).toLocaleDateString('ru-RU');
                    const end = new Date(b.endDate).toLocaleDateString('ru-RU');

                    let actionsHtml = `<div class="booking-actions">`;
                    actionsHtml += `<button class="btn-chat" onclick="window.openChatModal(${b.id}, ${b.property.ownerId})">ОТКРЫТЬ ЧАТ</button>`;

                    if (b.status === 'PENDING') {
                        actionsHtml += `<button class="btn-reject" onclick="window.updateBookingStatus(${b.id}, 'CANCELLED', 'USER')">ОТМЕНИТЬ БРОНЬ</button>`;
                    } else if (b.status === 'CONFIRMED') {
                        actionsHtml += `<button class="btn-action-gold" onclick="window.openReviewModal(${b.propertyId})">ОЦЕНИТЬ ПРОЖИВАНИЕ</button>`;
                    }
                    actionsHtml += `</div>`;

                    html += `
                        <div class="card-premium" style="padding: 20px; margin-bottom: 15px; border-left: 4px solid var(--accent-gold); display: flex; justify-content: space-between; align-items: center; text-align: left;">
                            <div>
                                <h4 style="font-size: 16px; margin-bottom: 5px;">${b.property.title}</h4>
                                <p style="color: var(--text-secondary); font-size: 13px;">${b.property.address}</p>
                                <p style="margin-top: 10px; font-size: 14px;">Даты: <strong>${start} — ${end}</strong></p>
                                <div style="color: var(--accent-gold); font-weight: 600; margin-top: 5px;">Оплачено: ${b.totalPrice.toLocaleString()} ₽</div>
                            </div>
                            <div style="text-align: right;">
                                <div style="margin-bottom: 15px;"><span class="status-badge status-${b.status.toLowerCase()}">${statusMap[b.status]}</span></div>
                                <div>${actionsHtml}</div>
                            </div>
                        </div>
                    `;
                });
                zone.innerHTML = html;
            } else { zone.innerHTML = '<div style="padding: 40px 20px; border: 1px dashed var(--border-color); border-radius: 8px; text-align: center;"><p style="color: var(--text-secondary); font-size: 15px;">У вас пока нет бронирований.</p></div>'; }
        } catch (err) { console.error(err); }
    }

    async function loadOwnerBookings(token) {
        const zone = document.getElementById('owner-bookings-list');
        if (!zone) return;
        try {
            const res = await fetch('/api/bookings/owner', { headers: { 'Authorization': `Bearer ${token}` } });
            const result = await res.json();
            if (result.status === 'success' && result.data.length > 0) {
                let html = '';
                result.data.forEach(b => {
                    const start = new Date(b.startDate).toLocaleDateString('ru-RU');
                    const end = new Date(b.endDate).toLocaleDateString('ru-RU');

                    let actions = `<div class="booking-actions">`;
                    actions += `<button class="btn-chat" onclick="window.openChatModal(${b.id}, ${b.userId})">ЧАТ С ГОСТЕМ</button>`;

                    if (b.status === 'PENDING') {
                        actions += `
                            <button class="btn-approve" onclick="window.updateBookingStatus(${b.id}, 'CONFIRMED', 'OWNER')">ОДОБРИТЬ</button>
                            <button class="btn-reject" onclick="window.updateBookingStatus(${b.id}, 'CANCELLED', 'OWNER')">ОТКЛОНИТЬ</button>
                        `;
                    }
                    actions += `</div>`;

                    html += `
                        <div class="card-premium" style="padding: 20px; margin-bottom: 15px; border-left: 4px solid var(--accent-gold); display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <h4 style="font-size: 16px; margin-bottom: 5px;">${b.property.title}</h4>
                                <p style="color: var(--text-secondary); font-size: 13px;">Гость: ${b.user.name}</p>
                                <p style="margin-top: 10px; font-size: 14px;">Даты: <strong>${start} — ${end}</strong></p>
                            </div>
                            <div style="text-align: right;">
                                <div style="margin-bottom: 10px;"><span class="status-badge status-${b.status.toLowerCase()}">${statusMap[b.status]}</span></div>
                                <div style="color: var(--text-primary); font-weight: 600; margin-bottom: 10px;">${b.totalPrice.toLocaleString()} ₽</div>
                                <div>${actions}</div>
                            </div>
                        </div>
                    `;
                });
                zone.innerHTML = html;
            } else { zone.innerHTML = '<div style="padding: 40px 20px; border: 1px dashed var(--border-color); border-radius: 8px; text-align: center;"><p style="color: var(--text-secondary); font-size: 15px;">У вас пока нет входящих заявок.</p></div>'; }
        } catch (err) { console.error(err); }
    }

    async function loadOwnerStats(token) {
        try {
            const res = await fetch('/api/bookings/owner/stats', { headers: { 'Authorization': `Bearer ${token}` } });
            const result = await res.json();
            if (result.status === 'success') {
                document.getElementById('stat-revenue').innerText = `${result.data.revenue.toLocaleString()} ₽`;
                document.getElementById('stat-clients').innerText = result.data.clients;
                document.getElementById('stat-occupancy').innerText = `${result.data.occupancy}%`;
            }
        } catch (err) { console.error(err); }
    }

    async function loadMyFavorites(token) {
        const zone = document.getElementById('favorites-container');
        if (!zone) return;
        try {
            const res = await fetch('/api/properties/my/favorites', { headers: { 'Authorization': `Bearer ${token}` } });
            const result = await res.json();
            if (result.status === 'success' && result.data.length > 0) {
                let html = '<div class="catalog-grid" style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; text-align: left;">';
                result.data.forEach(item => {
                    html += `
                        <div class="property-premium-card" style="cursor: pointer;" onclick="window.location.href='property.html?id=${item.id}'">
                            <div style="height: 180px; overflow: hidden; border-bottom: 1px solid var(--border-color);"><img src="${item.images}" alt="${item.title}" style="width: 100%; height: 100%; object-fit: cover;"></div>
                            <div style="padding: 15px;">
                                <h4 style="font-size: 15px; margin-bottom: 5px;">${item.title}</h4>
                                <p style="color: var(--text-secondary); font-size: 13px;">${item.address}</p>
                                <div style="color: var(--accent-gold); font-weight: 600; margin-top: 10px;">${item.pricePerDay.toLocaleString()} ₽ / сутки</div>
                            </div>
                        </div>
                    `;
                });
                zone.innerHTML = html + '</div>';
            } else { zone.innerHTML = '<div style="padding: 40px 20px; border: 1px dashed var(--border-color); border-radius: 8px; text-align: center;"><p style="color: var(--text-secondary); font-size: 15px;">У вас пока нет сохраненных объектов.</p></div>'; }
        } catch (err) { console.error(err); }
    }

    // 5. МОДЕРАЦИЯ И СОЗДАНИЕ ОТЗЫВОВ
    window.openReviewModal = (propId) => {
        document.getElementById('modal-review-prop-id').value = propId;
        document.getElementById('review-modal').style.display = 'flex';
    };

    window.closeReviewModal = () => {
        document.getElementById('review-modal').style.display = 'none';
        document.getElementById('modal-review-form').reset();
    };

    const reviewForm = document.getElementById('modal-review-form');
    if (reviewForm) {
        reviewForm.onsubmit = async (e) => {
            e.preventDefault();
            const propId = document.getElementById('modal-review-prop-id').value;
            const rating = document.getElementById('modal-review-rating').value;
            const comment = document.getElementById('modal-review-comment').value;
            const token = localStorage.getItem('token');
            try {
                const res = await fetch(`/api/properties/${propId}/reviews`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ rating, comment })
                });
                const result = await res.json();
                if (result.status === 'success') {
                    alert('Ваш отзыв успешно отправлен на модерацию владельцу.');
                    window.closeReviewModal();
                } else { alert(result.message); }
            } catch (err) { alert('Ошибка при отправке отзыва'); }
        };
    }

    window.updateReviewStatus = async (reviewId, status) => {
        if (!confirm(`Вы уверены, что хотите ${status === 'APPROVED' ? 'одобрить и опубликовать' : 'отклонить'} этот отзыв?`)) return;
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`/api/properties/reviews/${reviewId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ status })
            });
            const result = await res.json();
            if (result.status === 'success') { loadPendingReviews(token); }
            else { alert(result.message); }
        } catch (e) { console.error('Ошибка модерации'); }
    };

    async function loadPendingReviews(token) {
        const zone = document.getElementById('owner-reviews-list');
        if (!zone) return;
        try {
            const res = await fetch('/api/properties/owner/pending-reviews', { headers: { 'Authorization': `Bearer ${token}` } });
            const result = await res.json();
            if (result.status === 'success' && result.data.length > 0) {
                let html = '';
                result.data.forEach(r => {
                    const stars = '✦ '.repeat(r.rating).trim();
                    const date = new Date(r.createdAt).toLocaleDateString('ru-RU');
                    html += `
                        <div class="card-premium" style="padding: 20px; margin-bottom: 15px; border-left: 4px solid var(--accent-gold);">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                                <div style="font-weight: 600;">Объект: ${r.property.title}</div>
                                <div style="color: var(--text-secondary); font-size: 12px;">${date}</div>
                            </div>
                            <div style="margin-bottom: 5px; color: var(--accent-gold); letter-spacing: 2px;">${stars}</div>
                            <div style="color: var(--text-secondary); font-size: 14px; margin-bottom: 15px;">${r.comment}</div>
                            <div style="font-size: 13px; margin-bottom: 15px;">Автор: <strong>${r.user.name}</strong></div>
                            <div style="text-align: right;">
                                <button class="action-btn btn-approve" onclick="window.updateReviewStatus(${r.id}, 'APPROVED')">Опубликовать</button>
                                <button class="action-btn btn-reject" onclick="window.updateReviewStatus(${r.id}, 'REJECTED')">Удалить</button>
                            </div>
                        </div>
                    `;
                });
                zone.innerHTML = html;
            } else { zone.innerHTML = '<div style="padding: 40px 20px; border: 1px dashed var(--border-color); border-radius: 8px; text-align: center;"><p style="color: var(--text-secondary); font-size: 15px;">Нет новых отзывов, ожидающих модерации.</p></div>'; }
        } catch (err) { console.error(err); }
    }

    // 6. АВТОМАТИЗАЦИЯ И ЧАТЫ
    async function loadTemplates(token) {
        try {
            const res = await fetch('/api/messages/templates', { headers: { 'Authorization': `Bearer ${token}` } });
            const result = await res.json();
            if (result.status === 'success') {
                result.data.forEach(t => {
                    if (t.trigger === 'AFTER_BOOKING') document.getElementById('tpl-after-booking').value = t.content;
                    if (t.trigger === 'BEFORE_CHECKIN') document.getElementById('tpl-before-checkin').value = t.content;
                    if (t.trigger === 'AFTER_CHECKOUT') document.getElementById('tpl-after-checkout').value = t.content;
                });
            }
        } catch (err) { console.error('Ошибка загрузки шаблонов'); }
    }

    const automationForm = document.getElementById('automation-settings-form');
    if (automationForm) {
        automationForm.onsubmit = async (e) => {
            e.preventDefault();
            const token = localStorage.getItem('token');
            const templates = [
                { trigger: 'AFTER_BOOKING', content: document.getElementById('tpl-after-booking').value },
                { trigger: 'BEFORE_CHECKIN', content: document.getElementById('tpl-before-checkin').value },
                { trigger: 'AFTER_CHECKOUT', content: document.getElementById('tpl-after-checkout').value }
            ].filter(t => t.content.trim() !== '');

            try {
                const res = await fetch('/api/messages/templates', {
                    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ templates })
                });
                const result = await res.json();
                if (result.status === 'success') alert('Шаблоны авто-сообщений успешно сохранены!');
            } catch (err) { alert('Ошибка сохранения'); }
        };
    }

    window.openChatModal = async (bookingId, receiverId) => {
        document.getElementById('chat-booking-id').value = bookingId;
        document.getElementById('chat-receiver-id').value = receiverId;
        document.getElementById('chat-modal').style.display = 'flex';
        await loadChatMessages(bookingId);
    };

    window.closeChatModal = () => { document.getElementById('chat-modal').style.display = 'none'; };

    async function loadChatMessages(bookingId) {
        const token = localStorage.getItem('token');
        const container = document.getElementById('chat-messages-container');
        container.innerHTML = '<div style="text-align:center; color: var(--text-secondary);">Загрузка сообщений...</div>';
        try {
            const res = await fetch(`/api/messages/chat/${bookingId}`, { headers: { 'Authorization': `Bearer ${token}` } });
            const result = await res.json();
            if (result.status === 'success') {
                container.innerHTML = '';
                if (result.data.length === 0) {
                    container.innerHTML = '<div style="text-align:center; color: var(--text-secondary); margin-top: 20px;">В этом чате пока нет сообщений.</div>';
                    return;
                }
                result.data.forEach(msg => {
                    const isMyMessage = msg.sender.id === currentUser.id;
                    const typeClass = isMyMessage ? 'sent' : 'received';
                    const autoClass = msg.isAuto ? 'auto' : '';
                    const autoLabel = msg.isAuto ? `<span class="auto-label">Автоматическое сообщение</span>` : '';

                    container.innerHTML += `
                        <div class="chat-message ${typeClass} ${autoClass}">
                            ${autoLabel}
                            ${msg.content}
                        </div>
                    `;
                });
                container.scrollTop = container.scrollHeight;
            }
        } catch (err) { container.innerHTML = '<div style="text-align:center; color: #ff4a4a;">Ошибка загрузки</div>'; }
    }

    const chatForm = document.getElementById('chat-send-form');
    if (chatForm) {
        chatForm.onsubmit = async (e) => {
            e.preventDefault();
            const token = localStorage.getItem('token');
            const bookingId = document.getElementById('chat-booking-id').value;
            const receiverId = document.getElementById('chat-receiver-id').value;
            const content = document.getElementById('chat-input-text').value;

            try {
                const res = await fetch(`/api/messages/chat/${bookingId}`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ content, receiverId })
                });
                const result = await res.json();
                if (result.status === 'success') {
                    document.getElementById('chat-input-text').value = '';
                    await loadChatMessages(bookingId);
                }
            } catch (err) { alert('Ошибка отправки'); }
        };
    }

    // Запуск проверки авторизации при загрузке страницы
    checkAuth();
});