const db = require('../src/models/database');
require('dotenv').config();

async function migrateAddPartnerFields() {
  try {
    console.log('🚀 Миграция: Добавление полей birthDate и active в таблицу partner...');
    
    await db.connect();
    
    // Проверяем, существует ли уже колонка birthDate
    const tableInfo = await db.all("PRAGMA table_info(partner)");
    const birthDateExists = tableInfo.some(col => col.name === 'birthDate');
    const activeExists = tableInfo.some(col => col.name === 'active');
    
    if (!birthDateExists) {
      await db.run(`ALTER TABLE partner ADD COLUMN birthDate DATE`);
      console.log('✅ Добавлена колонка birthDate в таблицу partner');
    } else {
      console.log('ℹ️  Колонка birthDate уже существует');
    }
    
    if (!activeExists) {
      await db.run(`ALTER TABLE partner ADD COLUMN active INTEGER DEFAULT 1`);
      console.log('✅ Добавлена колонка active в таблицу partner');
      
      // Устанавливаем всем существующим партнерам active = 1
      await db.run(`UPDATE partner SET active = 1 WHERE active IS NULL`);
      console.log('✅ Установлен active = 1 для всех существующих партнеров');
    } else {
      console.log('ℹ️  Колонка active уже существует');
    }
    
    console.log('✅ Миграция завершена успешно!');
    
  } catch (error) {
    console.error('❌ Ошибка миграции:', error.message);
    throw error;
  } finally {
    await db.disconnect();
  }
}

// Запускаем миграцию если файл запущен напрямую
if (require.main === module) {
  migrateAddPartnerFields()
    .then(() => {
      console.log('✅ Готово!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Ошибка:', error);
      process.exit(1);
    });
}

module.exports = migrateAddPartnerFields;
