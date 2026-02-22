const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const { body, validationResult } = require('express-validator');
const path = require('path');
const fs = require('fs').promises;
const bcrypt = require('bcryptjs');
const db = require('../models/database');
const { verifyToken, verifyAdmin, verifySuperAdmin, logAction } = require('../middleware/auth');
const emailService = require('../services/emailService');
const telegramService = require('../services/telegramService');

const router = express.Router();

// Применяем middleware авторизации ко всем админским роутам
router.use(verifyToken);
router.use(verifyAdmin);

// Настройка Multer для загрузки файлов
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel' // .xls
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Разрешены только Excel файлы (.xlsx, .xls)'));
    }
  }
});

// Обработка Excel файла и извлечение данных партнера
const processExcelFile = (fileBuffer, fileName) => {
  try {
    const workbook = xlsx.read(fileBuffer);
    
    // Проверяем наличие листа Partner (без учета регистра, поддержка русского)
    const partnerSheetName = workbook.SheetNames.find(name => 
      name.toLowerCase() === 'partner' || 
      name.toLowerCase() === 'партнер'
    );
    
    if (!partnerSheetName) {
      throw new Error('В файле отсутствует обязательный лист "Partner" или "Партнер"');
    }
    
    const partnerSheet = workbook.Sheets[partnerSheetName];
    const partnerData = xlsx.utils.sheet_to_json(partnerSheet, { header: ['name', 'value'] });
    
    if (partnerData.length === 0) {
      throw new Error('Лист "Partner" не содержит данных');
    }
    
    // Преобразуем массив key-value в объект
    const dataMap = {};
    partnerData.forEach(row => {
      if (row.name && row.value !== undefined) {
        const key = String(row.name).toLowerCase().trim();
        dataMap[key] = row.value;
      }
    });
    
    console.log('📋 Извлеченные данные из листа Partner:', Object.keys(dataMap));
    
    // Проверяем обязательные поля (убрали inc, так как partnerId приходит из запроса)
    const requiredFields = ['period from', 'period till', 'net', 'invoice', 'tax'];
    const missingFields = requiredFields.filter(field => !dataMap.hasOwnProperty(field) || dataMap[field] === null || dataMap[field] === undefined);
    
    if (missingFields.length > 0) {
      throw new Error(`Отсутствуют обязательные поля: ${missingFields.join(', ')}`);
    }
    
    // Получаем тип документа (doctype или type)
    const docType = dataMap['doctype'] || dataMap['doc type'] || dataMap['type'] || '';
    
    // Получаем валюту (currency или curreny - учитываем опечатку)
    const currency = dataMap['currency'] || dataMap['curreny'] || 'RUB';
    
    // Преобразуем даты
    const parseDate = (dateValue) => {
      if (typeof dateValue === 'number') {
        // Excel serial date (учитываем баг Excel с 1900 годом)
        // Excel считает 1900 високосным, хотя это не так
        const date = new Date((dateValue - 25569) * 86400 * 1000);
        return date;
      } else if (typeof dateValue === 'string') {
        return new Date(dateValue);
      }
      return new Date(dateValue);
    };
    
    // Удаляем лист Partner
    const partnerSheetIndex = workbook.SheetNames.indexOf(partnerSheetName);
    if (partnerSheetIndex > -1) {
      workbook.SheetNames.splice(partnerSheetIndex, 1);
      delete workbook.Sheets[partnerSheetName];
      console.log(`🗑️  Лист "${partnerSheetName}" удален из файла`);
    }
    
    // Создаем новый buffer без листа Partner
    const modifiedBuffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    return {
      Type: docType,
      FullName: dataMap['full name'] || dataMap['fullname'] || '',
      Created: dataMap['created'] ? parseDate(dataMap['created']) : new Date(),
      DateBeg: parseDate(dataMap['period from']),
      DateEnd: parseDate(dataMap['period till']),
      Amount: parseFloat(dataMap['net']),
      PayAmount: parseFloat(dataMap['invoice']),
      TaxAmount: parseFloat(dataMap['tax']),
      Currency: currency,
      fileName: fileName,
      modifiedBuffer: modifiedBuffer
    };
    
  } catch (error) {
    throw new Error(`Ошибка обработки Excel файла: ${error.message}`);
  }
};

// @desc    Загрузка Excel файлов
// @route   POST /api/admin/upload-files
// @access  Admin
router.post('/upload-files', [
  upload.array('files', 50), // Максимум 50 файлов
  logAction('upload_files', 'document')
], async (req, res, next) => {
  try {
    const files = req.files;
    
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Файлы не были загружены'
      });
    }
    
    // Получаем массив партнеров из formData
    const partnerIds = req.body.partnerIds ? JSON.parse(req.body.partnerIds) : [];
    
    if (partnerIds.length !== files.length) {
      return res.status(400).json({
        success: false,
        message: 'Количество партнеров не совпадает с количеством файлов'
      });
    }
    
    const results = [];
    const errors = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const partnerId = parseInt(partnerIds[i]);
      
      try {
        // Обрабатываем Excel файл
        const fileData = processExcelFile(file.buffer, file.originalname);
        
        // Проверяем существование партнера
        const partner = await db.getPartnerByInc(partnerId);
        if (!partner) {
          throw new Error(`Партнер с кодом ${partnerId} не найден`);
        }
        
        // Создаем claim
        const claimId = await db.createClaim({
          partnerId: partner.Inc,
          dateBeg: fileData.DateBeg,
          dateEnd: fileData.DateEnd,
          amount: fileData.Amount,
          payAmount: fileData.PayAmount,
          taxAmount: fileData.TaxAmount,
          type: fileData.Type,
          fullName: fileData.FullName,
          created: fileData.Created,
          currency: fileData.Currency
        });
        
        // Сохраняем файл в базу данных (без листа Partner)
        const documentId = await db.saveDocument(
          claimId,
          file.originalname,
          fileData.modifiedBuffer,
          fileData.modifiedBuffer.length,
          file.mimetype
        );
        
        results.push({
          fileName: file.originalname,
          partnerId: partner.Inc,
          partnerName: partner.Name,
          claimId: claimId,
          documentId: documentId,
          type: fileData.Type,
          fullName: fileData.FullName,
          period: `${fileData.DateBeg.toLocaleDateString()} - ${fileData.DateEnd.toLocaleDateString()}`,
          amount: fileData.Amount,
          currency: fileData.Currency,
          status: 'uploaded'
        });
        
      } catch (error) {
        errors.push({
          fileName: file.originalname,
          error: error.message
        });
      }
    }
    
    res.json({
      success: true,
      message: `Обработано файлов: ${results.length}, ошибок: ${errors.length}`,
      results: results,
      errors: errors
    });
    
  } catch (error) {
    next(error);
  }
});

// @desc    Автоматическая загрузка Excel файлов (партнёр определяется из файла)
// @route   POST /api/admin/auto-upload-files
// @access  Admin
router.post('/auto-upload-files', [
  upload.array('files', 50),
  logAction('auto_upload_files', 'document')
], async (req, res, next) => {
  try {
    const files = req.files;
    
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Файлы не были загружены'
      });
    }
    
    const results = [];
    const errors = [];
    
    for (const file of files) {
      try {
        // Читаем Excel файл
        const workbook = xlsx.read(file.buffer, { type: 'buffer' });
        
        // Ищем лист "partner"
        const partnerSheetName = workbook.SheetNames.find(name => 
          name.toLowerCase() === 'partner'
        );
        
        if (!partnerSheetName) {
          throw new Error('Лист "partner" не найден в файле');
        }
        
        const partnerSheet = workbook.Sheets[partnerSheetName];
        const partnerData = xlsx.utils.sheet_to_json(partnerSheet, { defval: null });
        
        if (partnerData.length === 0) {
          throw new Error('Лист "partner" пуст');
        }
        
        // Ищем строку с inc в структуре name-value
        // Excel может вернуть данные с ключами __EMPTY и __EMPTY_1
        let incValue = null;
        
        for (const row of partnerData) {
          const keys = Object.keys(row);
          if (keys.length < 2) continue;
          
          // Берем первые два ключа (независимо от названия)
          const nameKey = keys[0];  // __EMPTY или name
          const valueKey = keys[1]; // __EMPTY_1 или value
          
          if (row[nameKey] && row[nameKey].toString().toLowerCase().trim() === 'inc') {
            incValue = row[valueKey];
            break;
          }
        }
        
        if (!incValue) {
          throw new Error('Поле "inc" не найдено в листе "partner"');
        }
        
        const partnerId = parseInt(incValue);
        
        if (isNaN(partnerId)) {
          throw new Error(`Некорректное значение inc: ${incValue}`);
        }
        
        // Проверяем существование партнера
        const partner = await db.getPartnerByInc(partnerId);
        if (!partner) {
          throw new Error(`Партнёр с ID ${partnerId} не найден в системе`);
        }
        
        // Обрабатываем Excel файл (получаем данные claim)
        const fileData = processExcelFile(file.buffer, file.originalname);
        
        // Создаем claim
        const claimId = await db.createClaim({
          partnerId: partner.Inc,
          dateBeg: fileData.DateBeg,
          dateEnd: fileData.DateEnd,
          amount: fileData.Amount,
          payAmount: fileData.PayAmount,
          taxAmount: fileData.TaxAmount,
          type: fileData.Type,
          fullName: fileData.FullName,
          created: fileData.Created,
          currency: fileData.Currency
        });
        
        // Сохраняем файл в базу данных
        const documentId = await db.saveDocument(
          claimId,
          file.originalname,
          fileData.modifiedBuffer,
          fileData.modifiedBuffer.length,
          file.mimetype
        );
        
        results.push({
          fileName: file.originalname,
          partnerId: partner.Inc,
          partnerName: partner.Name,
          claimId: claimId,
          documentId: documentId,
          type: fileData.Type,
          fullName: fileData.FullName,
          period: `${fileData.DateBeg.toLocaleDateString()} - ${fileData.DateEnd.toLocaleDateString()}`,
          amount: fileData.Amount,
          currency: fileData.Currency,
          status: 'uploaded',
          message: `Успешно загружено для партнёра ${partner.Name}`
        });
        
      } catch (error) {
        errors.push({
          fileName: file.originalname,
          error: error.message,
          message: error.message
        });
      }
    }
    
    res.json({
      success: true,
      message: `Обработано файлов: ${results.length}, ошибок: ${errors.length}`,
      results: results,
      errors: errors
    });
    
  } catch (error) {
    next(error);
  }
});

// @desc    Получить список неопубликованных документов
// @route   GET /api/admin/unpublished-claims
// @access  Admin
router.get('/unpublished-claims', async (req, res, next) => {
  try {
    const claims = await db.getUnpublishedClaims();
    
    res.json({
      success: true,
      data: claims
    });
    
  } catch (error) {
    next(error);
  }
});

// @desc    Получить список опубликованных документов
// @route   GET /api/admin/published-claims
// @access  Admin
router.get('/published-claims', async (req, res, next) => {
  try {
    // Поддерживаем и MSSQL и SQLite адаптеры
    if (typeof db.query === 'function') {
      const result = await db.query(`
        SELECT c.*, p.Name as PartnerName, p.Email as PartnerEmail, d.FileName, d.FileSize
        FROM dbo.Claim c
        INNER JOIN dbo.Partner p ON c.Partner = p.Inc
        LEFT JOIN dbo.Document d ON c.Inc = d.Claim
        WHERE c.Published = 1
        ORDER BY c.PublishedAt DESC
      `);

      return res.json({ success: true, data: result.recordset });
    }

    if (typeof db.all === 'function') {
      const rows = await db.all(`
        SELECT c.inc,
               COALESCE(c.fileName, d.filename) as fileName,
               c.originalName, c.uploadedAt, c.partnerId, c.fileSize,
               c.dateBeg, c.dateEnd, p.name as PartnerName, c.publishedAt, c.created as Created
        FROM claim c
        LEFT JOIN partner p ON c.partnerId = p.partnerId
        LEFT JOIN document d ON d.claimId = c.inc
        WHERE c.publishedAt IS NOT NULL
        GROUP BY c.inc
        ORDER BY c.publishedAt DESC
      `);

      return res.json({ success: true, data: rows });
    }

    return res.status(500).json({ success: false, message: 'Ошибка базы данных' });

  } catch (error) {
    next(error);
  }
});

// @desc    Удалить неопубликованный документ
// @route   DELETE /api/admin/claims/:id
// @access  Admin
router.delete('/claims/:id', [
  logAction('delete_claim', 'claim')
], async (req, res, next) => {
  try {
    const { id } = req.params;
    const force = req.query && (req.query.force === 'true' || req.query.force === '1');
    
    // Проверяем что claim не опубликован
    if (typeof db.query === 'function') {
      // MS SQL adapter
      const result = await db.query(`
        SELECT Published FROM dbo.Claim WHERE Inc = @id
      `, { id });

      if (!result || !result.recordset || result.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Документ не найден'
        });
      }

      if (result.recordset[0].Published && !force) {
        return res.status(400).json({
          success: false,
          message: 'Нельзя удалить опубликованный документ'
        });
      }

      // Удаляем claim (документы удалятся автоматически по CASCADE)
      await db.query(`
        DELETE FROM dbo.Claim WHERE Inc = @id
      `, { id });
    } else if (typeof db.get === 'function') {
      // SQLite adapter
      const claim = await db.get('SELECT inc, publishedAt FROM claim WHERE inc = ?', [id]);

      if (!claim) {
        return res.status(404).json({
          success: false,
          message: 'Документ не найден'
        });
      }

      if (claim.publishedAt && !force) {
        return res.status(400).json({
          success: false,
          message: 'Нельзя удалить опубликованный документ'
        });
      }

      // Удаляем claim (документы удалятся автоматически по CASCADE)
      await db.run('DELETE FROM claim WHERE inc = ?', [id]);
    } else {
      // Неизвестный адаптер
      return res.status(500).json({ success: false, message: 'Ошибка базы данных' });
    }
    
    res.json({
      success: true,
      message: 'Документ успешно удален'
    });
    
  } catch (error) {
    next(error);
  }
});

// @desc    Получить детали документа
// @route   GET /api/admin/claims/:id
// @access  Admin
router.get('/claims/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    let claimData = null;
    let fileBuffer = null;
    
    if (typeof db.query === 'function') {
      // MS SQL adapter
      const result = await db.query(`
        SELECT c.*, p.Name as PartnerName, p.Email as PartnerEmail, 
               d.FileName, d.FileSize, d.ContentType, d.FileBinary
        FROM dbo.Claim c
        INNER JOIN dbo.Partner p ON c.Partner = p.Inc
        LEFT JOIN dbo.Document d ON c.Inc = d.Claim
        WHERE c.Inc = @id
      `, { id });

      if (!result || !result.recordset || result.recordset.length === 0) {
        return res.status(404).json({ success: false, message: 'Документ не найден' });
      }

      claimData = result.recordset[0];
      fileBuffer = claimData.FileBinary;
    }

    if (typeof db.get === 'function') {
      // SQLite adapter
      const claim = await db.get(`
        SELECT c.inc, c.fileName, c.originalName, c.uploadedAt, c.partnerId, 
               c.fileSize, c.publishedAt, c.dateBeg, c.dateEnd, c.amount, 
               c.payAmount, c.taxAmount, c.type, c.fullName, c.currency,
               p.name as PartnerName, p.email as PartnerEmail
        FROM claim c
        LEFT JOIN partner p ON c.partnerId = p.partnerId
        WHERE c.inc = ?
      `, [id]);

      if (!claim) {
        return res.status(404).json({ success: false, message: 'Документ не найден' });
      }

      claimData = claim;
      
      // Get file info and content from document table (SQLite)
      const doc = await db.get(`
        SELECT filename, content, size, mimetype
        FROM document
        WHERE claimId = ?
        ORDER BY inc DESC
        LIMIT 1
      `, [id]);
      
      if (doc) {
        // Normalize fields to match MSSQL shape
        claim.fileName = claim.fileName || doc.filename;
        claim.fileSize = claim.fileSize || doc.size;
        claim.contentType = doc.mimetype || claim.contentType;
        fileBuffer = doc.content;
      } else {
        fileBuffer = null;
      }
    }

    if (!claimData) {
      return res.status(500).json({ success: false, message: 'Ошибка базы данных' });
    }

    // Parse Excel file to get sheets data
    let excelData = null;
    if (fileBuffer) {
      try {
        const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
        console.log(`📊 Excel файл содержит ${workbook.SheetNames.length} листов:`, workbook.SheetNames);
        
        excelData = {
          sheets: []
        };

        workbook.SheetNames.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          // Convert to JSON with header row
          const jsonData = xlsx.utils.sheet_to_json(worksheet, { 
            header: 1, // Return as array of arrays
            defval: '', // Default value for empty cells
            raw: false // Format values as strings
          });

          console.log(`  📄 Лист "${sheetName}": ${jsonData.length} строк`);
          
          excelData.sheets.push({
            name: sheetName,
            data: jsonData
          });
        });
        
        console.log(`✅ Успешно обработано ${excelData.sheets.length} листов`);
      } catch (parseError) {
        console.error('❌ Error parsing Excel file:', parseError);
        // Continue without Excel data if parsing fails
      }
    }

    return res.json({ 
      success: true, 
      data: claimData,
      excelData: excelData 
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Скачать документ
// @route   GET /api/admin/claims/:id/download
// @access  Admin
router.get('/claims/:id/download', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (typeof db.query === 'function') {
      // MS SQL adapter
      const result = await db.query(`
        SELECT d.FileName, d.FileBinary, d.ContentType
        FROM dbo.Document d
        INNER JOIN dbo.Claim c ON d.Claim = c.Inc
        WHERE c.Inc = @id
      `, { id });

      if (!result || !result.recordset || result.recordset.length === 0) {
        return res.status(404).json({ success: false, message: 'Файл не найден' });
      }

      const doc = result.recordset[0];
      res.setHeader('Content-Type', doc.ContentType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.FileName)}"`);
      return res.send(doc.FileBinary);
    }

    if (typeof db.get === 'function') {
      // SQLite adapter
      const doc = await db.get(`
        SELECT d.filename, d.content, d.mimetype
        FROM document d
        INNER JOIN claim c ON d.claimId = c.inc
        WHERE c.inc = ?
      `, [id]);

      if (!doc) {
        return res.status(404).json({ success: false, message: 'Файл не найден' });
      }

      res.setHeader('Content-Type', doc.mimetype || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.filename)}"`);
      return res.send(doc.content);
    }

    return res.status(500).json({ success: false, message: 'Ошибка базы данных' });
  } catch (error) {
    next(error);
  }
});

// @desc    Опубликовать документы
// @route   POST /api/admin/publish-claims
// @access  Admin
router.post('/publish-claims', [
  body('claimIds').isArray().withMessage('claimIds должен быть массивом'),
  logAction('publish_claims', 'claim')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Ошибки валидации',
        errors: errors.array()
      });
    }
    
    const { claimIds } = req.body;
    
    if (claimIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Не указаны документы для публикации'
      });
    }
    
    // Публикуем документы и собираем информацию для отправки писем
    let publishedCount = 0;
    const publishedByPartner = {}; // partnerId -> array of documents
    
    for (const claimId of claimIds) {
      // Get claim details before publishing
      const claim = await db.get(`
        SELECT c.inc, c.partnerId, c.created, c.dateBeg, c.dateEnd,
               p.name as partnerName, p.email as partnerEmail, p.telegram as partnerTelegram, p.active as partnerActive,
               d.filename as fileName
        FROM claim c
        LEFT JOIN partner p ON c.partnerId = p.partnerId
        LEFT JOIN document d ON c.inc = d.claimId
        WHERE c.inc = ? AND c.publishedAt IS NULL
      `, [claimId]);
      
      if (!claim) continue;
      
      // Publish the claim
      const result = await db.run('UPDATE claim SET publishedAt = CURRENT_TIMESTAMP WHERE inc = ? AND publishedAt IS NULL', [claimId]);
      
      if (result.changes > 0) {
        publishedCount++;
        
        // Group by partner for notifications (only if partner is active)
        const partnerId = claim.partnerId;
        if (!publishedByPartner[partnerId]) {
          publishedByPartner[partnerId] = {
            partnerName: claim.partnerName,
            partnerEmail: claim.partnerEmail,
            partnerTelegram: claim.partnerTelegram,
            partnerActive: claim.partnerActive,
            documents: []
          };
        }
        
        // Format period
        const formatDate = (date) => {
          if (!date) return '—';
          try {
            return new Date(date).toLocaleDateString('ru-RU');
          } catch (e) {
            return '—';
          }
        };
        
        const period = claim.dateBeg && claim.dateEnd 
          ? `${formatDate(claim.dateBeg)} — ${formatDate(claim.dateEnd)}`
          : '—';
        
        publishedByPartner[partnerId].documents.push({
          fileName: claim.fileName || 'Документ',
          period: period,
          date: formatDate(claim.created || new Date())
        });
      }
    }
    
    // Send notifications to partners (email and telegram)
    for (const partnerId in publishedByPartner) {
      const { partnerName, partnerEmail, partnerTelegram, partnerActive, documents } = publishedByPartner[partnerId];
      
      // Skip notifications for inactive partners
      if (!partnerActive) {
        console.log(`⏭️ Пропуск уведомлений для неактивного партнёра ${partnerName}`);
        continue;
      }
      
      // Send email notification
      if (partnerEmail && documents.length > 0) {
        try {
          await emailService.sendDocumentsPublishedNotification(
            partnerEmail,
            partnerName,
            documents
          );
          console.log(`📧 Письмо отправлено партнёру ${partnerName} (${partnerEmail})`);
        } catch (emailError) {
          console.error(`❌ Ошибка отправки письма партнёру ${partnerName}:`, emailError.message);
          // Continue even if email fails
        }
      }
      
      // Send Telegram notification
      if (partnerTelegram && documents.length > 0) {
        try {
          await telegramService.sendDocumentsPublishedNotification(
            partnerTelegram,
            partnerName,
            documents
          );
          console.log(`📱 Telegram уведомление отправлено партнёру ${partnerName} (${partnerTelegram})`);
        } catch (telegramError) {
          console.error(`❌ Ошибка отправки Telegram уведомления партнёру ${partnerName}:`, telegramError.message);
          // Continue even if telegram fails
        }
      }
    }
    
    res.json({
      success: true,
      message: `Опубликовано ${publishedCount} документов`,
      publishedCount: publishedCount
    });

  } catch (error) {
    next(error);
  }
});

// @desc    Снять публикацию документов
// @route   POST /api/admin/unpublish-claims
// @access  Admin
router.post('/unpublish-claims', [
  body('claimIds').isArray().withMessage('claimIds должен быть массивом'),
  logAction('unpublish_claims', 'claim')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Ошибки валидации',
        errors: errors.array()
      });
    }
    
    const { claimIds } = req.body;
    
    if (claimIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Не указаны документы для снятия публикации'
      });
    }
    
    // Снимаем публикацию
    let unpublishedCount = 0;
    for (const claimId of claimIds) {
      const result = await db.run('UPDATE claim SET publishedAt = NULL WHERE inc = ? AND publishedAt IS NOT NULL', [claimId]);
      if (result.changes > 0) {
        unpublishedCount++;
      }
    }
    
    res.json({
      success: true,
      message: `Снята публикация ${unpublishedCount} документов`,
      unpublishedCount: unpublishedCount
    });

  } catch (error) {
    next(error);
  }
});

// @desc    Создать нового партнера
// @route   POST /api/admin/partners
// @access  Admin
router.post('/partners', [
  body('name').notEmpty().withMessage('Имя партнера обязательно'),
  body('email').isEmail().withMessage('Введите корректный email'),
  body('telegram').optional().isString(),
  body('alias').notEmpty().withMessage('Логин обязателен'),
  body('password').notEmpty().withMessage('Пароль обязателен'),
  body('birthDate').optional().isISO8601().withMessage('Некорректная дата рождения'),
  body('active').optional().isBoolean(),
  logAction('create_partner', 'partner')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Ошибки валидации',
        errors: errors.array()
      });
    }
    
    const { name, email, telegram, alias, password, birthDate, active } = req.body;
    
    // Создаем партнера
    const partnerData = await db.createPartner({
      name,
      email,
      telegram,
      alias,
      password,
      birthDate,
      active: active !== undefined ? active : 1
    });
    
    // Создаем токен для установки пароля
    const { v4: uuidv4 } = require('uuid');
    const resetToken = uuidv4();
    const expireAt = new Date(Date.now() + 60 * 60 * 1000); // 1 час
    
    await db.createPasswordResetToken(partnerData.partnerId, resetToken, expireAt);
    
    // Отправляем приглашение партнеру
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:8080'}/reset-password?token=${resetToken}`;
    
    try {
      await emailService.sendPartnerInvitation(email, name, partnerData.alias, resetLink);
      
      if (telegram) {
        await telegramService.sendPartnerInvitation(telegram, name, partnerData.alias);
      }
    } catch (notificationError) {
      console.error('Ошибка отправки приглашения:', notificationError.message);
    }
    
    res.json({
      success: true,
      message: 'Партнер успешно создан',
      partner: {
        id: partnerData.partnerId,
        name: name,
        email: email,
        telegram: telegram,
        alias: partnerData.alias
      }
    });
    
  } catch (error) {
    next(error);
  }
});

// @desc    Получить список всех партнеров
// @route   GET /api/admin/partners
// @access  Admin
router.get('/partners', async (req, res, next) => {
  try {
    const partners = await db.getAllPartners();
    
    res.json({
      success: true,
      data: partners
    });
    
  } catch (error) {
    next(error);
  }
});

// @desc    Обновить партнера
// @route   PUT /api/admin/partners/:id
// @access  Admin
router.put('/partners/:id', [
  body('name').notEmpty().withMessage('Имя обязательно'),
  body('email').isEmail().withMessage('Некорректный email'),
  body('alias').notEmpty().withMessage('Логин обязателен'),
  body('birthDate').optional().isISO8601().withMessage('Некорректная дата рождения'),
  body('active').optional().isBoolean()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Ошибки валидации',
        errors: errors.array()
      });
    }
    
    const { id } = req.params;
    const { name, email, telegram, alias, password, birthDate, active } = req.body;
    
    const updatedPartner = await db.updatePartner(id, { name, email, telegram, alias, password, birthDate, active });
    
    res.json({
      success: true,
      message: 'Партнер обновлен',
      partner: updatedPartner
    });
    
  } catch (error) {
    next(error);
  }
});

// @desc    Удалить партнера
// @route   DELETE /api/admin/partners/:id
// @access  Admin
router.delete('/partners/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    await db.deletePartner(id);
    
    res.json({
      success: true,
      message: 'Партнер удален'
    });
    
  } catch (error) {
    next(error);
  }
});

// @desc    Получить документы партнера
// @route   GET /api/admin/partners/:id/documents
// @access  Admin
router.get('/partners/:id/documents', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const documents = await db.getPartnerDocuments(id);
    
    res.json({
      success: true,
      documents: documents
    });
    
  } catch (error) {
    next(error);
  }
});

// @desc    Получить статистику администратора
// @route   GET /api/admin/stats
// @access  Admin
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await db.getAdminStats();
    
    res.json({
      success: true,
      stats: stats
    });
    
  } catch (error) {
    next(error);
  }
});

// @desc    Получить список всех партнеров
// @desc    Получить логи действий  
// @route   GET /api/admin/audit-log
// @access  Admin
router.get('/audit-log', async (req, res, next) => {
  try {
    // Заглушка для логов (в реальной системе здесь будет запрос к базе)
    res.json({
      success: true,
      data: [],
      pagination: {
        page: 1,
        limit: 50,
        total: 0,
        pages: 0
      }
    });
    
  } catch (error) {
    next(error);
  }
});

// ============= УПРАВЛЕНИЕ АДМИНИСТРАТОРАМИ (только для суперадмина) =============

// @desc    Получить список всех администраторов
// @route   GET /api/admin/admins
// @access  SuperAdmin
router.get('/admins', verifySuperAdmin, async (req, res, next) => {
  try {
    const admins = await db.getAllAdmins();
    
    res.json({
      success: true,
      admins: admins
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Создать нового администратора
// @route   POST /api/admin/admins
// @access  SuperAdmin
router.post('/admins', [
  verifySuperAdmin,
  body('username').trim().notEmpty().withMessage('Логин обязателен'),
  body('password').isLength({ min: 6 }).withMessage('Пароль должен быть минимум 6 символов'),
  body('email').isEmail().withMessage('Неверный формат email'),
  logAction('create_admin', 'admin')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Ошибки валидации',
        errors: errors.array()
      });
    }

    const { username, password, email } = req.body;

    // Проверяем, не существует ли уже админ с таким логином
    const existingAdmin = await db.getAdminByUsername(username);
    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Администратор с таким логином уже существует'
      });
    }

    // Хешируем пароль
    const passwordHash = await bcrypt.hash(password, 12);

    // Создаем админа
    const adminId = await db.createAdmin(username, passwordHash, email, 'admin');

    res.json({
      success: true,
      message: 'Администратор успешно создан',
      adminId: adminId
    });

  } catch (error) {
    next(error);
  }
});

// @desc    Обновить данные администратора
// @route   PUT /api/admin/admins/:id
// @access  SuperAdmin
router.put('/admins/:id', [
  verifySuperAdmin,
  body('username').trim().notEmpty().withMessage('Логин обязателен'),
  body('email').isEmail().withMessage('Неверный формат email'),
  body('password').optional().isLength({ min: 6 }).withMessage('Пароль должен быть минимум 6 символов'),
  logAction('update_admin', 'admin')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Ошибки валидации',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { username, email, password } = req.body;

    // Проверяем, не существует ли уже админ с таким логином (кроме текущего)
    const existingAdmin = await db.getAdminByUsername(username);
    if (existingAdmin && existingAdmin.inc !== parseInt(id)) {
      return res.status(400).json({
        success: false,
        message: 'Администратор с таким логином уже существует'
      });
    }

    // Обновляем данные админа
    await db.updateAdmin(id, username, email);

    // Если передан пароль, обновляем его
    if (password && password.trim()) {
      const passwordHash = await bcrypt.hash(password, 12);
      await db.updateAdminPassword(id, passwordHash);
    }

    res.json({
      success: true,
      message: 'Данные администратора успешно обновлены'
    });

  } catch (error) {
    next(error);
  }
});

// @desc    Изменить пароль администратора
// @route   PUT /api/admin/admins/:id/password
// @access  SuperAdmin
router.put('/admins/:id/password', [
  verifySuperAdmin,
  body('password').isLength({ min: 6 }).withMessage('Пароль должен быть минимум 6 символов'),
  logAction('update_admin_password', 'admin')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Ошибки валидации',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { password } = req.body;

    // Хешируем новый пароль
    const passwordHash = await bcrypt.hash(password, 12);

    // Обновляем пароль
    await db.updateAdminPassword(id, passwordHash);

    res.json({
      success: true,
      message: 'Пароль администратора успешно изменен'
    });

  } catch (error) {
    next(error);
  }
});

// @desc    Удалить администратора
// @route   DELETE /api/admin/admins/:id
// @access  SuperAdmin
router.delete('/admins/:id', [
  verifySuperAdmin,
  logAction('delete_admin', 'admin')
], async (req, res, next) => {
  try {
    const { id } = req.params;

    // Нельзя удалить самого себя
    if (parseInt(id) === req.admin.inc) {
      return res.status(400).json({
        success: false,
        message: 'Нельзя удалить свой собственный аккаунт'
      });
    }

    // Удаляем администратора (суперадмин не может быть удален на уровне БД)
    const result = await db.deleteAdmin(id);

    if (result.changes === 0) {
      return res.status(400).json({
        success: false,
        message: 'Невозможно удалить суперадминистратора'
      });
    }

    res.json({
      success: true,
      message: 'Администратор успешно удален'
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;