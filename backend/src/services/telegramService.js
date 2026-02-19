const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

class TelegramService {
  constructor() {
    this.bot = null;
    this.db = null;
    this.setupBot();
  }

  setDatabase(db) {
    this.db = db;
  }

  setupBot() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const frontendUrl = process.env.FRONTEND_URL || '';
    
    // Отключаем Telegram бот на localhost
    if (frontendUrl.includes('localhost') || frontendUrl.includes('127.0.0.1')) {
      console.log('ℹ️  Telegram бот отключен (localhost окружение)');
      return;
    }
    
    if (!token) {
      console.warn('⚠️ Telegram bot token не настроен');
      return;
    }

    try {
      this.bot = new TelegramBot(token, { polling: true });
      console.log('✅ Telegram бот инициализирован с polling');
      
      // Проверяем подключение
      this.bot.getMe().then((botInfo) => {
        console.log(`🤖 Telegram бот: @${botInfo.username}`);
      }).catch((error) => {
        console.error('❌ Ошибка подключения к Telegram:', error.message);
      });
      
      // Обработчик команды /start
      this.bot.onText(/\/start/, async (msg) => {
        await this.handleStartCommand(msg);
      });
      
      // Обработчик для callback query (нажатие на inline кнопки)
      this.bot.on('callback_query', async (callbackQuery) => {
        const msg = callbackQuery.message;
        const data = callbackQuery.data;
        const chatId = msg.chat.id;
        
        // Обработка копирования chatId
        if (data.startsWith('copy_chatid_')) {
          const chatIdToCopy = data.replace('copy_chatid_', '');
          
          try {
            // Отправляем уведомление о копировании
            await this.bot.answerCallbackQuery(callbackQuery.id, {
              text: `Chat ID: ${chatIdToCopy}`,
              show_alert: true
            });
            
            console.log(`📋 Пользователь ${chatId} запросил свой Chat ID`);
          } catch (error) {
            console.error('❌ Ошибка обработки callback query:', error.message);
          }
        }
      });
      
    } catch (error) {
      console.error('❌ Ошибка инициализации Telegram бота:', error.message);
    }
  }

  async handleStartCommand(msg) {
    const chatId = msg.chat.id;
    const username = msg.from.username || 'пользователь';
    const firstName = msg.from.first_name || '';
    
    console.log(`📱 Получена команда /start от @${username} (chatId: ${chatId})`);
    
    // Отправляем приветственное сообщение с chatId
    const welcomeMessage = `
🎉 <b>Добро пожаловать в FREEDOM GROUP!</b>

✅ <b>Вы успешно подключились к боту</b>

Теперь вы будете получать уведомления о новых документах прямо в Telegram!

💼 <b>Что вы будете получать:</b>
📄 Уведомления о новых документах
✨ Напоминания о важных событиях
📊 Актуальную информацию

🆔 <b>Ваш Chat ID:</b> <code>${chatId}</code>

⚠️ <b>Важно!</b> Сообщите этот Chat ID администратору при создании вашего аккаунта партнера, чтобы получать уведомления.

🔗 <a href="${process.env.FRONTEND_URL}">Перейти в личный кабинет</a>

<i>💡 Держите уведомления включенными, чтобы не пропустить важное!</i>
    `.trim();
    
    const options = {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '📋 Скопировать Chat ID',
              callback_data: `copy_chatid_${chatId}`
            }
          ],
          [
            {
              text: '🌐 Открыть личный кабинет',
              url: process.env.FRONTEND_URL || 'https://freedomgroup.online'
            }
          ]
        ]
      }
    };
    
    try {
      await this.sendMessage(chatId, welcomeMessage, options);
      console.log(`✅ Приветственное сообщение отправлено: chatId ${chatId}`);
    } catch (error) {
      console.error(`❌ Ошибка отправки приветственного сообщения:`, error.message);
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

  // Извлекаем chat_id из telegram поля
  getChatId(telegramData) {
    if (!telegramData) return null;
    
    // Убираем @ если есть
    let chatId = telegramData.startsWith('@') ? telegramData.slice(1) : telegramData;
    
    // Если это число, возвращаем как chat_id
    if (/^-?\d+$/.test(chatId)) {
      return chatId;
    }
    
    // Иначе это username - предупреждаем, что нужно сначала отправить /start боту
    console.warn(`⚠️ Telegram username ${telegramData} - пользователь должен отправить /start боту`);
    return `@${chatId}`;
  }

  // Отправка уведомления о публикации документов
  async sendDocumentsPublishedNotification(telegramData, partnerName, documents) {
    const chatId = this.getChatId(telegramData);
    
    // Build documents list
    const documentsList = documents.map((doc, idx) => 
      `${idx + 1}. 📄 <b>${doc.fileName}</b>\n   📅 ${doc.period} • ${doc.date}`
    ).join('\n\n');
    
    const message = `
🔔 <b>FREEDOM GROUP</b>
📄 <b>Новые документы опубликованы!</b>

👤 <b>Партнер:</b> ${partnerName}
📊 <b>Документов:</b> ${documents.length}

${documentsList}

💼 Документы доступны для просмотра и скачивания в личном кабинете.

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
      if (chatId.startsWith('@')) {
        console.warn(`⚠️ Не удалось отправить сообщение пользователю ${chatId}. Возможно, бот не имеет доступа к чату или пользователь не начал диалог с ботом.`);
        throw new Error(`Невозможно отправить сообщение пользователю ${telegramData}. Убедитесь, что пользователь начал диалог с ботом.`);
      }
      throw error;
    }
  }

  // Отправка уведомления о новых документах (старый метод для совместимости)
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