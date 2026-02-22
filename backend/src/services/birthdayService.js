const db = require('../models/database');
const telegramService = require('./telegramService');

// Telegram ID Андрея Билевича для получения уведомлений о днях рождения
const BIRTHDAY_NOTIFICATION_CHAT_ID = '1225102536';

/**
 * Проверяет дни рождения партнёров на сегодня и отправляет уведомление
 */
async function checkBirthdays() {
  try {
    // Находим партнёров с днём рождения сегодня (активных)
    const birthdayPartners = await db.all(`
      SELECT name, birthDate
      FROM partner
      WHERE strftime('%m-%d', birthDate) = strftime('%m-%d', 'now')
        AND active = 1
      ORDER BY name
    `);

    if (birthdayPartners.length === 0) {
      console.log('🎂 Сегодня нет именинников среди активных партнёров');
      return;
    }

    // Формируем список именинников
    const birthdayList = birthdayPartners
      .map(partner => `🎉 ${partner.name}`)
      .join('\n');

    const message = `🎂 *Дни рождения сегодня!*\n\n${birthdayList}\n\nВсего именинников: ${birthdayPartners.length}`;

    // Отправляем уведомление Андрею
    await telegramService.sendMessage(BIRTHDAY_NOTIFICATION_CHAT_ID, message);
    
    console.log(`🎂 Уведомление о ${birthdayPartners.length} именинниках отправлено в Telegram (ID: ${BIRTHDAY_NOTIFICATION_CHAT_ID})`);
    
    return birthdayPartners;
  } catch (error) {
    console.error('❌ Ошибка проверки дней рождения:', error);
    throw error;
  }
}

/**
 * Получить список всех партнёров с днями рождения
 */
async function getAllBirthdays() {
  try {
    const partners = await db.all(`
      SELECT name, birthDate, active
      FROM partner
      WHERE birthDate IS NOT NULL
      ORDER BY strftime('%m-%d', birthDate)
    `);

    return partners;
  } catch (error) {
    console.error('❌ Ошибка получения списка дней рождения:', error);
    throw error;
  }
}

module.exports = {
  checkBirthdays,
  getAllBirthdays,
  BIRTHDAY_NOTIFICATION_CHAT_ID
};
