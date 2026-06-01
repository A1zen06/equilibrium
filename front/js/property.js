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
        } catch(e) { 
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
        
        const propImg = document.getElementById('prop-detail-img');
        propImg.src = property.image || 'https://images.imagesimages.org/placeholder.jpg';
        propImg.alt = property.title;
        
        document.getElementById('prop-detail-price').innerText = `${property.pricePerDay.toLocaleString()} ₽ / сутки`;
        
        document.getElementById('prop-detail-desc').innerText = property.description || 
            `Премиальные клубные апартаменты в комплексе EQUILIBRIUM. Полностью укомплектованы дизайнерской мебелью, бытовой техникой экстра-класса и готовы к комфортному посуточному проживанию.`;

        document.getElementById('prop-detail-specs').innerHTML = `
            <div>✦ Категория: <strong>${property.category || 'Апартаменты'}</strong></div>
            <div>✦ Комнат: <strong>${property.rooms || 1}</strong></div>
            <div>✦ Макс. гостей: <strong>${property.maxGuests || 2}</strong></div>
            <div>✦ Метро: <strong>${property.distanceToMetro || 'Не указано'}</strong></div>
            <div>✦ Залог: <strong>${property.depositAmount ? property.depositAmount + ' ₽' : 'Без залога'}</strong></div>
        `;

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
                } catch(err) { alert('Ошибка при отправке запроса бронирования'); }
            };
        }

    } catch(err) {
        if (errorPlaceholder) errorPlaceholder.style.display = 'block';
    }
});