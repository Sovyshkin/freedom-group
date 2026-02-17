// Выбираем базу данных в зависимости от настроек
require('dotenv').config();

const dbType = process.env.DB_TYPE || 'mssql';

if (dbType === 'sqlite') {
  // Используем SQLite для разработки
  module.exports = require('./sqlite-database');
} else {
  // Используем MS SQL Server для продакшена
  const sql = require('mssql');
  const bcrypt = require('bcryptjs');

const config = {
  server: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 1433,
  database: process.env.DB_NAME || 'freedom_group',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: false, // Set to true for Azure
    trustServerCertificate: true,
    enableArithAbort: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

class Database {
  constructor() {
    this.pool = null;
    this.connected = false;
  }

  async connect() {
    try {
      if (!this.connected) {
        this.pool = await sql.connect(config);
        this.connected = true;
        console.log('✅ Подключение к базе данных установлено');
      }
      return this.pool;
    } catch (error) {
      console.error('❌ Ошибка подключения к базе данных:', error.message);
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.connected && this.pool) {
        await this.pool.close();
        this.connected = false;
        console.log('✅ Соединение с базой данных закрыто');
      }
    } catch (error) {
      console.error('❌ Ошибка при закрытии соединения:', error.message);
    }
  }

  async query(queryText, params = {}) {
    try {
      const pool = await this.connect();
      const request = pool.request();
      
      // Добавляем параметры
      Object.keys(params).forEach(key => {
        request.input(key, params[key]);
      });
      
      const result = await request.query(queryText);
      return result;
    } catch (error) {
      console.error('❌ Ошибка выполнения запроса:', error.message);
      throw error;
    }
  }

  async execute(procedureName, params = {}) {
    try {
      const pool = await this.connect();
      const request = pool.request();
      
      // Добавляем параметры
      Object.keys(params).forEach(key => {
        request.input(key, params[key]);
      });
      
      const result = await request.execute(procedureName);
      return result;
    } catch (error) {
      console.error('❌ Ошибка выполнения процедуры:', error.message);
      throw error;
    }
  }

  // Методы для работы с партнерами
  async getPartnerByInc(inc) {
    const result = await this.query(
      'SELECT * FROM dbo.Partner WHERE Inc = @inc AND IsActive = 1',
      { inc }
    );
    return result.recordset[0];
  }

  async getPartnerByEmail(email) {
    const result = await this.query(
      'SELECT * FROM dbo.Partner WHERE Email = @email AND IsActive = 1',
      { email }
    );
    return result.recordset[0];
  }

  async getPartnerAuth(alias) {
    const result = await this.query(`
      SELECT p.Inc as PartnerId, p.Name, p.Email, pp.Alias, pp.PswHash, 
             pp.Active, pp.FailedAttempts, pp.LockUntil
      FROM dbo.Partner p
      INNER JOIN dbo.Partpass pp ON p.Inc = pp.Partner
      WHERE pp.Alias = @alias AND p.IsActive = 1
    `, { alias });
    return result.recordset[0];
  }

  async updateLastVisit(partnerId) {
    await this.query(
      'UPDATE dbo.Partpass SET LastVisit = GETDATE() WHERE Partner = @partnerId',
      { partnerId }
    );
  }

  async updateFailedAttempts(partnerId, attempts, lockUntil = null) {
    await this.query(`
      UPDATE dbo.Partpass 
      SET FailedAttempts = @attempts, LockUntil = @lockUntil 
      WHERE Partner = @partnerId
    `, { partnerId, attempts, lockUntil });
  }

  // Методы для работы с claims
  async getPartnerClaims(partnerId) {
    const result = await this.query(
      'SELECT * FROM dbo.vw_PartnerDocuments WHERE PartnerId = @partnerId ORDER BY PublishedAt DESC',
      { partnerId }
    );
    return result.recordset;
  }

  async createClaim(claimData) {
    const { partnerId, dateBeg, dateEnd, amount, payAmount, taxAmount, type, fullName, created, currency } = claimData;
    const result = await this.query(`
      INSERT INTO dbo.Claim (Partner, DateBeg, DateEnd, Amount, PayAmount, TaxAmount, Type, FullName, Created, Currency)
      OUTPUT INSERTED.Inc
      VALUES (@partnerId, @dateBeg, @dateEnd, @amount, @payAmount, @taxAmount, @type, @fullName, @created, @currency)
    `, { partnerId, dateBeg, dateEnd, amount, payAmount, taxAmount, type: type || '', fullName: fullName || '', created: created || new Date(), currency: currency || 'RUB' });
    return result.recordset[0].Inc;
  }

  async getUnpublishedClaims() {
    const result = await this.query(`
      SELECT c.*, p.Name as PartnerName, p.Email as PartnerEmail,
             d.FileName, d.FileSize
      FROM dbo.Claim c
      INNER JOIN dbo.Partner p ON c.Partner = p.Inc
      LEFT JOIN dbo.Document d ON c.Inc = d.Claim
      WHERE c.Published = 0
      ORDER BY c.Cdate DESC
    `);
    return result.recordset;
  }

  // Методы для работы с документами
  async saveDocument(claimId, fileName, fileBinary, fileSize, contentType) {
    const result = await this.query(`
      INSERT INTO dbo.Document (Claim, FileName, FileBinary, FileSize, ContentType)
      OUTPUT INSERTED.Inc
      VALUES (@claimId, @fileName, @fileBinary, @fileSize, @contentType)
    `, { claimId, fileName, fileBinary, fileSize, contentType });
    return result.recordset[0].Inc;
  }

  async getDocument(documentId, partnerId = null) {
    let query = `
      SELECT d.*, c.Partner
      FROM dbo.Document d
      INNER JOIN dbo.Claim c ON d.Claim = c.Inc
      WHERE d.Inc = @documentId
    `;
    
    const params = { documentId };
    
    if (partnerId) {
      query += ' AND c.Partner = @partnerId AND c.Published = 1';
      params.partnerId = partnerId;
    }
    
    const result = await this.query(query, params);
    return result.recordset[0];
  }

  // Методы для работы с токенами сброса пароля
  async createPasswordResetToken(partnerId, token, expireAt) {
    await this.query(`
      INSERT INTO dbo.PasswordResetToken (Partner, Token, ExpireAt)
      VALUES (@partnerId, @token, @expireAt)
    `, { partnerId, token, expireAt });
  }

  async getPasswordResetToken(token) {
    const result = await this.query(`
      SELECT prt.*, p.Inc as PartnerId, p.Email
      FROM dbo.PasswordResetToken prt
      INNER JOIN dbo.Partner p ON prt.Partner = p.Inc
      WHERE prt.Token = @token AND prt.Used = 0 AND prt.ExpireAt > GETDATE()
    `, { token });
    return result.recordset[0];
  }

  async markTokenAsUsed(token) {
    await this.query(
      'UPDATE dbo.PasswordResetToken SET Used = 1, UsedAt = GETDATE() WHERE Token = @token',
      { token }
    );
  }

  async updatePartnerPassword(partnerId, passwordHash) {
    await this.query(
      'UPDATE dbo.Partpass SET PswHash = @passwordHash, Active = 1 WHERE Partner = @partnerId',
      { partnerId, passwordHash }
    );
  }

  // Методы для логирования
  async logAction(userId, userType, action, entityType = null, entityId = null, details = null, ipAddress = null, userAgent = null) {
    await this.query(`
      INSERT INTO dbo.AuditLog (UserId, UserType, Action, EntityType, EntityId, Details, IpAddress, UserAgent)
      VALUES (@userId, @userType, @action, @entityType, @entityId, @details, @ipAddress, @userAgent)
    `, { userId, userType, action, entityType, entityId, details, ipAddress, userAgent });
  }

  // Методы для работы с админами
  async getAdminByUsername(username) {
    const result = await this.query(
      'SELECT * FROM dbo.Admin WHERE Username = @username AND IsActive = 1',
      { username }
    );
    return result.recordset[0];
  }

  async createAdmin(username, passwordHash, email = null) {
    const result = await this.query(`
      INSERT INTO dbo.Admin (Username, PswHash, Email)
      OUTPUT INSERTED.Inc
      VALUES (@username, @passwordHash, @email)
    `, { username, passwordHash, email });
    return result.recordset[0].Inc;
  }

  async updateAdminLastLogin(adminId) {
    await this.query(
      'UPDATE dbo.Admin SET LastLogin = GETDATE() WHERE Inc = @adminId',
      { adminId }
    );
  }
}

// Экспортируем singleton
module.exports = new Database();
}