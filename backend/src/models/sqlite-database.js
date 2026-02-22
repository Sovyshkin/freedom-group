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
          role TEXT DEFAULT 'admin' CHECK(role IN ('superadmin', 'admin')),
          lastLogin DATETIME,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS partner (
          partnerId INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          telegram TEXT,
          birthDate DATE,
          active INTEGER DEFAULT 1,
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
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (partnerId) REFERENCES partner(partnerId)
        );

        CREATE TABLE IF NOT EXISTS claim (
          inc INTEGER PRIMARY KEY AUTOINCREMENT,
          partnerId INTEGER,
          type TEXT,
          fullName TEXT,
          created DATETIME,
          dateBeg DATE,
          dateEnd DATE,
          amount DECIMAL(10,2),
          payAmount DECIMAL(10,2),
          taxAmount DECIMAL(10,2),
          currency TEXT DEFAULT 'RUB',
          publishedAt DATETIME,
            fileName TEXT,
            originalName TEXT,
            uploadedAt DATETIME,
            fileSize INTEGER,
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

  // Методы для управления админами (только для superadmin)
  async getAllAdmins() {
    return this.all('SELECT inc, username, email, role, lastLogin, createdAt FROM admin ORDER BY createdAt DESC');
  }

  async createAdmin(username, passwordHash, email, role = 'admin') {
    const result = await this.run(`
      INSERT INTO admin (username, pswHash, email, role)
      VALUES (?, ?, ?, ?)
    `, [username, passwordHash, email, role]);
    return result.id;
  }

  async updateAdminPassword(adminId, passwordHash) {
    return this.run(
      'UPDATE admin SET pswHash = ? WHERE inc = ?',
      [passwordHash, adminId]
    );
  }

  async updateAdmin(adminId, username, email) {
    return this.run(
      'UPDATE admin SET username = ?, email = ? WHERE inc = ?',
      [username, email, adminId]
    );
  }

  async deleteAdmin(adminId) {
    return this.run('DELETE FROM admin WHERE inc = ? AND role != ?', [adminId, 'superadmin']);
  }

  async getPartnerAuth(login) {
    return this.get(`
      SELECT p.partnerId, p.name, p.email, pp.alias, pp.pswHash, pp.active, 
             pp.failedAttempts, pp.lockUntil, pp.lastVisit
      FROM partner p
      JOIN partpass pp ON p.partnerId = pp.partnerId
      WHERE pp.alias = ? OR p.email = ?
    `, [login, login]);
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

  async getPartnerByInc(inc) {
    const partner = await this.get('SELECT * FROM partner WHERE partnerId = ?', [inc]);
    if (partner) {
      // Добавляем поле Inc для совместимости с кодом
      partner.Inc = partner.partnerId;
      partner.Name = partner.name;
      partner.Email = partner.email;
      partner.Telegram = partner.telegram;
      partner.BirthDate = partner.birthDate;
      partner.Active = partner.active;
      partner.CreatedAt = partner.createdAt;
      partner.IsActive = partner.active; // Для совместимости с существующим кодом
    }
    return partner;
  }

  async getPartnerClaims(partnerId) {
    const rows = await this.all(`
      SELECT 
        c.inc as ClaimId,
        c.publishedAt as PublishedAt,
        c.created as Created,
        c.dateBeg as DateBeg,
        c.dateEnd as DateEnd,
        c.amount as Amount,
        c.payAmount as PayAmount,
        c.taxAmount as TaxAmount,
        d.filename as FileName,
        d.size as FileSize,
        d.inc as DocumentId
      FROM claim c
      LEFT JOIN document d ON c.inc = d.claimId
      WHERE c.partnerId = ? AND c.publishedAt IS NOT NULL
      ORDER BY c.publishedAt DESC
    `, [partnerId]);
    
    // Преобразуем даты в строки
    return rows.map(row => ({
      ...row,
      DateBeg: new Date(row.DateBeg).toISOString().split('T')[0],
      DateEnd: new Date(row.DateEnd).toISOString().split('T')[0],
      Created: row.Created ? (new Date(row.Created)).toISOString() : null
    }));
  }

  async getPartnerDocuments(partnerId, filters = {}) {
    let sql = `
      SELECT c.inc as claimId, c.dateBeg, c.dateEnd, c.amount, c.payAmount, 
             c.taxAmount, c.publishedAt, 
             c.created,
             COALESCE(c.created, c.dateBeg) as Created,
             d.filename, d.size, d.mimetype, d.inc as documentId
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

    sql += ' ORDER BY COALESCE(c.created, c.publishedAt, c.dateBeg) DESC';
    
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
      SELECT p.partnerId as Inc, p.name as Name, p.email as Email, p.telegram as Telegram, 
             p.birthDate as BirthDate, p.active as Active, p.active as IsActive,
             p.createdAt as CreatedAt,
             pp.alias as Alias, CASE WHEN pp.pswHash IS NOT NULL THEN 1 ELSE 0 END as PasswordSet, pp.lastVisit as LastVisit
      FROM partner p
      LEFT JOIN partpass pp ON p.partnerId = pp.partnerId
      ORDER BY p.createdAt DESC
    `);
  }

  // Метод для получения неопубликованных документов
  async getUnpublishedClaims() {
    return this.all(`
      SELECT c.inc,
             COALESCE(c.fileName, d.filename) as fileName,
             c.originalName, c.uploadedAt, c.partnerId, c.fileSize,
             c.dateBeg, c.dateEnd, p.name as PartnerName, c.created as Created
      FROM claim c
      LEFT JOIN partner p ON c.partnerId = p.partnerId
      LEFT JOIN document d ON d.claimId = c.inc
      WHERE c.publishedAt IS NULL
      GROUP BY c.inc
      ORDER BY c.uploadedAt DESC
    `);
  }

  async createClaim({ partnerId, dateBeg, dateEnd, amount, payAmount, taxAmount, type, fullName, created, currency }) {
    const result = await this.run(`
      INSERT INTO claim (partnerId, dateBeg, dateEnd, amount, payAmount, taxAmount, type, fullName, created, currency)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [partnerId, dateBeg, dateEnd, amount, payAmount, taxAmount, type || '', fullName || '', created || new Date(), currency || 'RUB']);
    return result.id;
  }

  async saveDocument(claimId, fileName, fileBuffer, fileSize, mimeType) {
    const result = await this.run(`
      INSERT INTO document (claimId, filename, content, size, mimetype)
      VALUES (?, ?, ?, ?, ?)
    `, [claimId, fileName, fileBuffer, fileSize, mimeType]);
    return result.id;
  }

  // Метод для получения статистики админа
  async getAdminStats() {
    const stats = {};
    
    // Общее количество партнеров
    const partnersCount = await this.get('SELECT COUNT(*) as count FROM partner');
    stats.totalPartners = partnersCount?.count || 0;
    
    // Количество документов, опубликованных за текущий месяц
    const documentsCount = await this.get(`
      SELECT COUNT(*) as count FROM claim 
      WHERE publishedAt IS NOT NULL 
      AND strftime('%Y-%m', publishedAt) = strftime('%Y-%m', 'now')
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
  async createPartner({ name, email, telegram, alias, password, birthDate, active = 1 }) {
    const transaction = await this.beginTransaction();
    
    try {
      // Используем переданный алиас (теперь он обязательный)
      let finalAlias = alias.trim();
      
      // Проверяем уникальность алиаса
      let existingAlias = await this.get('SELECT alias FROM partpass WHERE alias = ?', [finalAlias]);
      let counter = 0;
      while (existingAlias && counter < 100) {
        finalAlias = alias.trim() + Math.floor(Math.random() * 10000);
        existingAlias = await this.get('SELECT alias FROM partpass WHERE alias = ?', [finalAlias]);
        counter++;
      }

      
      // Проверяем уникальность email
      const existingEmail = await this.get('SELECT email FROM partner WHERE email = ?', [email]);
      if (existingEmail) {
        throw new Error('Партнер с таким email уже существует');
      }
      
      // Создаем запись партнера
      const partnerResult = await this.run(`
        INSERT INTO partner (name, email, telegram, birthDate, active, createdAt)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [name, email, telegram || null, birthDate || null, active ? 1 : 0]);
      
      const partnerId = partnerResult.id;
      
      // Хэшируем пароль (теперь он обязательный)
      const pswHash = await bcrypt.hash(password, 12);
      
      // Создаем запись для авторизации
      await this.run(`
        INSERT INTO partpass (partnerId, alias, pswHash, active, createdAt)
        VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
      `, [partnerId, finalAlias, pswHash]);
      
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

  // Метод для получения токена сброса пароля
  async getPasswordResetToken(token) {
    const resetData = await this.get(`
      SELECT 
        prt.id,
        prt.partnerId as PartnerId,
        prt.token,
        prt.expireAt,
        prt.used,
        p.email as Email,
        p.name
      FROM password_reset_tokens prt
      INNER JOIN partner p ON prt.partnerId = p.partnerId
      WHERE prt.token = ? AND prt.used = 0 AND datetime(prt.expireAt) > datetime('now')
    `, [token]);
    
    return resetData;
  }

  // Метод для пометки токена как использованного
  async markTokenAsUsed(token) {
    return this.run(`
      UPDATE password_reset_tokens 
      SET used = 1 
      WHERE token = ?
    `, [token]);
  }

  // Метод для обновления пароля партнера
  async updatePartnerPassword(partnerId, passwordHash) {
    return this.run(`
      UPDATE partpass 
      SET pswHash = ?, active = 1 
      WHERE partnerId = ?
    `, [passwordHash, partnerId]);
  }

  // Метод для обновления партнера
  async updatePartner(partnerId, { name, email, telegram, alias, password, birthDate, active = 1 }) {
    const transaction = await this.beginTransaction();
    
    try {
      // Проверяем уникальность email (кроме текущего партнера)
      const existingEmail = await this.get('SELECT partnerId FROM partner WHERE email = ? AND partnerId != ?', [email, partnerId]);
      if (existingEmail) {
        throw new Error('Партнер с таким email уже существует');
      }
      
      // Проверяем уникальность алиаса (кроме текущего партнера)
      const existingAlias = await this.get('SELECT partnerId FROM partpass WHERE alias = ? AND partnerId != ?', [alias, partnerId]);
      if (existingAlias) {
        throw new Error('Партнер с таким логином уже существует');
      }
      
      // Обновляем данные партнера
      await this.run(`
        UPDATE partner SET name = ?, email = ?, telegram = ?, birthDate = ?, active = ? WHERE partnerId = ?
      `, [name, email, telegram || null, birthDate || null, active, partnerId]);
      
      // Обновляем алиас
      await this.run(`
        UPDATE partpass SET alias = ? WHERE partnerId = ?
      `, [alias, partnerId]);
      
      // Обновляем пароль если указан
      if (password) {
        const pswHash = await bcrypt.hash(password, 12);
        await this.run(`
          UPDATE partpass SET pswHash = ?, active = 1 WHERE partnerId = ?
        `, [pswHash, partnerId]);
      }
      
      await this.commit();
      
      return {
        partnerId,
        name,
        email,
        telegram,
        alias
      };
      
    } catch (error) {
      await this.rollback();
      throw error;
    }
  }

  // Метод для удаления партнера
  async deletePartner(partnerId) {
    const transaction = await this.beginTransaction();
    
    try {
      // Удаляем связанные записи
      await this.run('DELETE FROM password_reset_tokens WHERE partnerId = ?', [partnerId]);
      await this.run('DELETE FROM auditLog WHERE userId = ? AND userType = ?', [partnerId, 'partner']);
      await this.run('DELETE FROM document WHERE claimId IN (SELECT inc FROM claim WHERE partnerId = ?)', [partnerId]);
      await this.run('DELETE FROM claim WHERE partnerId = ?', [partnerId]);
      await this.run('DELETE FROM partpass WHERE partnerId = ?', [partnerId]);
      await this.run('DELETE FROM partner WHERE partnerId = ?', [partnerId]);
      
      await this.commit();
      
    } catch (error) {
      await this.rollback();
      throw error;
    }
  }

  // Метод для получения документов партнера
  async getPartnerDocuments(partnerId) {
    return this.all(`
      SELECT c.inc, c.dateBeg, c.dateEnd, c.amount, c.payAmount, c.taxAmount, c.publishedAt,
             c.fileName, c.originalName, c.uploadedAt, c.fileSize,
             d.filename, d.size, d.mimetype
      FROM claim c
      LEFT JOIN document d ON c.inc = d.claimId
      WHERE c.partnerId = ?
      ORDER BY c.uploadedAt DESC
    `, [partnerId]);
  }

  // Методы для работы с audit log
  async createAuditLog(logData) {
    const {
      adminId,
      adminUsername,
      action,
      entityType,
      entityId,
      entityName,
      details,
      ipAddress,
      userAgent
    } = logData;
    // Сохраняем лог в существующую таблицу `auditLog`.
    // В поле `details` сохраняем полезную полезную нагрузку как JSON.
    const payload = {
      adminId,
      adminUsername,
      action,
      entityType: entityType || null,
      entityId: entityId || null,
      entityName: entityName || null,
      details: details || null,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null
    };

    return this.run(
      `INSERT INTO auditLog (userId, userType, action, details, ipAddress, userAgent) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        adminId,
        'admin',
        action,
        JSON.stringify(payload),
        ipAddress || null,
        userAgent || null
      ]
    );
  }

  async getAuditLogs(filters = {}) {
    // Берём строки из auditLog и присоединяем таблицу admin для получения имени админа
    let query = `SELECT al.*, a.username as admin_username FROM auditLog al LEFT JOIN admin a ON a.inc = al.userId WHERE 1=1`;
    const params = [];

    if (filters.adminId) {
      query += ' AND al.userId = ?';
      params.push(filters.adminId);
    }

    if (filters.action) {
      query += ' AND al.action = ?';
      params.push(filters.action);
    }

    if (filters.dateFrom) {
      query += ' AND al.createdAt >= ?';
      params.push(filters.dateFrom);
    }

    if (filters.dateTo) {
      query += ' AND al.createdAt <= ?';
      params.push(filters.dateTo);
    }

    if (filters.search) {
      query += ' AND (a.username LIKE ? OR al.action LIKE ? OR al.details LIKE ?)';
      const searchPattern = `%${filters.search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    query += ' ORDER BY al.createdAt DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    if (filters.offset) {
      query += ' OFFSET ?';
      params.push(filters.offset);
    }

    return this.all(query, params);
  }

  async getAuditLogsCount(filters = {}) {
    let query = 'SELECT COUNT(*) as count FROM auditLog al LEFT JOIN admin a ON a.inc = al.userId WHERE 1=1';
    const params = [];

    if (filters.adminId) {
      query += ' AND al.userId = ?';
      params.push(filters.adminId);
    }

    if (filters.action) {
      query += ' AND al.action = ?';
      params.push(filters.action);
    }

    if (filters.dateFrom) {
      query += ' AND al.createdAt >= ?';
      params.push(filters.dateFrom);
    }

    if (filters.dateTo) {
      query += ' AND al.createdAt <= ?';
      params.push(filters.dateTo);
    }

    if (filters.search) {
      query += ' AND (a.username LIKE ? OR al.action LIKE ? OR al.details LIKE ?)';
      const searchPattern = `%${filters.search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    const result = await this.get(query, params);
    return result ? result.count : 0;
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