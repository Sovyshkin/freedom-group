const db = require('../src/models/database');
require('dotenv').config();

async function migrateAddAdminRole() {
  try {
    console.log('🚀 Миграция: Добавление роли администратора...');
    
    await db.connect();
    
    // Проверяем, существует ли уже колонка role
    const tableInfo = await db.all("PRAGMA table_info(admin)");
    const roleColumnExists = tableInfo.some(col => col.name === 'role');
    
    if (!roleColumnExists) {
      // Добавляем колонку role
      await db.run(`
        ALTER TABLE admin ADD COLUMN role TEXT DEFAULT 'admin' CHECK(role IN ('superadmin', 'admin'))
      `);
      console.log('✅ Добавлена колонка role в таблицу admin');
      
      // Устанавливаем первому админу роль superadmin
      const superadminUsername = process.env.ADMIN_USERNAME || 'admin';
      await db.run(`
        UPDATE admin SET role = 'superadmin' WHERE username = ? AND role IS NULL
      `, [superadminUsername]);
      console.log(`✅ Установлена роль superadmin для ${superadminUsername}`);
    } else {
      console.log('ℹ️  Колонка role уже существует');
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
  migrateAddAdminRole()
    .then(() => {
      console.log('✅ Готово!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Ошибка:', error);
      process.exit(1);
    });
}

module.exports = migrateAddAdminRole;
