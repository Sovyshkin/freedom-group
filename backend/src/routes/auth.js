const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const db = require('../models/database');
const { bruteForceProtection, logAction } = require('../middleware/auth');
const emailService = require('../services/emailService');
const telegramService = require('../services/telegramService');

const router = express.Router();

// Генерация JWT токена
const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, { 
    expiresIn: process.env.SESSION_TIMEOUT || '30m' 
  });
};

// @desc    Авторизация партнера
// @route   POST /api/auth/login
// @access  Public
router.post('/login', [
  body('login').notEmpty().withMessage('Логин или email обязателен'),
  body('password').isLength({ min: 6 }).withMessage('Пароль должен содержать минимум 6 символов'),
  bruteForceProtection,
  logAction('partner_login_attempt')
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

    const { login, password } = req.body;

    // Получаем данные партнера
    const partnerAuth = await db.getPartnerAuth(login);
    
    if (!partnerAuth) {
      return res.status(401).json({
        success: false,
        message: 'Неверные учетные данные'
      });
    }

    // Проверяем наличие хеша пароля
    const passwordHash = partnerAuth.pswHash || partnerAuth.PswHash;
    if (!passwordHash) {
      console.error('❌ Хеш пароля не найден для партнера:', login);
      return res.status(500).json({
        success: false,
        message: 'Ошибка конфигурации пользователя'
      });
    }

    // Проверяем пароль
    const isMatch = await bcrypt.compare(password, passwordHash);
    
    if (!isMatch) {
      // Увеличиваем счетчик неудачных попыток
      const failedAttempts = (partnerAuth.failedAttempts || partnerAuth.FailedAttempts || 0) + 1;
      let lockUntil = null;
      
      if (failedAttempts >= 5) {
        lockUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 минут
      }
      
      await db.updateFailedAttempts(partnerAuth.partnerId || partnerAuth.PartnerId, failedAttempts, lockUntil);
      
      return res.status(401).json({
        success: false,
        message: 'Неверные учетные данные'
      });
    }

    // Проверяем активность аккаунта
    if (!(partnerAuth.active || partnerAuth.Active)) {
      return res.status(403).json({
        success: false,
        message: 'Аккаунт неактивен. Установите пароль используя ссылку из письма'
      });
    }

    // Сбрасываем неудачные попытки и обновляем время последнего входа
    await db.updateFailedAttempts(partnerAuth.partnerId || partnerAuth.PartnerId, 0, null);
    await db.updateLastVisit(partnerAuth.partnerId || partnerAuth.PartnerId);

    // Генерируем токен
    const token = generateToken({
      partnerId: partnerAuth.partnerId || partnerAuth.PartnerId,
      alias: partnerAuth.alias || partnerAuth.Alias,
      role: 'partner'
    });

    res.json({
      success: true,
      message: 'Успешная авторизация',
      token,
      user: {
        id: partnerAuth.partnerId || partnerAuth.PartnerId,
        name: partnerAuth.name || partnerAuth.Name,
        email: partnerAuth.email || partnerAuth.Email,
        alias: partnerAuth.alias || partnerAuth.Alias,
        role: 'partner'
      }
    });

  } catch (error) {
    next(error);
  }
});

// @desc    Авторизация администратора
// @route   POST /api/auth/admin/login
// @access  Public
router.post('/admin/login', [
  body('username').notEmpty().withMessage('Имя пользователя обязательно'),
  body('password').isLength({ min: 6 }).withMessage('Пароль должен содержать минимум 6 символов'),
  logAction('admin_login_attempt')
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

    const { username, password } = req.body;

    // Получаем данные администратора
    const admin = await db.getAdminByUsername(username);
    
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Неверные учетные данные'
      });
    }

    // Проверяем наличие хеша пароля
    const passwordHash = admin.pswHash || admin.PswHash;
    if (!passwordHash) {
      console.error('❌ Хеш пароля не найден для пользователя:', username);
      return res.status(500).json({
        success: false,
        message: 'Ошибка конфигурации пользователя'
      });
    }

    // Проверяем пароль
    const isMatch = await bcrypt.compare(password, passwordHash);
    
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Неверные учетные данные'
      });
    }

    // Обновляем время последнего входа
    await db.updateAdminLastLogin(admin.inc);

    // Генерируем токен
    const token = generateToken({
      adminId: admin.inc,
      username: admin.username,
      role: 'admin'
    });

    res.json({
      success: true,
      message: 'Успешная авторизация',
      token,
      user: {
        id: admin.inc,
        username: admin.username,
        email: admin.email,
        role: 'admin'
      }
    });

  } catch (error) {
    next(error);
  }
});

// @desc    Запрос сброса пароля
// @route   POST /api/auth/forgot-password
// @access  Public
router.post('/forgot-password', [
  body('email').isEmail().withMessage('Введите корректный email'),
  logAction('password_reset_request')
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

    const { email } = req.body;

    // Ищем партнера по email
    const partner = await db.getPartnerByEmail(email);
    
    if (!partner) {
      // Возвращаем успешный ответ даже если email не найден (безопасность)
      return res.json({
        success: true,
        message: 'Если аккаунт с указанным email существует, на него отправлена ссылка для сброса пароля'
      });
    }

    // Генерируем токен сброса пароля
    const resetToken = uuidv4();
    const expireAt = new Date(Date.now() + 60 * 60 * 1000); // 1 час

    // Сохраняем токен в базу
    await db.createPasswordResetToken(partner.Inc, resetToken, expireAt);

    // Отправляем письмо с токеном
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    await emailService.sendPasswordResetEmail(partner.Email, partner.Name, resetLink);
    
    // Отправляем уведомление в Telegram если есть
    if (partner.Telegram) {
      await telegramService.sendPasswordResetNotification(partner.Telegram, partner.Name);
    }

    res.json({
      success: true,
      message: 'Если аккаунт с указанным email существует, на него отправлена ссылка для сброса пароля'
    });

  } catch (error) {
    next(error);
  }
});

// @desc    Проверка токена сброса пароля
// @route   GET /api/auth/reset-password/:token
// @access  Public
router.get('/reset-password/:token', async (req, res, next) => {
  try {
    const { token } = req.params;

    const resetData = await db.getPasswordResetToken(token);
    
    if (!resetData) {
      return res.status(400).json({
        success: false,
        message: 'Недействительный или истекший токен'
      });
    }

    res.json({
      success: true,
      message: 'Токен действителен',
      partnerId: resetData.PartnerId,
      partnerEmail: resetData.Email
    });

  } catch (error) {
    next(error);
  }
});

// @desc    Установка нового пароля
// @route   POST /api/auth/reset-password
// @access  Public
router.post('/reset-password', [
  body('token').notEmpty().withMessage('Токен обязателен'),
  body('password').isLength({ min: 6 }).withMessage('Пароль должен содержать минимум 6 символов'),
  logAction('password_reset_complete')
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

    const { token, password } = req.body;

    // Проверяем токен
    const resetData = await db.getPasswordResetToken(token);
    
    if (!resetData) {
      return res.status(400).json({
        success: false,
        message: 'Недействительный или истекший токен'
      });
    }

    // Хешируем новый пароль
    const passwordHash = await bcrypt.hash(password, 12);

    // Обновляем пароль партнера
    await db.updatePartnerPassword(resetData.PartnerId, passwordHash);

    // Отмечаем токен как использованный
    await db.markTokenAsUsed(token);

    res.json({
      success: true,
      message: 'Пароль успешно обновлен'
    });

  } catch (error) {
    next(error);
  }
});

// @desc    Проверка токена
// @route   GET /api/auth/verify
// @access  Private
router.get('/verify', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Токен не предоставлен' 
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.json({
      success: true,
      message: 'Токен действителен',
      user: decoded
    });
  } catch (error) {
    res.status(401).json({ 
      success: false, 
      message: 'Неверный токен' 
    });
  }
});

// @desc    Верификация токена
// @route   GET /api/auth/verify  
// @access  Private
router.get('/verify', require('../middleware/auth').verifyToken, async (req, res) => {
  try {
    const { user } = req;
    
    res.json({
      success: true,
      message: 'Токен действителен',
      user: {
        id: user.adminId || user.partnerId,
        username: user.username,
        alias: user.alias,
        role: user.role
      }
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Недействительный токен'
    });
  }
});

module.exports = router;