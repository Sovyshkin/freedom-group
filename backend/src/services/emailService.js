const nodemailer = require('nodemailer');
require('dotenv').config();

class EmailService {
  constructor() {
    this.transporter = null;
    this.setupTransporter();
  }

  setupTransporter() {
    try {
      // Проверяем наличие настроек SMTP
      if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
        console.log('ℹ️  SMTP не настроен - email уведомления отключены');
        return;
      }

      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      // Проверяем подключение
      this.transporter.verify((error, success) => {
        if (error) {
          console.error('❌ Ошибка настройки SMTP:', error.message);
        } else {
          console.log('✅ SMTP сервер готов для отправки писем');
        }
      });
    } catch (error) {
      console.log('ℹ️  SMTP не настроен - email уведомления отключены');
      this.transporter = null;
    }
  }

  async sendEmail(to, subject, htmlContent, textContent = null) {
    if (!this.transporter) {
      console.log('📧 Email не отправлен (сервис не настроен):', { to, subject });
      return { success: false, message: 'Email сервис не настроен' };
    }

    const mailOptions = {
      from: `"FREEDOM GROUP" <${process.env.SMTP_USER}>`,
      to: to,
      subject: subject,
      html: htmlContent,
      text: textContent || this.extractTextFromHtml(htmlContent)
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Письмо отправлено: ${to} - ${subject}`);
      return info;
    } catch (error) {
      console.error(`❌ Ошибка отправки письма ${to}:`, error.message);
      throw error;
    }
  }

  extractTextFromHtml(html) {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  // Отправка уведомления о новых документах
  async sendDocumentNotification(email, partnerName, period) {
    const subject = 'Новые документы готовы к скачиванию';
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #2c3e50; color: white; padding: 20px; text-align: center; }
              .content { padding: 30px 20px; }
              .footer { background: #ecf0f1; padding: 20px; text-align: center; font-size: 12px; }
              .button { 
                display: inline-block; 
                padding: 12px 24px; 
                background: #3498db; 
                color: white; 
                text-decoration: none; 
                border-radius: 5px;
                margin: 20px 0;
              }
              .highlight { background: #f39c12; color: white; padding: 2px 6px; border-radius: 3px; }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>FREEDOM GROUP</h1>
                  <p>Партнерская система</p>
              </div>
              
              <div class="content">
                  <h2>Здравствуйте, ${partnerName}!</h2>
                  
                  <p>Уведомляем вас о том, что документы за период <span class="highlight">${period}</span> готовы к скачиванию.</p>
                  
                  <p>Для просмотра и загрузки документов перейдите в личный кабинет:</p>
                  
                  <p style="text-align: center;">
                      <a href="${process.env.FRONTEND_URL}" class="button">Перейти в личный кабинет</a>
                  </p>
                  
                  <p><strong>Важная информация:</strong></p>
                  <ul>
                      <li>Документы содержат актуальную информацию о ваших начислениях</li>
                      <li>Рекомендуем сохранить документы на своем устройстве</li>
                      <li>При возникновении вопросов обращайтесь в службу поддержки</li>
                  </ul>
                  
                  <p>Спасибо за сотрудничество!</p>
              </div>
              
              <div class="footer">
                  <p>© 2026 FREEDOM GROUP. Все права защищены.</p>
                  <p>Это автоматическое сообщение, не отвечайте на него.</p>
              </div>
          </div>
      </body>
      </html>
    `;

    return await this.sendEmail(email, subject, htmlContent);
  }

  // Отправка ссылки для сброса пароля
  async sendPasswordResetEmail(email, partnerName, resetLink) {
    const subject = 'Восстановление пароля';
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #e74c3c; color: white; padding: 20px; text-align: center; }
              .content { padding: 30px 20px; }
              .footer { background: #ecf0f1; padding: 20px; text-align: center; font-size: 12px; }
              .button { 
                display: inline-block; 
                padding: 12px 24px; 
                background: #e74c3c; 
                color: white; 
                text-decoration: none; 
                border-radius: 5px;
                margin: 20px 0;
              }
              .warning { background: #f39c12; color: white; padding: 10px; border-radius: 5px; }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>FREEDOM GROUP</h1>
                  <p>Восстановление пароля</p>
              </div>
              
              <div class="content">
                  <h2>Здравствуйте, ${partnerName}!</h2>
                  
                  <p>Мы получили запрос на восстановление пароля для вашей учетной записи.</p>
                  
                  <p>Для установки нового пароля перейдите по ссылке:</p>
                  
                  <p style="text-align: center;">
                      <a href="${resetLink}" class="button">Восстановить пароль</a>
                  </p>
                  
                  <div class="warning">
                      <p><strong>⚠️ Важно:</strong></p>
                      <ul>
                          <li>Ссылка действует только <strong>1 час</strong></li>
                          <li>Ссылка одноразовая</li>
                          <li>Если вы не запрашивали восстановление пароля, проигнорируйте это письмо</li>
                      </ul>
                  </div>
                  
                  <p>Если у вас возникли проблемы с переходом по ссылке, скопируйте и вставьте следующий URL в адресную строку браузера:</p>
                  <p style="word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 5px;">${resetLink}</p>
              </div>
              
              <div class="footer">
                  <p>© 2026 FREEDOM GROUP. Все права защищены.</p>
                  <p>Это автоматическое сообщение, не отвечайте на него.</p>
              </div>
          </div>
      </body>
      </html>
    `;

    return await this.sendEmail(email, subject, htmlContent);
  }

  // Отправка приглашения новому партнеру
  async sendPartnerInvitation(email, partnerName, alias, resetLink) {
    const subject = 'Добро пожаловать в FREEDOM GROUP!';
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #27ae60; color: white; padding: 20px; text-align: center; }
              .content { padding: 30px 20px; }
              .footer { background: #ecf0f1; padding: 20px; text-align: center; font-size: 12px; }
              .button { 
                display: inline-block; 
                padding: 12px 24px; 
                background: #27ae60; 
                color: white; 
                text-decoration: none; 
                border-radius: 5px;
                margin: 20px 0;
              }
              .credentials { background: #3498db; color: white; padding: 15px; border-radius: 5px; }
              .highlight { background: #f39c12; color: white; padding: 2px 6px; border-radius: 3px; }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>🎉 Добро пожаловать!</h1>
                  <p>FREEDOM GROUP - Партнерская система</p>
              </div>
              
              <div class="content">
                  <h2>Здравствуйте, ${partnerName}!</h2>
                  
                  <p>Добро пожаловать в партнерскую систему FREEDOM GROUP! Для вас была создана учетная запись.</p>
                  
                  <div class="credentials">
                      <p><strong>Ваши данные для входа:</strong></p>
                      <p>🔑 <strong>Логин:</strong> <span class="highlight">${alias}</span></p>
                      <p>📧 <strong>Email:</strong> ${email}</p>
                  </div>
                  
                  <p>Для завершения регистрации необходимо установить пароль. Перейдите по ссылке:</p>
                  
                  <p style="text-align: center;">
                      <a href="${resetLink}" class="button">Установить пароль</a>
                  </p>
                  
                  <p><strong>Что вы сможете делать в личном кабинете:</strong></p>
                  <ul>
                      <li>📄 Просматривать документы</li>
                      <li>💾 Скачивать файлы</li>
                      <li>📊 Отслеживать статистику</li>
                      <li>🔍 Искать документы по периоду</li>
                  </ul>
                  
                  <p><strong>⚠️ Важно:</strong> Ссылка для установки пароля действует только 1 час!</p>
              </div>
              
              <div class="footer">
                  <p>© 2026 FREEDOM GROUP. Все права защищены.</p>
                  <p>По вопросам обращайтесь в службу поддержки.</p>
              </div>
          </div>
      </body>
      </html>
    `;

    return await this.sendEmail(email, subject, htmlContent);
  }
}

module.exports = new EmailService();