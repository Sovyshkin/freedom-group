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
        lastVisit: authInfo?.LastVisit
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
      createdAt: doc.PublishedAt,
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
    const totalDocsResult = await db.query(`
      SELECT COUNT(*) as total FROM dbo.Claim 
      WHERE Partner = @partnerId AND Published = 1
    `, { partnerId });
    
    // Сумма за последний год
    const yearlyAmountResult = await db.query(`
      SELECT ISNULL(SUM(Amount), 0) as total FROM dbo.Claim 
      WHERE Partner = @partnerId AND Published = 1 
      AND PublishedAt > DATEADD(YEAR, -1, GETDATE())
    `, { partnerId });
    
    // Сумма за текущий месяц
    const monthlyAmountResult = await db.query(`
      SELECT ISNULL(SUM(Amount), 0) as total FROM dbo.Claim 
      WHERE Partner = @partnerId AND Published = 1 
      AND YEAR(PublishedAt) = YEAR(GETDATE()) 
      AND MONTH(PublishedAt) = MONTH(GETDATE())
    `, { partnerId });
    
    // Последний документ
    const lastDocResult = await db.query(`
      SELECT TOP 1 PublishedAt, DateBeg, DateEnd, Amount 
      FROM dbo.Claim 
      WHERE Partner = @partnerId AND Published = 1
      ORDER BY PublishedAt DESC
    `, { partnerId });
    
    res.json({
      success: true,
      stats: {
        totalDocuments: totalDocsResult.recordset[0].total,
        yearlyAmount: yearlyAmountResult.recordset[0].total,
        monthlyAmount: monthlyAmountResult.recordset[0].total,
        lastDocument: lastDocResult.recordset[0] || null
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
    
    res.json({
      success: true,
      documents: formattedDocuments,
      total: formattedDocuments.length
    });
    
  } catch (error) {
    next(error);
  }
});

module.exports = router;