const express = require('express');
const db = require('../models/database');
const { verifyToken, verifySuperAdmin } = require('../middleware/auth');

const router = express.Router();

// Требуем сначала проверку токена, затем права суперадмина
router.use(verifyToken);
router.use(verifySuperAdmin);

// Получить журнал событий
router.get('/', async (req, res, next) => {
  try {
    const {
      adminId,
      entityType,
      action,
      dateFrom,
      dateTo,
      search,
      limit = 100,
      offset = 0
    } = req.query;

    const filters = {
      adminId: adminId ? parseInt(adminId) : null,
      action,
      dateFrom,
      dateTo,
      search,
      limit: parseInt(limit),
      offset: parseInt(offset)
    };

    // Получаем логи и общее количество
    const [logs, totalCount] = await Promise.all([
      db.getAuditLogs(filters),
      db.getAuditLogsCount(filters)
    ]);

    // Парсим details обратно из JSON (если они были сериализованы)
    const logsWithParsedDetails = logs.map(log => {
      let parsed = null;
      try {
        parsed = log.details ? JSON.parse(log.details) : null;
      } catch (e) {
        parsed = log.details;
      }

      // Приводим поля к форме, ожидаемой frontend'ом
      return {
        id: log.inc,
        timestamp: log.createdAt,
        admin_username: log.admin_username || (parsed && parsed.adminUsername) || '—',
        action: log.action,
        entity_type: (parsed && parsed.entityType) || null,
        entity_name: (parsed && parsed.entityName) || null,
        ip_address: log.ipAddress || (parsed && parsed.ipAddress) || null,
        user_agent: log.userAgent || (parsed && parsed.userAgent) || null,
        details: parsed
      };
    });

    res.json({
      success: true,
      logs: logsWithParsedDetails,
      total: totalCount,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    next(error);
  }
});

// Получить статистику по действиям
router.get('/stats', async (req, res, next) => {
  try {
    const { dateFrom, dateTo } = req.query;

    // Получаем статистику по действиям за период (по таблице auditLog)
    let query = `
      SELECT 
        action,
        COUNT(*) as count,
        COUNT(DISTINCT userId) as unique_admins
      FROM auditLog
      WHERE 1=1
    `;
    const params = [];

    if (dateFrom) {
      query += ' AND createdAt >= ?';
      params.push(dateFrom);
    }

    if (dateTo) {
      query += ' AND createdAt <= ?';
      params.push(dateTo);
    }

    query += ' GROUP BY action ORDER BY count DESC';

    const stats = await db.all(query, params);

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;
