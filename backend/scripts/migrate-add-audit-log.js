const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'freedom.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  console.log('🔄 Создание таблицы audit_log...');
  
  db.run(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      admin_id INTEGER,
      admin_username TEXT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id INTEGER,
      entity_name TEXT,
      details TEXT,
      ip_address TEXT,
      user_agent TEXT
    )
  `, (err) => {
    if (err) {
      console.error('❌ Ошибка при создании таблицы audit_log:', err.message);
    } else {
      console.log('✅ Таблица audit_log успешно создана');
      
      // Создаем индексы для быстрого поиска
      db.run(`CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp DESC)`, (err) => {
        if (err) console.error('❌ Ошибка создания индекса idx_audit_timestamp:', err.message);
        else console.log('✅ Индекс idx_audit_timestamp создан');
      });
      
      db.run(`CREATE INDEX IF NOT EXISTS idx_audit_admin ON audit_log(admin_id)`, (err) => {
        if (err) console.error('❌ Ошибка создания индекса idx_audit_admin:', err.message);
        else console.log('✅ Индекс idx_audit_admin создан');
      });
      
      db.run(`CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id)`, (err) => {
        if (err) console.error('❌ Ошибка создания индекса idx_audit_entity:', err.message);
        else console.log('✅ Индекс idx_audit_entity создан');
        db.close();
      });
    }
  });
});
