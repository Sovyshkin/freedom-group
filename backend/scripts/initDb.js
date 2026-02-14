const bcrypt = require('bcryptjs');
const db = require('./database');
require('dotenv').config();

async function initializeDatabase() {
  try {
    console.log('🚀 Инициализация базы данных...');
    
    // Подключаемся к базе данных
    await db.connect();
    
    // Создаем администратора по умолчанию
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    
    // Проверяем, существует ли уже администратор
    const existingAdmin = await db.getAdminByUsername(adminUsername);
    
    if (!existingAdmin) {
      const passwordHash = await bcrypt.hash(adminPassword, 12);
      await db.createAdmin(adminUsername, passwordHash, 'admin@freedom-group.com');
      console.log(`✅ Создан администратор: ${adminUsername}`);
    } else {
      console.log(`ℹ️  Администратор ${adminUsername} уже существует`);
    }
    
    // Создаем тестовых партнеров для разработки
    if (process.env.NODE_ENV === 'development') {
      await createTestData();
    }
    
    console.log('✅ Инициализация базы данных завершена!');
    
  } catch (error) {
    console.error('❌ Ошибка инициализации базы данных:', error.message);
    throw error;
  } finally {
    await db.disconnect();
  }
}

async function createTestData() {
  try {
    console.log('📝 Создание тестовых данных...');
    
    // Проверяем, есть ли уже партнеры
    const existingPartner = await db.getPartnerByEmail('test@partner.com');
    
    if (!existingPartner) {
      // Создаем тестового партнера
      const result = await db.execute('dbo.sp_CreatePartnerWithPassword', {
        Name: 'ИП Тестовый Партнер',
        Email: 'test@partner.com',
        Telegram: '@test_partner',
        Alias: 'test_partner'
      });
      
      const partnerId = result.recordset[0].PartnerId;
      const alias = result.recordset[0].Alias;
      
      // Устанавливаем пароль (test123)
      const passwordHash = await bcrypt.hash('test123', 12);
      await db.updatePartnerPassword(partnerId, passwordHash);
      
      console.log(`✅ Создан тестовый партнер: ${alias} (пароль: test123)`);
      
      // Создаем тестовый claim
      const claimId = await db.createClaim({
        partnerId,
        dateBeg: new Date('2026-01-01'),
        dateEnd: new Date('2026-01-31'),
        amount: 50000.00,
        payAmount: 59000.00,
        taxAmount: 9000.00
      });
      
      // Создаем тестовый документ
      const testFileContent = Buffer.from('Тестовый документ для партнера', 'utf8');
      await db.saveDocument(
        claimId, 
        'test_document.xlsx', 
        testFileContent, 
        testFileContent.length,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      
      console.log('✅ Создан тестовый claim и документ');
    } else {
      console.log('ℹ️  Тестовые данные уже существуют');
    }
    
  } catch (error) {
    console.error('❌ Ошибка создания тестовых данных:', error.message);
  }
}

// Запускаем инициализацию если файл запущен напрямую
if (require.main === module) {
  initializeDatabase()
    .then(() => {
      console.log('🎉 Готово!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Критическая ошибка:', error.message);
      process.exit(1);
    });
}

module.exports = { initializeDatabase, createTestData };