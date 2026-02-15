# Решение проблемы с обновлением страницы в Vue Router (History Mode)

## Проблема
После обновления страницы (F5) сайт перестает загружаться и показывает 404 ошибку.

## Причина
Vue Router в режиме History использует HTML5 History API для навигации без перезагрузки страницы. При прямом обращении к URL (например, /admin или /dashboard) сервер пытается найти физический файл по этому пути, не находит его и возвращает 404.

## Решение

### 1. Development (локальная разработка)
Уже настроено в `vue.config.js`:
```javascript
devServer: {
  historyApiFallback: {
    rewrites: [{ from: /.*/, to: '/index.html' }]
  }
}
```

### 2. Production - Apache Server
Файл `.htaccess` уже создан в `/public/.htaccess` и будет автоматически скопирован при сборке.

При деплое на Apache:
- Убедитесь, что mod_rewrite включен: `sudo a2enmod rewrite`
- Перезапустите Apache: `sudo systemctl restart apache2`

### 3. Production - Nginx Server
Используйте конфигурацию из `nginx.conf`:

```bash
# Скопируйте конфигурацию
sudo cp nginx.conf /etc/nginx/sites-available/freedom-group

# Создайте символическую ссылку
sudo ln -s /etc/nginx/sites-available/freedom-group /etc/nginx/sites-enabled/

# Проверьте конфигурацию
sudo nginx -t

# Перезапустите Nginx
sudo systemctl restart nginx
```

### 4. Сборка для Production
```bash
npm run build
```

Файлы будут в папке `dist/`. Загрузите их на сервер.

## Проверка
После настройки попробуйте:
1. Открыть сайт
2. Перейти на любую страницу (например, /admin)
3. Нажать F5 (обновить страницу)
4. Страница должна загрузиться корректно

## Дополнительные настройки для сервера

### Если используете поддомен или папку
Измените `publicPath` в `vue.config.js`:
```javascript
// Для поддомена
publicPath: '/'

// Для подпапки (например, https://example.com/app/)
publicPath: '/app/'
```

### Если backend на другом домене
Убедитесь, что CORS настроен правильно в backend/server.js
