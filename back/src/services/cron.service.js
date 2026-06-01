const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Запускаем каждый час
cron.schedule('0 * * * *', async () => {
    console.log('[CRON] Запуск проверки автоматических сообщений...');
    try {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const startOfTomorrow = new Date(tomorrow.setHours(0, 0, 0, 0));
        const endOfTomorrow = new Date(tomorrow.setHours(23, 59, 59, 999));

        const startOfYesterday = new Date(new Date().setDate(today.getDate() - 1)).setHours(0, 0, 0, 0);
        const endOfYesterday = new Date(new Date().setDate(today.getDate() - 1)).setHours(23, 59, 59, 999);

        // 1. ОТПРАВКА BEFORE_CHECKIN (За день до заезда)
        const upcomingBookings = await prisma.booking.findMany({
            where: { status: 'CONFIRMED', startDate: { gte: startOfTomorrow, lt: endOfTomorrow } },
            include: { property: true }
        });

        for (const booking of upcomingBookings) {
            const template = await prisma.messageTemplate.findUnique({ where: { ownerId_trigger: { ownerId: booking.property.ownerId, trigger: 'BEFORE_CHECKIN' } } });
            if (template && template.isActive) {
                const alreadySent = await prisma.message.findFirst({ where: { bookingId: booking.id, content: template.content, isAuto: true } });
                if (!alreadySent) {
                    await prisma.message.create({ data: { content: template.content, isAuto: true, bookingId: booking.id, senderId: booking.property.ownerId, receiverId: booking.userId } });
                }
            }
        }

        // 2. ОТПРАВКА AFTER_CHECKOUT (После выезда)
        const finishedBookings = await prisma.booking.findMany({
            where: { status: 'CONFIRMED', endDate: { gte: new Date(startOfYesterday), lt: new Date(endOfYesterday) } },
            include: { property: true }
        });

        for (const booking of finishedBookings) {
            const template = await prisma.messageTemplate.findUnique({ where: { ownerId_trigger: { ownerId: booking.property.ownerId, trigger: 'AFTER_CHECKOUT' } } });
            if (template && template.isActive) {
                const alreadySent = await prisma.message.findFirst({ where: { bookingId: booking.id, content: template.content, isAuto: true } });
                if (!alreadySent) {
                    await prisma.message.create({ data: { content: template.content, isAuto: true, bookingId: booking.id, senderId: booking.property.ownerId, receiverId: booking.userId } });
                }
            }
        }
    } catch (error) { console.error('[CRON] Ошибка:', error); }
});