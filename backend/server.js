const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./src/routes/auth');
const partnerRoutes = require('./src/routes/partner');
const adminRoutes = require('./src/routes/admin');
const { errorHandler, notFound } = require('./src/middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Слишком много запросов, попробуйте позже'
});

app.use(limiter);

// CORS configuration
// В development проще разрешить все origins (удобно для локальной разработки).
// В production оставляем строгую проверку по списку allowedOrigins.
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:8080',
  'http://localhost:8081',
  'http://127.0.0.1:8080',
  'http://127.0.0.1:8081',
  'http://localhost',
  'http://127.0.0.1',
];

const corsOptions = {
  origin: function (origin, callback) {
    // Браузер может отправлять запросы без Origin (например при сервер-сервер запросах)
    if (!origin) return callback(null, true);

    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.log('❌ Заблокированный origin:', origin);
    callback(new Error('Доступ запрещен CORS policy'));
  },
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
// Обработка preflight-запросов для всех маршрутов (OPTIONS)
app.options('*', cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/partner', partnerRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Инициализируем базу данных и запускаем сервер
async function startServer() {
  try {
    // Подключаемся к базе данных
    const db = require('./src/models/database');
    await db.connect();
    console.log('✅ База данных инициализирована');
    
    // Передаем базу в Telegram сервис
    const telegramService = require('./src/services/telegramService');
    telegramService.setDatabase(db);
    console.log('✅ Telegram сервис подключен к базе данных');

    const HOST = process.env.HOST || '0.0.0.0';
    const LOCAL_IP = process.env.LOCAL_IP || '193.246.162.61';

    app.listen(PORT, HOST, () => {
      console.log(`🚀 Сервер запущен на ${HOST}:${PORT}`);
      console.log(`📝 API доступен по адресу: http://localhost:${PORT}/api`);
      console.log(`🌐 Локальная сеть: http://${LOCAL_IP}:${PORT}/api`);
      console.log(`🏥 Health check: http://${LOCAL_IP}:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('❌ Ошибка запуска сервера:', error.message);
    process.exit(1);
  }
}

startServer();