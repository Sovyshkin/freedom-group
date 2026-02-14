const axios = require('axios');

// Тест авторизации администратора
async function testAdminLogin() {
  try {
    console.log('🧪 Тестируем авторизацию администратора...');
    
    const response = await axios.post('http://localhost:3001/api/auth/admin/login', {
      username: 'admin',
      password: 'admin123'
    });

    if (response.data.success) {
      console.log('✅ Авторизация администратора успешна!');
      console.log('👤 Пользователь:', response.data.user);
      console.log('🔑 Токен получен:', response.data.token ? 'Да' : 'Нет');
    } else {
      console.log('❌ Ошибка авторизации:', response.data.message);
    }
    
  } catch (error) {
    if (error.response) {
      console.log('❌ HTTP Error:', error.response.status);
      console.log('💬 Message:', error.response.data);
    } else {
      console.log('❌ Network Error:', error.message);
    }
  }
}

// Запускаем тест
testAdminLogin();