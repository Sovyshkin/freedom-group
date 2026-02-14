const jwt = require('jsonwebtoken');
const db = require('../models/database');

// Middleware для проверки JWT токена
const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Токен не предоставлен' 
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ 
      success: false, 
      message: 'Неверный токен' 
    });
  }
};

// Middleware для проверки роли партнера
const verifyPartner = async (req, res, next) => {
  if (req.user.role !== 'partner') {
    return res.status(403).json({ 
      success: false, 
      message: 'Доступ запрещен: требуются права партнера' 
    });
  }

  try {
    // Проверяем, что партнер активен
    const partner = await db.getPartnerByInc(req.user.partnerId);
    if (!partner || !partner.IsActive) {
      return res.status(403).json({ 
        success: false, 
        message: 'Партнер неактивен' 
      });
    }

    req.partner = partner;
    next();
  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      message: 'Ошибка проверки партнера' 
    });
  }
};

// Middleware для проверки роли администратора
const verifyAdmin = async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Доступ запрещен: требуются права администратора' 
    });
  }

  try {
    // Получаем данные администратора (без проверки активности, т.к. поля нет в базе)
    const admin = await db.getAdminByUsername(req.user.username);
    if (!admin) {
      return res.status(403).json({ 
        success: false, 
        message: 'Администратор не найден' 
      });
    }

    req.admin = admin;
    next();
  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      message: 'Ошибка проверки администратора' 
    });
  }
};

// Middleware для логирования действий
const logAction = (action, entityType = null) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.partnerId || req.user?.adminId;
      const userType = req.user?.role;
      const entityId = req.params?.id || req.body?.id || null;
      const ipAddress = req.ip || req.connection?.remoteAddress;
      const userAgent = req.get('User-Agent');
      
      const details = JSON.stringify({
        method: req.method,
        url: req.originalUrl,
        body: req.method === 'POST' || req.method === 'PUT' ? req.body : undefined
      });

      await db.logAction(
        action,
        details,
        userId,
        userType,
        ipAddress,
        userAgent
      );
    } catch (error) {
      console.error('Ошибка логирования:', error.message);
    }
    next();
  };
};

// Middleware для защиты от brute force атак
const bruteForceProtection = async (req, res, next) => {
  const { alias } = req.body;
  
  if (!alias) {
    return next();
  }

  try {
    const partnerAuth = await db.getPartnerAuth(alias);
    
    if (partnerAuth) {
      // Проверяем блокировку
      if (partnerAuth.LockUntil && new Date() < new Date(partnerAuth.LockUntil)) {
        const lockTimeLeft = Math.ceil((new Date(partnerAuth.LockUntil) - new Date()) / (1000 * 60));
        return res.status(429).json({
          success: false,
          message: `Аккаунт заблокирован. Попробуйте снова через ${lockTimeLeft} минут`
        });
      }
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  verifyToken,
  verifyPartner,
  verifyAdmin,
  logAction,
  bruteForceProtection
};