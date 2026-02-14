const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config();

class Database {
  constructor() {
    this.db = null;
    this.connected = false;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      if (this.connected && this.db) {
        return resolve(this.db);
      }

      const dbPath = process.env.DB_PATH || './database.sqlite';
      this.db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('❌ Ошибка подключения к базе данных:', err.message);
          reject(err);
        } else {
          this.connected = true;
          console.log('✅ Подключение к SQLite базе данных установлено');
          // Инициализируем таблицы после подключения
          this.initializeTables().then(() => {
            resolve(this.db);
          }).catch(reject);
        }
      });
    });
  }

  async disconnect() {
    return new Promise((resolve, reject) => {
      if (this.db && this.connected) {
        this.db.close((err) => {
          if (err) {
            console.error('❌ Ошибка закрытия базы данных:', err.message);
            reject(err);
          } else {
            this.connected = false;
            console.log('✅ Соединение с базой данных закрыто');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  async initializeTables() {
    try {
      const tables = `
        CREATE TABLE IF NOT EXISTS admin (
          inc INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          pswHash TEXT NOT NULL,
          email TEXT,
          lastLogin DATETIME,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS partner (
          partnerId INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          telegram TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS partpass (
          partnerId INTEGER,
          alias TEXT UNIQUE NOT NULL,
          pswHash TEXT,
          active INTEGER DEFAULT 0,
          failedAttempts INTEGER DEFAULT 0,
          lockUntil DATETIME,
          lastVisit DATETIME,
          FOREIGN KEY (partnerId) REFERENCES partner(partnerId)
        );

        CREATE TABLE IF NOT EXISTS claim (
          inc INTEGER PRIMARY KEY AUTOINCREMENT,
          partnerId INTEGER,
          dateBeg DATE,
          dateEnd DATE,
          amount DECIMAL(10,2),
          payAmount DECIMAL(10,2),
          taxAmount DECIMAL(10,2),
          publishedAt DATETIME,
          FOREIGN KEY (partnerId) REFERENCES partner(partnerId)
        );

        CREATE TABLE IF NOT EXISTS document (
          inc INTEGER PRIMARY KEY AUTOINCREMENT,
          claimId INTEGER,
          filename TEXT NOT NULL,
          content BLOB NOT NULL,
          size INTEGER,
          mimetype TEXT,
          uploadedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (claimId) REFERENCES claim(inc)
        );

        CREATE TABLE IF NOT EXISTS auditLog (
          inc INTEGER PRIMARY KEY AUTOINCREMENT,
          userId INTEGER,
          userType TEXT,
          action TEXT,
          details TEXT,
          ipAddress TEXT,
          userAgent TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS password_reset_tokens (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          partnerId INTEGER,
          token TEXT UNIQUE NOT NULL,
          expireAt DATETIME NOT NULL,
          used BOOLEAN DEFAULT 0,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (partnerId) REFERENCES partner(partnerId)
        );
      `;

      const queries = tables.split(';').filter(query => query.trim());
      
      for (const query of queries) {
        if (query.trim()) {
          await this.run(query);
        }
      }

      // Создаем администратора по умолчанию
      await this.createDefaultAdmin();
      
    } catch (error) {
      console.error('❌ Ошибка инициализации таблиц:', error.message);
      throw error;
    }
  }

  async createDefaultAdmin() {
    try {
      const adminUsername = process.env.ADMIN_USERNAME || 'admin';
      const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
      
      const existingAdmin = await this.get(
        'SELECT * FROM admin WHERE username = ?', 
        [adminUsername]
      );
      
      if (!existingAdmin) {
        const passwordHash = await bcrypt.hash(adminPassword, 12);
        await this.run(
          'INSERT INTO admin (username, pswHash, email) VALUES (?, ?, ?)',
          [adminUsername, passwordHash, 'admin@freedom-group.com']
        );
        console.log(`✅ Создан администратор: ${adminUsername}`);
      }
    } catch (error) {
      console.error('❌ Ошибка создания администратора:', error.message);
    }
  }

  // Вспомогательные методы для работы с SQLite
  async ensureConnection() {
    if (!this.connected || !this.db) {
      await this.connect();
    }
  }

  async run(sql, params = []) {
    await this.ensureConnection();
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  async get(sql, params = []) {
    await this.ensureConnection();
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  }

  async all(sql, params = []) {
    await this.ensureConnection();
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  // API методы для работы с данными
  async getAdminByUsername(username) {
    const result = await this.get('SELECT * FROM admin WHERE username = ?', [username]);
    console.log('🔍 Администратор найден:', result ? 'Да' : 'Нет');
    if (result) {
      console.log('👤 Данные администратора:', { 
        username: result.username, 
        hasPassword: !!result.pswHash,
        email: result.email 
      });
    }
    return result;
  }

  async updateAdminLastLogin(adminId) {
    return this.run(
      'UPDATE admin SET lastLogin = CURRENT_TIMESTAMP WHERE inc = ?', 
      [adminId]
    );
  }

  async getPartnerAuth(alias) {
    return this.get(`
      SELECT p.partnerId, p.name, p.email, pp.alias, pp.pswHash, pp.active, 
             pp.failedAttempts, pp.lockUntil, pp.lastVisit
      FROM partner p
      JOIN partpass pp ON p.partnerId = pp.partnerId
      WHERE pp.alias = ?
    `, [alias]);
  }

  async getPartnerByEmail(email) {
    return this.get('SELECT * FROM partner WHERE email = ?', [email]);
  }

  async updateFailedAttempts(partnerId, attempts, lockUntil) {
    return this.run(
      'UPDATE partpass SET failedAttempts = ?, lockUntil = ? WHERE partnerId = ?',
      [attempts, lockUntil, partnerId]
    );
  }

  async updateLastVisit(partnerId) {
    return this.run(
      'UPDATE partpass SET lastVisit = CURRENT_TIMESTAMP WHERE partnerId = ?',
      [partnerId]
    );
  }

  async getPartnerDocuments(partnerId, filters = {}) {
    let sql = `
      SELECT c.inc as claimId, c.dateBeg, c.dateEnd, c.amount, c.payAmount, 
             c.taxAmount, c.publishedAt, d.filename, d.size, d.mimetype
      FROM claim c
      LEFT JOIN document d ON c.inc = d.claimId
      WHERE c.partnerId = ?
    `;
    const params = [partnerId];

    if (filters.startDate) {
      sql += ' AND c.dateBeg >= ?';
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      sql += ' AND c.dateEnd <= ?';
      params.push(filters.endDate);
    }

    sql += ' ORDER BY c.publishedAt DESC';
    
    return this.all(sql, params);
  }

  async getClaimsForProcessing() {
    return this.all(`
      SELECT c.*, p.name as partnerName, p.email as partnerEmail, p.telegram as partnerTelegram
      FROM claim c
      JOIN partner p ON c.partnerId = p.partnerId
      WHERE c.publishedAt IS NULL
      ORDER BY c.inc
    `);
  }

  async publishDocument(claimId) {
    return this.run(
      'UPDATE claim SET publishedAt = CURRENT_TIMESTAMP WHERE inc = ?',
      [claimId]
    );
  }

  async logAction(action, details = '', userId = null, userType = 'system', ipAddress = '', userAgent = '') {
    try {
      await this.run(
        `INSERT INTO auditLog (userId, userType, action, details, ipAddress, userAgent) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, userType, action, details, ipAddress, userAgent]
      );
    } catch (error) {
      console.error('Ошибка логирования:', error.message);
    }
  }

  // Метод для получения всех партнеров (для админки)
  async getAllPartners() {
    return this.all(`
      SELECT p.partnerId as Inc, p.name as Name, p.email as Email, '' as Telegram, 
             p.createdAt as CreatedAt, 1 as IsActive,
             pp.alias as Alias, pp.active as PasswordSet, pp.lastVisit as LastVisit
      FROM partner p
      LEFT JOIN partpass pp ON p.partnerId = pp.partnerId
      ORDER BY p.createdAt DESC
    `);
  }

  // Метод для получения неопубликованных документов
  async getUnpublishedClaims() {
    return this.all(`
      SELECT inc, fileName, originalName, uploadedAt, partnerId, fileSize
      FROM claim 
      WHERE publishedAt IS NULL
      ORDER BY uploadedAt DESC
    `);
  }

  // Метод для получения статистики админа
  async getAdminStats() {
    const stats = {};
    
    // Общее количество партнеров
    const partnersCount = await this.get('SELECT COUNT(*) as count FROM partner');
    stats.totalPartners = partnersCount?.count || 0;
    
    // Количество документов за месяц
    const documentsCount = await this.get(`
      SELECT COUNT(*) as count FROM claim 
      WHERE publishedAt IS NOT NULL 
      AND datetime(uploadedAt) > datetime('now', '-1 month')
    `);
    stats.documentsThisMonth = documentsCount?.count || 0;
    
    // Количество неопубликованных документов
    const unpublishedCount = await this.get('SELECT COUNT(*) as count FROM claim WHERE publishedAt IS NULL');
    stats.unpublishedDocuments = unpublishedCount?.count || 0;
    
    // Последние действия (заглушка)
    stats.recentActions = [];
    
    return stats;
  }

  // Метод для создания партнера
  async createPartner({ name, email, telegram, alias }) {
    const transaction = await this.beginTransaction();
    
    try {
      // Создаем уникальный алиас если не указан
      let finalAlias = alias;
      if (!finalAlias) {
        // Генерируем алиас из имени
        finalAlias = name.toLowerCase()
          .replace(/[^a-zA-Z0-9а-яё]/gi, '')
          .substring(0, 10);
        
        // Добавляем случайные цифры для уникальности
        finalAlias += Math.floor(Math.random() * 1000);
      }
      
      // Проверяем уникальность алиаса
      const existingAlias = await this.get('SELECT alias FROM partpass WHERE alias = ?', [finalAlias]);
      if (existingAlias) {
        finalAlias += Math.floor(Math.random() * 10000);
      }
      
      // Проверяем уникальность email
      const existingEmail = await this.get('SELECT email FROM partner WHERE email = ?', [email]);
      if (existingEmail) {
        throw new Error('Партнер с таким email уже существует');
      }
      
      // Создаем запись партнера
      const partnerResult = await this.run(`
        INSERT INTO partner (name, email, createdAt)
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `, [name, email]);
      
      const partnerId = partnerResult.lastID;
      
      // Создаем запись для авторизации
      await this.run(`
        INSERT INTO partpass (partnerId, alias, active, createdAt)
        VALUES (?, ?, 0, CURRENT_TIMESTAMP)
      `, [partnerId, finalAlias]);
      
      await this.commit();
      
      return {
        partnerId,
        alias: finalAlias,
        name,
        email,
        telegram: telegram || null
      };
      
    } catch (error) {
      await this.rollback();
      throw error;
    }
  }

  // Метод для создания токена сброса пароля
  async createPasswordResetToken(partnerId, token, expireAt) {
    return this.run(`
      INSERT OR REPLACE INTO password_reset_tokens (partnerId, token, expireAt, createdAt)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `, [partnerId, token, expireAt.toISOString()]);
  }

  // Методы для работы с транзакциями
  async beginTransaction() {
    return this.run('BEGIN TRANSACTION');
  }
  
  async commit() {
    return this.run('COMMIT');
  }
  
  async rollback() {
    return this.run('ROLLBACK');
  }

  // Заглушки для методов, которые требуют более сложной логики
  async createPartnerFromExcel(excelData) {
    // Заглушка - в реальном проекте здесь будет логика создания партнеров из Excel
    console.log('📊 Обработка Excel файла - заглушка для разработки');
    return { processed: 0, errors: [] };
  }
}

module.exports = new Database();