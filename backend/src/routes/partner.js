const express = require('express');
const db = require('../models/database');
const { verifyToken, verifyPartner, logAction } = require('../middleware/auth');

const router = express.Router();

// Применяем middleware авторизации ко всем партнерским роутам
router.use(verifyToken);
router.use(verifyPartner);

// @desc    Получить данные профиля партнера
// @route   GET /api/partner/profile
// @access  Partner
router.get('/profile', async (req, res, next) => {
  try {
    const partnerId = req.user.partnerId;
    
    const partner = await db.getPartnerByInc(partnerId);
    
    if (!partner) {
      return res.status(404).json({
        success: false,
        message: 'Партнер не найден'
      });
    }
    
    // Получаем дополнительную информацию из Partpass
    const authInfo = await db.getPartnerAuth(req.user.alias);
    
    res.json({
      success: true,
      profile: {
        id: partner.Inc,
        name: partner.Name,
        email: partner.Email,
        telegram: partner.Telegram,
        alias: req.user.alias,
        createdAt: partner.CreatedAt,
        lastVisit: authInfo?.lastVisit
      }
    });
    
  } catch (error) {
    next(error);
  }
});

// @desc    Получить список документов партнера
// @route   GET /api/partner/documents
// @access  Partner
router.get('/documents', [
  logAction('view_documents', 'document')
], async (req, res, next) => {
  try {
    const partnerId = req.user.partnerId;
    
    const documents = await db.getPartnerClaims(partnerId);
    
    // Форматируем данные для фронтенда
    const formattedDocuments = documents.map(doc => ({
      id: doc.ClaimId,
      // Use Created (from Partner sheet) if present, otherwise fall back to PublishedAt
      publishedAt: doc.PublishedAt,
      createdAt: doc.Created || doc.created || doc.PublishedAt,
      period: `${new Date(doc.DateBeg).toLocaleDateString('ru-RU')} - ${new Date(doc.DateEnd).toLocaleDateString('ru-RU')}`,
      dateBeg: doc.DateBeg,
      dateEnd: doc.DateEnd,
      amount: doc.Amount,
      payAmount: doc.PayAmount,
      taxAmount: doc.TaxAmount,
      fileName: doc.FileName,
      fileSize: doc.FileSize,
      documentId: doc.DocumentId
    }));
    
    res.json({
      success: true,
      documents: formattedDocuments
    });
    
  } catch (error) {
    next(error);
  }
});

// @desc    Получить документ с Excel данными
// @route   GET /api/partner/documents/:documentId
// @access  Partner
router.get('/documents/:documentId', [
  logAction('view_document', 'document')
], async (req, res, next) => {
  try {
    const { documentId } = req.params;
    const partnerId = req.user.partnerId;
    
    let claimData = null;
    let fileBuffer = null;
    
    if (typeof db.get === 'function') {
      // SQLite adapter
      const claim = await db.get(`
        SELECT c.inc, c.fileName, c.originalName, c.uploadedAt, c.partnerId, 
               c.fileSize, c.publishedAt, c.dateBeg, c.dateEnd, c.amount, 
               c.payAmount, c.taxAmount, c.type, c.fullName, c.currency,
               p.name as PartnerName, p.email as PartnerEmail
        FROM claim c
        LEFT JOIN partner p ON c.partnerId = p.partnerId
        WHERE c.inc = ? AND c.partnerId = ? AND c.publishedAt IS NOT NULL
      `, [documentId, partnerId]);

      if (!claim) {
        return res.status(404).json({ success: false, message: 'Документ не найден или у вас нет доступа' });
      }

      claimData = claim;
      
      // Get file info and content from document table
      const doc = await db.get(`
        SELECT filename, content, size, mimetype
        FROM document
        WHERE claimId = ?
        ORDER BY inc DESC
        LIMIT 1
      `, [documentId]);
      
      if (doc) {
        claim.fileName = claim.fileName || doc.filename;
        claim.fileSize = claim.fileSize || doc.size;
        claim.contentType = doc.mimetype || claim.contentType;
        fileBuffer = doc.content;
      }
    }

    if (!claimData) {
      return res.status(500).json({ success: false, message: 'Ошибка базы данных' });
    }

    // Parse Excel file to get sheets data
    let excelData = null;
    if (fileBuffer) {
      try {
        const xlsx = require('xlsx');
        const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
        console.log(`📊 Excel файл содержит ${workbook.SheetNames.length} листов:`, workbook.SheetNames);
        
        excelData = {
          sheets: []
        };

        workbook.SheetNames.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = xlsx.utils.sheet_to_json(worksheet, { 
            header: 1,
            defval: '',
            raw: false
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

// @desc    Скачать документ партнера
// @route   GET /api/partner/documents/:documentId/download
// @access  Partner
router.get('/documents/:documentId/download', [
  logAction('download_document', 'document')
], async (req, res, next) => {
  try {
    const { documentId } = req.params;
    const partnerId = req.user.partnerId;
    
    // Получаем документ с проверкой прав доступа
    const document = await db.getDocument(documentId, partnerId);
    
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Документ не найден или у вас нет прав доступа к нему'
      });
    }
    
    // Устанавливаем заголовки для скачивания файла
    res.set({
      'Content-Type': document.ContentType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(document.FileName)}"`,
      'Content-Length': document.FileSize
    });
    
    // Отправляем файл
    res.send(document.FileBinary);
    
  } catch (error) {
    next(error);
  }
});

// @desc    Получить статистику партнера
// @route   GET /api/partner/stats
// @access  Partner
router.get('/stats', async (req, res, next) => {
  try {
    const partnerId = req.user.partnerId;

    // Общее количество документов
    const totalDocsResult = await db.get(`
      SELECT COUNT(*) as total FROM claim
      WHERE partnerId = ? AND publishedAt IS NOT NULL
    `, [partnerId]);

    // Сумма за последний год
    const yearlyAmountResult = await db.get(`
      SELECT COALESCE(SUM(amount), 0) as total FROM claim
      WHERE partnerId = ? AND publishedAt IS NOT NULL
      AND publishedAt > datetime('now', '-1 year')
    `, [partnerId]);

    // Сумма за текущий месяц
    const monthlyAmountResult = await db.get(`
      SELECT COALESCE(SUM(amount), 0) as total FROM claim
      WHERE partnerId = ? AND publishedAt IS NOT NULL
      AND strftime('%Y-%m', publishedAt) = strftime('%Y-%m', 'now')
    `, [partnerId]);

    // Последний документ
    const lastDocResult = await db.get(`
      SELECT publishedAt, dateBeg, dateEnd, amount
      FROM claim
      WHERE partnerId = ? AND publishedAt IS NOT NULL
      ORDER BY publishedAt DESC
      LIMIT 1
    `, [partnerId]);

    // Преобразуем даты в lastDocument если он существует
    let lastDocument = null;
    if (lastDocResult) {
      lastDocument = {
        ...lastDocResult,
        dateBeg: new Date(lastDocResult.dateBeg).toISOString().split('T')[0],
        dateEnd: new Date(lastDocResult.dateEnd).toISOString().split('T')[0]
      };
    }

    res.json({
      success: true,
      stats: {
        totalDocuments: totalDocsResult.total,
        yearlyAmount: yearlyAmountResult.total,
        monthlyAmount: monthlyAmountResult.total,
        lastDocument: lastDocument
      }
    });
    
  } catch (error) {
    next(error);
  }
});

// @desc    Получить историю документов с пагинацией
// @route   GET /api/partner/documents/history
// @access  Partner
router.get('/documents/history', async (req, res, next) => {
  try {
    const partnerId = req.user.partnerId;
    const { page = 1, limit = 10, sortBy = 'publishedAt', sortOrder = 'DESC' } = req.query;
    
    const offset = (page - 1) * limit;
    
    // Валидация параметров сортировки
    const allowedSortFields = ['publishedAt', 'dateBeg', 'dateEnd', 'amount'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'publishedAt';
    const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    let sqlSortField;
    switch (sortField) {
      case 'publishedAt':
        sqlSortField = 'PublishedAt';
        break;
      case 'dateBeg':
        sqlSortField = 'DateBeg';
        break;
      case 'dateEnd':
        sqlSortField = 'DateEnd';
        break;
      case 'amount':
        sqlSortField = 'Amount';
        break;
      default:
        sqlSortField = 'PublishedAt';
    }
    
    const result = await db.query(`
      SELECT ClaimId, PublishedAt, DateBeg, DateEnd, Amount, PayAmount, TaxAmount, 
             FileName, FileSize, DocumentId
      FROM dbo.vw_PartnerDocuments 
      WHERE PartnerId = @partnerId
      ORDER BY ${sqlSortField} ${order}
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `, { partnerId, offset: parseInt(offset), limit: parseInt(limit) });
    
    // Получаем общее количество документов
    const countResult = await db.query(`
      SELECT COUNT(*) as total FROM dbo.Claim 
      WHERE Partner = @partnerId AND Published = 1
    `, { partnerId });
    
    const formattedDocuments = result.recordset.map(doc => ({
      id: doc.ClaimId,
      publishedAt: doc.PublishedAt,
      period: `${new Date(doc.DateBeg).toLocaleDateString('ru-RU')} - ${new Date(doc.DateEnd).toLocaleDateString('ru-RU')}`,
      dateBeg: doc.DateBeg,
      dateEnd: doc.DateEnd,
      amount: doc.Amount,
      payAmount: doc.PayAmount,
      taxAmount: doc.TaxAmount,
      fileName: doc.FileName,
      fileSize: doc.FileSize,
      documentId: doc.DocumentId
    }));
    
    res.json({
      success: true,
      documents: formattedDocuments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult.recordset[0].total,
        pages: Math.ceil(countResult.recordset[0].total / limit)
      }
    });
    
  } catch (error) {
    next(error);
  }
});

// @desc    Поиск документов партнера
// @route   GET /api/partner/documents/search
// @access  Partner
router.get('/documents/search', async (req, res, next) => {
  try {
    const partnerId = req.user.partnerId;
    const { 
      dateFrom, 
      dateTo, 
      amountFrom, 
      amountTo, 
      fileName 
    } = req.query;
    // Support both MSSQL and SQLite adapters
    if (typeof db.query === 'function') {
      let whereClause = 'WHERE PartnerId = @partnerId';
      const params = { partnerId };

      if (dateFrom) {
        whereClause += ' AND DateBeg >= @dateFrom';
        params.dateFrom = new Date(dateFrom);
      }

      if (dateTo) {
        whereClause += ' AND DateEnd <= @dateTo';
        params.dateTo = new Date(dateTo);
      }

      if (amountFrom) {
        whereClause += ' AND Amount >= @amountFrom';
        params.amountFrom = parseFloat(amountFrom);
      }

      if (amountTo) {
        whereClause += ' AND Amount <= @amountTo';
        params.amountTo = parseFloat(amountTo);
      }

      if (fileName) {
        whereClause += ' AND FileName LIKE @fileName';
        params.fileName = `%${fileName}%`;
      }

      const result = await db.query(`
        SELECT ClaimId, PublishedAt, DateBeg, DateEnd, Amount, PayAmount, TaxAmount, 
               FileName, FileSize, DocumentId
        FROM dbo.vw_PartnerDocuments 
        ${whereClause}
        ORDER BY PublishedAt DESC
      `, params);

      const formattedDocuments = result.recordset.map(doc => ({
        id: doc.ClaimId,
        publishedAt: doc.PublishedAt,
        period: `${new Date(doc.DateBeg).toLocaleDateString('ru-RU')} - ${new Date(doc.DateEnd).toLocaleDateString('ru-RU')}`,
        dateBeg: doc.DateBeg,
        dateEnd: doc.DateEnd,
        amount: doc.Amount,
        payAmount: doc.PayAmount,
        taxAmount: doc.TaxAmount,
        fileName: doc.FileName,
        fileSize: doc.FileSize,
        documentId: doc.DocumentId
      }));

      return res.json({ success: true, documents: formattedDocuments, total: formattedDocuments.length });
    }

    if (typeof db.all === 'function') {
      // Build SQLite query with positional params
      let sql = `
        SELECT c.inc as ClaimId, c.publishedAt as PublishedAt, c.created as Created, c.dateBeg as DateBeg, c.dateEnd as DateEnd,
               c.amount as Amount, c.payAmount as PayAmount, c.taxAmount as TaxAmount,
               d.filename as FileName, d.size as FileSize, d.inc as DocumentId
        FROM claim c
        LEFT JOIN document d ON c.inc = d.claimId
        WHERE c.partnerId = ? AND c.publishedAt IS NOT NULL
      `;
      const params = [partnerId];

      if (dateFrom) {
        sql += ' AND c.dateBeg >= ?';
        params.push(dateFrom);
      }

      if (dateTo) {
        sql += ' AND c.dateEnd <= ?';
        params.push(dateTo);
      }

      if (amountFrom) {
        sql += ' AND c.amount >= ?';
        params.push(parseFloat(amountFrom));
      }

      if (amountTo) {
        sql += ' AND c.amount <= ?';
        params.push(parseFloat(amountTo));
      }

      if (fileName) {
        sql += ' AND d.filename LIKE ?';
        params.push(`%${fileName}%`);
      }

      sql += ' ORDER BY c.publishedAt DESC';

      const rows = await db.all(sql, params);

      const formattedDocuments = rows.map(doc => ({
        id: doc.ClaimId,
        publishedAt: doc.PublishedAt,
        createdAt: doc.Created || doc.created || doc.PublishedAt,
        period: `${new Date(doc.DateBeg).toLocaleDateString('ru-RU')} - ${new Date(doc.DateEnd).toLocaleDateString('ru-RU')}`,
        dateBeg: doc.DateBeg,
        dateEnd: doc.DateEnd,
        amount: doc.Amount,
        payAmount: doc.PayAmount,
        taxAmount: doc.TaxAmount,
        fileName: doc.FileName,
        fileSize: doc.FileSize,
        documentId: doc.DocumentId
      }));

      return res.json({ success: true, documents: formattedDocuments, total: formattedDocuments.length });
    }

    return res.status(500).json({ success: false, message: 'Ошибка базы данных' });
    
  } catch (error) {
    next(error);
  }
});

module.exports = router;