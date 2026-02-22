const db = require('../models/sqlite-database');

// Middleware для логирования действий администраторов
const auditLog = (action, entityType = null) => {
  return async (req, res, next) => {
    // Сохраняем оригинальные методы
    const originalJson = res.json;
    const originalSend = res.send;

    // Данные для лога
    const logData = {
      adminId: req.admin?.inc || req.user?.adminId || req.user?.id || req.user?.inc || null,
      adminUsername: req.admin?.username || req.user?.username || 'system',
      action: action,
      entityType: entityType,
      entityId: null,
      entityName: null,
      details: null,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent')
    };

    // Перехватываем ответ для извлечения информации о сущности
    res.json = function(data) {
      // Если успешный ответ, логируем
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Извлекаем данные сущности из ответа
        if (data) {
          if (data.id) logData.entityId = data.id;
          if (data.inc) logData.entityId = data.inc;
          if (data.Inc) logData.entityId = data.Inc;
          if (data.partnerId) logData.entityId = data.partnerId;
          
          if (data.name) logData.entityName = data.name;
          if (data.Name) logData.entityName = data.Name;
          if (data.username) logData.entityName = data.username;
          if (data.email) logData.entityName = data.email;
          if (data.fileName) logData.entityName = data.fileName;
          if (data.originalName) logData.entityName = data.originalName;
          
          // Сохраняем детали (без чувствительных данных)
          const details = { ...data };
          delete details.password;
          delete details.pswHash;
          delete details.token;
          logData.details = details;
        }

        // Сохраняем лог асинхронно
        db.createAuditLog(logData).catch(err => {
          console.error('❌ Ошибка сохранения audit log:', err);
        });
      }

      return originalJson.call(this, data);
    };

    res.send = function(data) {
      // Если успешный ответ и нет JSON (например, простой текст)
      if (res.statusCode >= 200 && res.statusCode < 300 && typeof data === 'string') {
        db.createAuditLog(logData).catch(err => {
          console.error('❌ Ошибка сохранения audit log:', err);
        });
      }

      return originalSend.call(this, data);
    };

    next();
  };
};

// Функция для ручного создания лога (для специальных случаев)
const createLog = async (req, action, entityType, entityId, entityName, details = null) => {
  try {
    await db.createAuditLog({
      adminId: req.admin?.inc || req.user?.adminId || req.user?.id || req.user?.inc || null,
      adminUsername: req.admin?.username || req.user?.username || 'system',
      action: action,
      entityType: entityType,
      entityId: entityId,
      entityName: entityName,
      details: details,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent')
    });
  } catch (err) {
    console.error('❌ Ошибка создания audit log:', err);
  }
};

module.exports = { auditLog, createLog };
