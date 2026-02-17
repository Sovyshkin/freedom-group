# Руководство по миграции базы данных

## Добавление полей в таблицу Claim

Эта миграция добавляет дополнительные поля в таблицу `claim` для хранения расширенной информации из листа Partner Excel файлов.

### Новые поля:

- `type` - Тип документа (счет, акт и т.д.)
- `fullName` - Полное имя партнера
- `created` - Дата создания документа
- `currency` - Валюта (по умолчанию RUB)

### Как запустить миграцию:

```bash
npm run migrate
```

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
