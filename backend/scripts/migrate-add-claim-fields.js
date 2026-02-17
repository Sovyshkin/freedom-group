const db = require('../src/models/database');
require('dotenv').config();

async function migrate() {
  try {
    console.log('🚀 Начало миграции: добавление полей в таблицу claim...');
    
    await db.connect();
    
    // Проверяем, использует ли мы SQLite
    if (db.db && db.db.constructor.name === 'Database') {
      console.log('📊 Миграция SQLite базы данных...');
      
      // SQLite не поддерживает ALTER TABLE ADD COLUMN IF NOT EXISTS
      // Поэтому будем проверять существование колонок через PRAGMA
      const tableInfo = await new Promise((resolve, reject) => {
        db.db.all(`PRAGMA table_info(claim)`, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      
      const existingColumns = tableInfo.map(col => col.name);
      
      const columnsToAdd = [
        { name: 'type', sql: 'ALTER TABLE claim ADD COLUMN type TEXT' },
        { name: 'fullName', sql: 'ALTER TABLE claim ADD COLUMN fullName TEXT' },
        { name: 'created', sql: 'ALTER TABLE claim ADD COLUMN created DATETIME' },
        { name: 'currency', sql: 'ALTER TABLE claim ADD COLUMN currency TEXT DEFAULT "RUB"' }
      ];
      
      for (const column of columnsToAdd) {
        if (!existingColumns.includes(column.name)) {
          console.log(`  ➕ Добавление колонки: ${column.name}`);
          await db.run(column.sql);
        } else {
          console.log(`  ✓ Колонка ${column.name} уже существует`);
        }
      }
      
      console.log('✅ Миграция SQLite завершена!');
    } else {
      console.log('📊 Миграция MS SQL базы данных...');
      
      // MS SQL миграция
      const alterQueries = [
        `IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Claim') AND name = 'Type')
         ALTER TABLE dbo.Claim ADD Type varchar(100) NULL`,
        
        `IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Claim') AND name = 'FullName')
         ALTER TABLE dbo.Claim ADD FullName varchar(255) NULL`,
        
        `IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Claim') AND name = 'Created')
         ALTER TABLE dbo.Claim ADD Created datetime NULL`,
        
        `IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Claim') AND name = 'Currency')
         ALTER TABLE dbo.Claim ADD Currency varchar(10) DEFAULT 'RUB'`
      ];
      
      for (const query of alterQueries) {
        console.log('  ➕ Выполнение ALTER TABLE...');
        await db.query(query);
      }
      
      console.log('✅ Миграция MS SQL завершена!');
    }
    
    console.log('✅ Миграция успешно завершена!');
    
  } catch (error) {
    console.error('❌ Ошибка миграции:', error.message);
    throw error;
  } finally {
    await db.disconnect();
  }
}

// Запускаем миграцию
migrate().then(() => {
  console.log('✨ Все готово!');
  process.exit(0);
}).catch((err) => {
  console.error('💥 Миграция провалилась:', err);
  process.exit(1);
});
