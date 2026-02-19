const nodemailer = require('nodemailer');
require('dotenv').config();

class EmailService {
  constructor() {
    this.transporter = null;
    this.setupTransporter();
  }

  setupTransporter() {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USER;
    const smtpPassword = process.env.SMTP_PASSWORD;
    
    // Проверяем наличие настроек SMTP
    if (!smtpHost || !smtpPort) {
      console.log('ℹ️  SMTP не настроен - email уведомления отключены');
      return;
    }
    
    try {
      // Gmail SMTP configuration
      const smtpConfig = {
        host: smtpHost,
        port: parseInt(smtpPort),
        secure: parseInt(smtpPort) === 465, // true for 465, false for 587
        auth: smtpUser && smtpPassword ? {
          user: smtpUser,
          pass: smtpPassword
        } : undefined,
        tls: {
          rejectUnauthorized: false
        }
      };

      this.transporter = nodemailer.createTransport(smtpConfig);

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

    const fromEmail = process.env.SMTP_FROM || 'accounting@freedomgroup.online';
    const mailOptions = {
      from: `"FREEDOM GROUP" <${fromEmail}>`,
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

  // Отправка уведомления о публикации документов
  async sendDocumentsPublishedNotification(email, partnerName, documents) {
    const subject = '📄 Новые документы опубликованы';
    
    // Build documents list HTML
    const documentsList = documents.map(doc => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e0e0e0;">${doc.fileName || 'Документ'}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e0e0e0;">${doc.period || '—'}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e0e0e0;">${doc.date || '—'}</td>
      </tr>
    `).join('');
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { 
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
                line-height: 1.6; 
                color: #1f2937;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                padding: 40px 20px;
              }
              .email-wrapper { max-width: 600px; margin: 0 auto; }
              .email-container { 
                background: white; 
                border-radius: 16px; 
                overflow: hidden;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
              }
              .header { 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white; 
                padding: 40px 30px; 
                text-align: center;
              }
              .header h1 { 
                font-size: 28px; 
                font-weight: 700; 
                margin-bottom: 8px;
                letter-spacing: -0.5px;
              }
              .header p { 
                font-size: 16px; 
                opacity: 0.95;
              }
              .content { 
                padding: 40px 30px;
                background: white;
              }
              .greeting { 
                font-size: 20px; 
                font-weight: 600; 
                color: #1f2937;
                margin-bottom: 20px;
              }
              .message { 
                font-size: 16px; 
                color: #4b5563;
                margin-bottom: 24px;
                line-height: 1.7;
              }
              .documents-section {
                background: #f9fafb;
                border-radius: 12px;
                padding: 24px;
                margin: 30px 0;
              }
              .documents-section h3 {
                font-size: 18px;
                color: #1f2937;
                margin-bottom: 16px;
                font-weight: 600;
              }
              .documents-table {
                width: 100%;
                border-collapse: collapse;
                background: white;
                border-radius: 8px;
                overflow: hidden;
              }
              .documents-table th {
                background: #6366f1;
                color: white;
                padding: 12px;
                text-align: left;
                font-weight: 600;
                font-size: 14px;
              }
              .button-wrapper { 
                text-align: center; 
                margin: 32px 0;
              }
              .button { 
                display: inline-block; 
                padding: 16px 32px; 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white; 
                text-decoration: none; 
                border-radius: 8px;
                font-weight: 600;
                font-size: 16px;
                box-shadow: 0 4px 14px rgba(102, 126, 234, 0.4);
                transition: transform 0.2s;
              }
              .info-box {
                background: #eff6ff;
                border-left: 4px solid #3b82f6;
                padding: 16px 20px;
                border-radius: 8px;
                margin: 24px 0;
              }
              .info-box-title {
                font-weight: 600;
                color: #1e40af;
                margin-bottom: 8px;
                font-size: 15px;
              }
              .info-box ul {
                margin-left: 20px;
                color: #1e40af;
              }
              .info-box li {
                margin: 6px 0;
                font-size: 14px;
              }
              .footer { 
                background: #f9fafb;
                padding: 30px; 
                text-align: center;
              }
              .footer-text {
                font-size: 13px;
                color: #6b7280;
                margin: 8px 0;
              }
              .footer-logo {
                font-size: 18px;
                font-weight: 700;
                color: #6366f1;
                margin-bottom: 12px;
              }
              @media only screen and (max-width: 600px) {
                .content { padding: 30px 20px; }
                .header { padding: 30px 20px; }
                .header h1 { font-size: 24px; }
                .button { padding: 14px 28px; font-size: 15px; }
              }
          </style>
      </head>
      <body>
          <div class="email-wrapper">
              <div class="email-container">
                  <div class="header">
                      <h1>📄 FREEDOM GROUP</h1>
                      <p>Партнёрская система</p>
                  </div>
                  
                  <div class="content">
                      <div class="greeting">Здравствуйте, ${partnerName}!</div>
                      
                      <p class="message">
                          Уведомляем вас о том, что новые документы были опубликованы и доступны для просмотра и скачивания в вашем личном кабинете.
                      </p>
                      
                      <div class="documents-section">
                          <h3>📋 Опубликованные документы (${documents.length}):</h3>
                          <table class="documents-table">
                              <thead>
                                  <tr>
                                      <th>Файл</th>
                                      <th>Период</th>
                                      <th>Дата</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  ${documentsList}
                              </tbody>
                          </table>
                      </div>
                      
                      <div class="button-wrapper">
                          <a href="${process.env.FRONTEND_URL || 'https://freedomgroup.online'}" class="button">
                              🔐 Перейти в личный кабинет
                          </a>
                      </div>
                      
                      <div class="info-box">
                          <div class="info-box-title">ℹ️ Важная информация:</div>
                          <ul>
                              <li>Документы содержат актуальные данные о ваших начислениях</li>
                              <li>Рекомендуем сохранить документы на вашем устройстве</li>
                              <li>В случае обнаружения несоответствий свяжитесь с нами</li>
                              <li>Документы доступны в разделе «Мои документы»</li>
                          </ul>
                      </div>
                      
                      <p class="message" style="margin-top: 24px;">
                          Благодарим за сотрудничество! 🤝
                      </p>
                  </div>
                  
                  <div class="footer">
                      <div class="footer-logo">FREEDOM GROUP</div>
                      <p class="footer-text">© 2026 Freedom Group. Все права защищены.</p>
                      <p class="footer-text">Это автоматическое сообщение, пожалуйста, не отвечайте на него.</p>
                      <p class="footer-text" style="margin-top: 16px; color: #9ca3af;">
                          По всем вопросам: accounting@freedomgroup.online
                      </p>
                  </div>
              </div>
          </div>
      </body>
      </html>
    `;

    return await this.sendEmail(email, subject, htmlContent);
  }

  // Отправка уведомления о новых документах (старый метод для совместимости)
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