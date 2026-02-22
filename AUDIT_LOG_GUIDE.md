# Система аудит-логов

## Обзор
Система журналирования действий администраторов автоматически записывает все важные действия в системе.

## Компоненты

### 1. База данных
- **Таблица**: `audit_log`
- **Поля**:
  - `id` - уникальный идентификатор
  - `timestamp` - дата/время события
  - `admin_id` - ID администратора
  - `admin_username` - имя администратора
  - `action` - тип действия
  - `entity_type` - тип сущности (partner, document, admin, etc.)
  - `entity_id` - ID сущности
  - `entity_name` - название сущности
  - `details` - детальная информация (JSON)
  - `ip_address` - IP адрес
  - `user_agent` - User Agent браузера

### 2. Backend

#### Модель (sqlite-database.js)
- `createAuditLog(logData)` - создание записи лога
- `getAuditLogs(filters)` - получение логов с фильтрацией
- `getAuditLogsCount(filters)` - подсчет логов

#### Middleware (auditLog.js)
```javascript
const { auditLog, createLog } = require('../middleware/auditLog');

// Автоматическое логирование через middleware
router.post('/partners', auditLog('create_partner', 'partner'), async (req, res) => {
  // ваш код
});

// Ручное логирование
await createLog(req, 'delete_partner', 'partner', partnerId, partnerName);
```

#### API Endpoints
- `GET /api/audit-logs` - получение журнала событий (только superadmin)
- `GET /api/audit-logs/stats` - статистика по действиям

### 3. Frontend

#### Компонент
Вкладка "Журнал событий" в AdminDashboard.vue (только для суперадмина)

#### Функции
- Просмотр всех событий
- Фильтрация по:
  - Администратору
  - Типу сущности  
  - Дате
  - Поиск по тексту
- Просмотр детальной информации

## Интеграция логирования

### Автоматическое логирование (рекомендуется)
Используйте middleware `auditLog`:

```javascript
const { auditLog } = require('../middleware/auditLog');

router.post('/resource', 
  verifyToken,
  verifyAdmin,
  auditLog('create_resource', 'resource'),
  async (req, res) => {
    //  ...
  }
);
```

### Ручное логирование
Для сложных случаев:

```javascript
const { createLog } = require('../middleware/auditLog');

// В любом месте кода
await createLog(
  req,                    // request object
  'custom_action',        // название действия
  'entity_type',          // тип сущности
  entityId,               // ID сущности
  entityName,             // название сущности
  { custom: 'data' }      // дополнительные детали
);
```

## Типы действий

### Партнёры
- `create_partner` - создание партнёра
- `update_partner` - обновление партнёра
- `delete_partner` - удаление партнёра

### Документы
- `upload_document` - загрузка документа
- `publish_document` - публикация документа
- `delete_document` - удаление документа

### Администраторы
- `create_admin` - создание администратора
- `update_admin` - обновление администратора
- `delete_admin` - удаление администратора
- `change_admin_password` - смена пароля администратора

### Система
- `login` - вход в систему
- `logout` - выход из системы

## Примеры использования

### Пример 1: Логирование создания партнёра
```javascript
router.post('/partners',
  verifyToken,
  verifyAdmin,
  auditLog('create_partner', 'partner'),
  async (req, res) => {
    const partner = await db.createPartner(req.body);
    res.json({ success: true, id: partner.id, name: partner.name });
  }
);
```

### Пример 2: Ручное логирование массовой операции
```javascript
router.post('/publish-all', async (req, res) => {
  const published = [];
  
  for (const docId of req.body.documentIds) {
    await db.publishDocument(docId);
    published.push(docId);
  }
  
  await createLog(
    req,
    'publish_documents_bulk',
    'document',
    null,
    `${published.length} documents`,
    { documentIds: published }
  );
  
  res.json({ success: true, count: published.length });
});
```

## Просмотр логов

### В админ-панели
1. Войти как суперадмин
2. Перейти на вкладку "Журнал событий"
3. Использовать фильтры для поиска нужных событий
4. Нажать "Подробнее" для просмотра деталей

### Через API
```javascript
// GET /api/audit-logs?adminId=1&entityType=partner&dateFrom=2024-01-01
const response = await api.get('/audit-logs', {
  params: {
    adminId: 1,
    entityType: 'partner',
    dateFrom: '2024-01-01',
    dateTo: '2024-12-31',
    search: 'ИП Валерий',
    limit: 100
  }
});
```

## Безопасность
- Доступ только для суперадминов
- Автоматическая фиксация IP адресов
- Логи нельзя удалить или изменить
- Чувствительные данные (пароли, токены) автоматически исключаются

## Производительность
- Индексы на timestamp, admin_id, entity_type
- Пагинация результатов
- Асинхронная запись логов (не блокирует основные операции)
