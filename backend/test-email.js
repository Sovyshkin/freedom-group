// Тест отправки email уведомления
require('dotenv').config();
const emailService = require('./src/services/emailService');

async function testEmail() {
  console.log('🧪 Тестирование отправки email...\n');
  
  console.log('📋 Конфигурация SMTP:');
  console.log('Host:', process.env.SMTP_HOST);
  console.log('Port:', process.env.SMTP_PORT);
  console.log('User:', process.env.SMTP_USER);
  console.log('From:', process.env.SMTP_FROM);
  console.log('');
  
  const testDocuments = [
    {
      fileName: 'Счет №123.xlsx',
      period: '01.01.2026 — 31.01.2026',
      date: '18.02.2026'
    },
    {
      fileName: 'Акт сверки.xlsx',
      period: '01.02.2026 — 15.02.2026',
      date: '18.02.2026'
    }
  ];
  
  try {
    console.log('📧 Отправка тестового письма...');
    
    await emailService.sendDocumentsPublishedNotification(
      'accounting@freedomgroup.online', // Отправляем на тот же адрес для теста
      'Тестовый Партнер',
      testDocuments
    );
    
    console.log('✅ Письмо успешно отправлено!');
    console.log('📬 Проверьте почту: accounting@freedomgroup.online');
    
  } catch (error) {
    console.error('❌ Ошибка отправки:', error.message);
    console.error('Детали:', error);
  }
  
  process.exit(0);
}

testEmail();
