# Руководство по миграции базы данных

## Общая информация

Миграции используются для обновления структуры базы данных без потери существующих данных. Все миграции безопасны для повторного запуска.

## Доступные миграции

### 1. Миграция полей таблицы Claim
**Команда:** `npm run migrate`  
**Файл:** `scripts/migrate-add-claim-fields.js`

**Что добавляет:**
- `type` - Тип документа (счет, акт и т.д.)
- `fullName` - Полное имя партнера
- `created` - Дата создания документа
- `currency` - Валюта (по умолчанию RUB)

**Когда запускать:** После первой установки или обновления до версии с расширенными полями claim

---

### 2. Миграция ролей администраторов
**Команда:** `npm run migrate-admin-role`  
**Файл:** `scripts/migrate-add-admin-role.js`

**Что добавляет:**
- `role` - Роль администратора (admin/superadmin) в таблицу `admin`
- Устанавливает первого администратора как superadmin
- Остальным администраторам присваивает роль admin

**Когда запускать:** Для внедрения системы ролей администраторов

---

### 3. Миграция полей партнёров
**Команда:** `npm run migrate-partner-fields`  
**Файл:** `scripts/migrate-add-partner-fields.js`

**Что добавляет:**
- `birthDate` - Дата рождения партнёра (DATE)
- `active` - Статус активности партнёра (INTEGER, по умолчанию 1)

**Что делает:**
- Добавляет колонки, если их нет
- Устанавливает `active = 1` для всех существующих партнёров
- Безопасна для повторного запуска

**Когда запускать:** Для внедрения функций дней рождения и деактивации партнёров

---

## Как выполнить миграцию

### На локальной машине:

```bash
cd backend

# Выполнить миграцию полей claim
npm run migrate

# Выполнить миграцию ролей администраторов
npm run migrate-admin-role

# Выполнить миграцию полей партнёров
npm run migrate-partner-fields
```

### На сервере (production):

```bash
# Подключиться к серверу по SSH
ssh user@your-server.com

# Перейти в директорию проекта
cd /path/to/freedom-group/backend

# Выполнить нужную миграцию
npm run migrate-partner-fields

# Перезапустить сервер
pm2 restart freedom-backend
# или
sudo systemctl restart freedom-backend
```

### Проверка успешности миграции:

После выполнения команды вы должны увидеть:
```
✅ Миграция завершена успешно!
```

Если возникла ошибка, миграция безопасно откатится и покажет сообщение об ошибке.

---

## Порядок выполнения миграций (при первой установке)

Рекомендуемый порядок:

```bash
# 1. Инициализация базы данных (только при первой установке)
npm run init-db

# 2. Миграции в порядке создания
npm run migrate
npm run migrate-admin-role
npm run migrate-partner-fields
```

---

## Добавление полей в таблицу Claim (детали)

### Формат листа Partner в Excel файле:

Лист должен содержать два столбца: `name` (название поля) и `value` (значение).

Пример:

| name        | value              |
|-------------|-------------------|
| inc         | 10                |
| type        | Счет              |
| full name   | Андрей Билевич    |
| created     | 1/30/2026         |
| period from | 1/1/2026          |
| period till | 1/31/2026         |
| net         | 50000             |
| invoice     | 53190             |
| tax         | 3190              |
| currency    | RUB               |

### Обязательные поля:

- `inc` - Код партнера
- `period from` - Начало периода
- `period till` - Конец периода
- `net` - Чистая сумма
- `invoice` - Сумма к оплате
- `tax` - Сумма налога

### Опциональные поля:

- `type` - Тип документа
- `full name` - Полное имя
- `created` - Дата создания
- `currency` - Валюта

### Важно:

После обработки файла, лист `Partner` будет автоматически удален из Excel файла перед сохранением. При скачивании партнером, файл не будет содержать этот служебный лист.

### Откат миграции:

Если необходимо откатить изменения:

**SQLite:**
```sql
-- Создаем временную таблицу
CREATE TABLE claim_backup AS SELECT inc, partnerId, dateBeg, dateEnd, amount, payAmount, taxAmount, publishedAt, fileName, originalName, uploadedAt, fileSize FROM claim;

-- Удаляем старую таблицу
DROP TABLE claim;

-- Переименовываем временную таблицу
ALTER TABLE claim_backup RENAME TO claim;
```

**MS SQL:**
```sql
ALTER TABLE dbo.Claim DROP COLUMN Type;
ALTER TABLE dbo.Claim DROP COLUMN FullName;
ALTER TABLE dbo.Claim DROP COLUMN Created;
ALTER TABLE dbo.Claim DROP COLUMN Currency;
```
