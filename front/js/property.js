document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const propertyId = urlParams.get('id');

    const detailsWrapper = document.getElementById('property-details-wrapper');
    const errorPlaceholder = document.getElementById('property-error-placeholder');

    if (!propertyId) {
        if (errorPlaceholder) errorPlaceholder.style.display = 'block';
        return;
    }

    const token = localStorage.getItem('token');

    if (token) {
        try {
            const user = JSON.parse(atob(token.split('.')[1]));
            const cabinetLink = document.getElementById('nav-cabinet-link');
            if (cabinetLink) cabinetLink.innerText = user.role === 'OWNER' ? 'Панель владельца' : 'Профиль';
        } catch (e) {
            localStorage.clear();
        }
    }

    async function loadReviews() {
        const reviewsContainer = document.getElementById('reviews-container');
        try {
            const res = await fetch(`/api/properties/${propertyId}/reviews`);
            const result = await res.json();

            if (result.status === 'success' && result.data.length > 0) {
                reviewsContainer.innerHTML = '';
                result.data.forEach(review => {
                    const date = new Date(review.createdAt).toLocaleDateString('ru-RU');
                    const stars = '✦ '.repeat(review.rating).trim();

                    const reviewEl = document.createElement('div');
                    reviewEl.className = 'review-card';
                    reviewEl.innerHTML = `
                        <div class="review-header">
                            <span class="review-author">${review.user.name}</span>
                            <span class="review-date">${date}</span>
                        </div>
                        <div class="review-rating">${stars}</div>
                        <div class="review-text">${review.comment}</div>
                    `;
                    reviewsContainer.appendChild(reviewEl);
                });
            } else {
                reviewsContainer.innerHTML = '<p style="color: var(--text-secondary); font-size: 14px; grid-column: 1 / -1;">Отзывов пока нет.</p>';
            }
        } catch (error) {
            console.error('Ошибка загрузки отзывов');
        }
    }

    try {
        const res = await fetch(`/api/properties`);
        const result = await res.json();
        const property = result.data.find(p => p.id == propertyId);

        if (!property) {
            if (errorPlaceholder) errorPlaceholder.style.display = 'block';
            return;
        }

        document.getElementById('prop-detail-title').innerText = property.title;
        document.getElementById('prop-detail-address').innerText = property.address;

        // --- ПРОКАЧАННАЯ ГАЛЕРЕЯ С ЛИСТАНИЕМ СТРЕЛОЧКАМИ ---
        const propImg = document.getElementById('prop-detail-img');
        const imagesArray = property.images && property.images.length > 0 ? property.images : ['https://images.imagesimages.org/placeholder.jpg'];

        let currentImgIndex = 0;

        // Функция обновления главного фото и активной миниатюры
        const updateGallery = (index) => {
            currentImgIndex = index;
            if (propImg) {
                propImg.src = imagesArray[currentImgIndex];
            }

            // Подсвечиваем активную миниатюру бордером
            document.querySelectorAll('.thumb-img').forEach((thumb, idx) => {
                if (idx === currentImgIndex) {
                    thumb.style.borderColor = 'var(--accent-gold)';
                    thumb.style.opacity = '1';
                } else {
                    thumb.style.borderColor = 'transparent';
                    thumb.style.opacity = '0.6';
                }
            });
        };

        // Инициализация стартового фото
        if (propImg) {
            propImg.src = imagesArray[0];
            propImg.alt = property.title;

            // Навешиваем логику на стрелочки (если они есть в HTML)
            const prevBtn = document.getElementById('gallery-prev-btn');
            const nextBtn = document.getElementById('gallery-next-btn');

            if (prevBtn && nextBtn) {
                // Показываем стрелки только если фоток больше одной
                if (imagesArray.length > 1) {
                    prevBtn.style.display = 'flex';
                    nextBtn.style.display = 'flex';

                    prevBtn.onclick = (e) => {
                        e.stopPropagation();
                        let newIndex = currentImgIndex - 1;
                        if (newIndex < 0) newIndex = imagesArray.length - 1; // Зацикливание в конец
                        updateGallery(newIndex);
                    };

                    nextBtn.onclick = (e) => {
                        e.stopPropagation();
                        let newIndex = currentImgIndex + 1;
                        if (newIndex >= imagesArray.length) newIndex = 0; // Зацикливание в начало
                        updateGallery(newIndex);
                    };
                } else {
                    prevBtn.style.display = 'none';
                    nextBtn.style.display = 'none';
                }
            }

            // Генерируем миниатюры под главным фото
            const imgWrapper = propImg.parentElement;
            if (imgWrapper && !document.getElementById('prop-gallery-thumbs')) {
                const thumbsContainer = document.createElement('div');
                thumbsContainer.id = 'prop-gallery-thumbs';
                thumbsContainer.style.cssText = "display: flex; gap: 10px; margin-top: 15px; overflow-x: auto; padding-bottom: 5px; width: 100%;";

                imagesArray.forEach((imgUrl, idx) => {
                    const thumb = document.createElement('img');
                    thumb.src = imgUrl;
                    thumb.className = 'thumb-img';
                    thumb.style.cssText = "width: 90px; height: 65px; object-fit: cover; border-radius: 6px; cursor: pointer; border: 2px solid transparent; transition: all 0.2s; flex-shrink: 0; opacity: 0.6;";

                    // Клик на миниатюру ставит её на место большой
                    thumb.onclick = () => updateGallery(idx);

                    thumbsContainer.appendChild(thumb);
                });

                imgWrapper.after(thumbsContainer); // Вставляем строго ПОД обертку фото
                updateGallery(0); // Задаем начальную подсветку первой миниатюре
            }
        }
        // --------------------------------------------------

        document.getElementById('prop-detail-price').innerText = `${property.pricePerDay.toLocaleString()} ₽ / сутки`;

        document.getElementById('prop-detail-desc').innerText = property.description ||
            `Премиальные клубные апартаменты в комплексе EQUILIBRIUM. Полностью укомплектованы дизайнерской мебелью, бытовой техникой экстра-класса и готовы к комфортному посуточному проживанию.`;

        // Формируем список характеристик в столбик, скрывая пустые поля
        let specsHtml = '';

        if (property.category) {
            specsHtml += `<div style="display: block; margin-bottom: 10px;">✦ Категория: <strong>${property.category}</strong></div>`;
        }
        if (property.rooms) {
            specsHtml += `<div style="display: block; margin-bottom: 10px;">✦ Комнат: <strong>${property.rooms}</strong></div>`;
        }
        if (property.maxGuests) {
            specsHtml += `<div style="display: block; margin-bottom: 10px;">✦ Макс. гостей: <strong>${property.maxGuests}</strong></div>`;
        }
        // Если метро нет, или строка пустая, или там написано "Не указано" — пропускаем
        if (property.distanceToMetro && property.distanceToMetro.trim() !== '' && property.distanceToMetro !== 'Не указано') {
            specsHtml += `<div style="display: block; margin-bottom: 10px;">✦ Метро: <strong>${property.distanceToMetro}</strong></div>`;
        }
        // Если залог есть и он больше нуля — выводим, иначе скрываем строку совсем
        if (property.depositAmount && Number(property.depositAmount) > 0) {
            specsHtml += `<div style="display: block; margin-bottom: 10px;">✦ Залог: <strong>${property.depositAmount} ₽</strong></div>`;
        }

        const specsContainer = document.getElementById('prop-detail-specs');
        if (specsContainer) {
            // Принудительно отключаем flex и переводим контейнер в обычный блочный режим (в столбик)
            specsContainer.style.display = 'block';
            specsContainer.innerHTML = specsHtml;
        }

        if (detailsWrapper) detailsWrapper.style.display = 'block';

        loadReviews();

        const startInput = document.getElementById('detail-start-date');
        const endInput = document.getElementById('detail-end-date');
        const totalCalc = document.getElementById('detail-total-calc');

        const today = new Date().toISOString().split('T')[0];
        if (startInput && endInput) {
            startInput.min = today;
            endInput.min = today;

            const calculatePrice = () => {
                const start = new Date(startInput.value);
                const end = new Date(endInput.value);
                if (startInput.value && endInput.value && end > start) {
                    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24));
                    const total = days * property.pricePerDay;
                    totalCalc.innerText = `${total.toLocaleString()} ₽`;
                } else { totalCalc.innerText = `0 ₽`; }
            };

            startInput.onchange = calculatePrice;
            endInput.onchange = calculatePrice;
        }

        const bookingForm = document.getElementById('detail-booking-form');
        if (bookingForm) {
            bookingForm.onsubmit = async (e) => {
                e.preventDefault();
                if (!token) {
                    alert('Для бронирования необходимо войти в личный кабинет!');
                    window.location.href = 'login.html';
                    return;
                }

                const start = new Date(startInput.value);
                const end = new Date(endInput.value);
                const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24));
                const totalPrice = days * property.pricePerDay;

                try {
                    const bookingRes = await fetch('/api/bookings', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({ propertyId: property.id, startDate: startInput.value, endDate: endInput.value, totalPrice: totalPrice })
                    });
                    const bookingResult = await bookingRes.json();

                    if (bookingResult.status === 'success') {
                        alert('Успешно! Заявка отправлена владельцу.');
                        window.location.href = 'login.html';
                    } else { alert(bookingResult.message); }
                } catch (err) { alert('Ошибка при отправке запроса бронирования'); }
            };
        }

    } catch (err) {
        if (errorPlaceholder) errorPlaceholder.style.display = 'block';
    }
});