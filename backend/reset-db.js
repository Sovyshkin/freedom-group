const fs = require('fs');
const path = require('path');
require('dotenv').config(); // Загружаем переменные окружения
const db = require('./src/models/database');

async function resetDatabase() {
  try {
    console.log('🔄 Сброс базы данных...');
    
    // Закрываем соединение если оно есть
    if (db.connected) {
      await db.disconnect();
    }
    
    // Удаляем файл базы данных
    const dbPath = process.env.DB_PATH || './database.sqlite';
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
      console.log('🗑️ Старая база данных удалена');
    }
    
    // Пересоздаем базу данных
    await db.connect();
    console.log('✅ База данных пересоздана');
    
    // Закрываем соединение
    await db.disconnect();
    
  } catch (error) {
    console.error('❌ Ошибка сброса базы данных:', error.message);
  }
}

// Запускаем сброс если файл запущен напрямую
if (require.main === module) {
  resetDatabase()
    .then(() => {
      console.log('🎉 Сброс завершен! Теперь можно запустить npm start');
      process.exit(0);
    })
    .catch(() => {
      process.exit(1);
    });
}

module.exports = resetDatabase;