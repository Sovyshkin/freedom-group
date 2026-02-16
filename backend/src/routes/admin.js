const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const { body, validationResult } = require('express-validator');
const path = require('path');
const fs = require('fs').promises;
const db = require('../models/database');
const { verifyToken, verifyAdmin, logAction } = require('../middleware/auth');
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
    
    // Проверяем наличие листа Partner
    if (!workbook.SheetNames.includes('Partner')) {
      throw new Error('В файле отсутствует обязательный лист "Partner"');
    }
    
    const partnerSheet = workbook.Sheets['Partner'];
    const partnerData = xlsx.utils.sheet_to_json(partnerSheet);
    
    if (partnerData.length === 0) {
      throw new Error('Лист "Partner" не содержит данных');
    }
    
    const data = partnerData[0]; // Берем первую строку
    
    // Проверяем обязательные поля
    const requiredFields = ['Inc', 'DateBeg', 'DateEnd', 'Amount', 'PayAmount', 'TaxAmount'];
    const missingFields = requiredFields.filter(field => !data.hasOwnProperty(field) || data[field] === null || data[field] === undefined);
    
    if (missingFields.length > 0) {
      throw new Error(`Отсутствуют обязательные поля: ${missingFields.join(', ')}`);
    }
    
    // Преобразуем даты
    const parseDate = (dateValue) => {
      if (typeof dateValue === 'number') {
        // Excel serial date
        const excelEpoch = new Date(1900, 0, 1);
        const date = new Date(excelEpoch.getTime() + (dateValue - 1) * 24 * 60 * 60 * 1000);
        return date;
      } else if (typeof dateValue === 'string') {
        return new Date(dateValue);
      }
      return new Date(dateValue);
    };
    
    return {
      Inc: parseInt(data.Inc),
      DateBeg: parseDate(data.DateBeg),
      DateEnd: parseDate(data.DateEnd),
      Amount: parseFloat(data.Amount),
      PayAmount: parseFloat(data.PayAmount),
      TaxAmount: parseFloat(data.TaxAmount),
      fileName: fileName
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
    
    const results = [];
    const errors = [];
    
    for (const file of files) {
      try {
        // Обрабатываем Excel файл
        const fileData = processExcelFile(file.buffer, file.originalname);
        
        // Проверяем существование партнера
        const partner = await db.getPartnerByInc(fileData.Inc);
        if (!partner) {
          throw new Error(`Партнер с кодом ${fileData.Inc} не найден`);
        }
        
        // Создаем claim
        const claimId = await db.createClaim({
          partnerId: partner.Inc,
          dateBeg: fileData.DateBeg,
          dateEnd: fileData.DateEnd,
          amount: fileData.Amount,
          payAmount: fileData.PayAmount,
          taxAmount: fileData.TaxAmount
        });
        
        // Сохраняем файл в базу данных
        const documentId = await db.saveDocument(
          claimId,
          file.originalname,
          file.buffer,
          file.size,
          file.mimetype
        );
        
        results.push({
          fileName: file.originalname,
          partnerId: partner.Inc,
          partnerName: partner.Name,
          claimId: claimId,
          documentId: documentId,
          period: `${fileData.DateBeg.toLocaleDateString()} - ${fileData.DateEnd.toLocaleDateString()}`,
          amount: fileData.Amount,
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

// @desc    Удалить неопубликованный документ
// @route   DELETE /api/admin/claims/:id
// @access  Admin
router.delete('/claims/:id', [
  logAction('delete_claim', 'claim')
], async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Проверяем что claim не опубликован
    const result = await db.query(`
      SELECT Published FROM dbo.Claim WHERE Inc = @id
    `, { id });
    
    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Документ не найден'
      });
    }
    
    if (result.recordset[0].Published) {
      return res.status(400).json({
        success: false,
        message: 'Нельзя удалить опубликованный документ'
      });
    }
    
    // Удаляем claim (документы удалятся автоматически по CASCADE)
    await db.query(`
      DELETE FROM dbo.Claim WHERE Inc = @id
    `, { id });
    
    res.json({
      success: true,
      message: 'Документ успешно удален'
    });
    
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
    
    // Публикуем документы простым запросом
    let publishedCount = 0;
    for (const claimId of claimIds) {
      const result = await db.run('UPDATE claim SET publishedAt = CURRENT_TIMESTAMP WHERE inc = ? AND publishedAt IS NULL', [claimId]);
      if (result.changes > 0) {
        publishedCount++;
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

// @desc    Создать нового партнера
// @route   POST /api/admin/partners
// @access  Admin
router.post('/partners', [
  body('name').notEmpty().withMessage('Имя партнера обязательно'),
  body('email').isEmail().withMessage('Введите корректный email'),
  body('telegram').optional().isString(),
  body('alias').notEmpty().withMessage('Логин обязателен'),
  body('password').notEmpty().withMessage('Пароль обязателен'),
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
    
    const { name, email, telegram, alias, password } = req.body;
    
    // Создаем партнера
    const partnerData = await db.createPartner({
      name,
      email,
      telegram,
      alias,
      password
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
  body('alias').notEmpty().withMessage('Логин обязателен')
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
    const { name, email, telegram, alias, password } = req.body;
    
    const updatedPartner = await db.updatePartner(id, { name, email, telegram, alias, password });
    
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

module.exports = router;