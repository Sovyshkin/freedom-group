const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

class TelegramService {
  constructor() {
    this.bot = null;
    this.setupBot();
  }

  setupBot() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    
    if (!token) {
      console.warn('⚠️ Telegram bot token не настроен');
      return;
    }

    try {
      this.bot = new TelegramBot(token, { polling: false });
      console.log('✅ Telegram бот инициализирован');
      
      // Проверяем подключение
      this.bot.getMe().then((botInfo) => {
        console.log(`🤖 Telegram бот: @${botInfo.username}`);
      }).catch((error) => {
        console.error('❌ Ошибка подключения к Telegram:', error.message);
      });
      
    } catch (error) {
      console.error('❌ Ошибка инициализации Telegram бота:', error.message);
    }
  }

  async sendMessage(chatId, message, options = {}) {
    if (!this.bot) {
      console.log('📱 Telegram сообщение не отправлено (сервис не настроен):', { chatId, message: message.substring(0, 50) + '...' });
      return { success: false, message: 'Telegram сервис не настроен' };
    }

    try {
      const result = await this.bot.sendMessage(chatId, message, {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...options
      });
      console.log(`✅ Telegram сообщение отправлено: ${chatId}`);
      return result;
    } catch (error) {
      console.error(`❌ Ошибка отправки Telegram сообщения ${chatId}:`, error.message);
      throw error;
    }
  }

  // Извлекаем chat_id из username или возвращаем как есть если это уже ID
  getChatId(telegramData) {
    if (!telegramData) return null;
    
    // Убираем @ если есть
    let chatId = telegramData.startsWith('@') ? telegramData.slice(1) : telegramData;
    
    // Если это число, возвращаем как есть
    if (/^\d+$/.test(chatId)) {
      return chatId;
    }
    
    // Иначе возвращаем как username (для поиска нужно будет использовать другие методы)
    return `@${chatId}`;
  }

  // Отправка уведомления о новых документах
  async sendDocumentNotification(telegramData, partnerName, period) {
    const chatId = this.getChatId(telegramData);
    
    const message = `
🔔 <b>FREEDOM GROUP</b>
📄 <b>Новые документы готовы!</b>

👤 <b>Партнер:</b> ${partnerName}
📅 <b>Период:</b> ${period}

💼 Документы за указанный период готовы к скачиванию в личном кабинете.

🔗 <a href="${process.env.FRONTEND_URL}">Перейти в личный кабинет</a>

<i>💡 Рекомендуем сохранить документы на своем устройстве</i>
    `.trim();

    const options = {
      reply_markup: {
        inline_keyboard: [[
          {
            text: '📱 Открыть кабинет',
            url: process.env.FRONTEND_URL
          }
        ]]
      }
    };

    try {
      return await this.sendMessage(chatId, message, options);
    } catch (error) {
      // Если не удалось отправить по username, логируем ошибку
      if (chatId.startsWith('@')) {
        console.warn(`⚠️ Не удалось отправить сообщение пользователю ${chatId}. Возможно, бот не имеет доступа к чату или пользователь не начал диалог с ботом.`);
        throw new Error(`Невозможно отправить сообщение пользователю ${telegramData}. Убедитесь, что пользователь начал диалог с ботом.`);
      }
      throw error;
    }
  }

  // Отправка уведомления о сбросе пароля
  async sendPasswordResetNotification(telegramData, partnerName) {
    const chatId = this.getChatId(telegramData);
    
    const message = `
🔐 <b>FREEDOM GROUP</b>
🔄 <b>Восстановление пароля</b>

👤 <b>Партнер:</b> ${partnerName}

📧 На ваш email отправлена ссылка для восстановления пароля.

⚠️ <b>Важно:</b>
• Ссылка действует только 1 час
• Ссылка одноразовая
• Если вы не запрашивали восстановление, проигнорируйте письмо

🔒 <i>Ваша безопасность важна для нас!</i>
    `.trim();

    try {
      return await this.sendMessage(chatId, message);
    } catch (error) {
      if (chatId.startsWith('@')) {
        console.warn(`⚠️ Не удалось отправить уведомление о сбросе пароля пользователю ${chatId}`);
        throw new Error(`Невозможно отправить уведомление пользователю ${telegramData}`);
      }
      throw error;
    }
  }

  // Отправка приглашения новому партнеру
  async sendPartnerInvitation(telegramData, partnerName, alias) {
    const chatId = this.getChatId(telegramData);
    
    const message = `
🎉 <b>FREEDOM GROUP</b>
✨ <b>Добро пожаловать в команду!</b>

👤 <b>Партнер:</b> ${partnerName}
🔑 <b>Логин:</b> <code>${alias}</code>

🎯 <b>Для вас создан аккаунт в партнерской системе!</b>

📧 На ваш email отправлена ссылка для установки пароля.

💼 <b>В личном кабинете вы сможете:</b>
📄 Просматривать документы
💾 Скачивать файлы
📊 Отслеживать статистику
🔍 Искать по периоду

⚠️ <b>Важно:</b> Ссылка для установки пароля действует только 1 час!

🔗 <a href="${process.env.FRONTEND_URL}">Сайт партнерской системы</a>
    `.trim();

    const options = {
      reply_markup: {
        inline_keyboard: [[
          {
            text: '🌐 Открыть сайт',
            url: process.env.FRONTEND_URL
          }
        ]]
      }
    };

    try {
      return await this.sendMessage(chatId, message, options);
    } catch (error) {
      if (chatId.startsWith('@')) {
        console.warn(`⚠️ Не удалось отправить приглашение пользователю ${chatId}`);
        throw new Error(`Невозможно отправить приглашение пользователю ${telegramData}`);
      }
      throw error;
    }
  }

  // Массовая отправка сообщений (для административных целей)
  async sendBroadcast(chatIds, message, options = {}) {
    if (!Array.isArray(chatIds)) {
      throw new Error('chatIds должен быть массивом');
    }

    const results = [];
    const errors = [];

    for (const chatId of chatIds) {
      try {
        const result = await this.sendMessage(chatId, message, options);
        results.push({ chatId, success: true, result });
        
        // Небольшая задержка между сообщениями чтобы не попасть под ограничения Telegram
        await new Promise(resolve => setTimeout(resolve, 50));
        
      } catch (error) {
        errors.push({ chatId, success: false, error: error.message });
      }
    }

    return {
      successful: results.length,
      failed: errors.length,
      results,
      errors
    };
  }

  // Получение информации о боте
  async getBotInfo() {
    if (!this.bot) {
      throw new Error('Telegram бот не настроен');
    }

    try {
      const botInfo = await this.bot.getMe();
      return {
        id: botInfo.id,
        username: botInfo.username,
        firstName: botInfo.first_name,
        canJoinGroups: botInfo.can_join_groups,
        canReadAllGroupMessages: botInfo.can_read_all_group_messages,
        supportsInlineQueries: botInfo.supports_inline_queries
      };
    } catch (error) {
      console.error('❌ Ошибка получения информации о боте:', error.message);
      throw error;
    }
  }

  // Проверка доступности бота
  async checkBotHealth() {
    try {
      await this.getBotInfo();
      return { status: 'healthy', message: 'Бот работает нормально' };
    } catch (error) {
      return { status: 'unhealthy', message: error.message };
    }
  }
}

module.exports = new TelegramService();