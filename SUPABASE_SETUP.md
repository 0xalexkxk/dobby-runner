# Настройка Supabase для Donut Runner

## Шаг 1: Создание проекта Supabase

1. Перейдите на [supabase.com](https://supabase.com) и создайте аккаунт
2. Нажмите "New project"
3. Заполните форму:
   - **Name**: donut-runner
   - **Database Password**: Сохраните пароль в надежном месте!
   - **Region**: Выберите ближайший к вам регион
4. Нажмите "Create new project" и подождите пару минут

## Шаг 2: Получение DATABASE_URL

1. В панели управления Supabase перейдите в **Settings → Database**
2. Найдите секцию **Connection string**
3. Скопируйте **URI** из раздела **Connection pooling** (не из Direct connection!)
4. URL будет выглядеть примерно так:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```

## Шаг 3: Настройка сервера

1. Создайте файл `.env` в папке `server`:
   ```bash
   cd server
   cp .env.example .env
   ```

2. Откройте `.env` и вставьте ваш DATABASE_URL:
   ```env
   DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   NODE_ENV=production
   SECRET_KEY=your-secret-key-here
   ```

3. Замените `[YOUR-PASSWORD]` и `[PROJECT-REF]` на ваши значения

## Шаг 4: Использование PostgreSQL версии сервера

1. В `package.json` обновите скрипт запуска:
   ```json
   "scripts": {
     "start": "node server-pg.js",
     "start-sqlite": "node server.js",
     "dev": "nodemon server-pg.js"
   }
   ```

2. Запустите сервер:
   ```bash
   npm start
   ```

## Шаг 5: Миграция данных из SQLite (опционально)

Если у вас есть существующие данные в SQLite:

1. Сделайте backup через API:
   ```
   GET http://localhost:3000/api/admin/backup-scores
   ```

2. Запустите скрипт миграции:
   ```bash
   node migrate-to-pg.js
   ```

## Деплой на Render

1. В настройках Render добавьте Environment Variable:
   - Key: `DATABASE_URL`
   - Value: Ваш Supabase URL

2. Убедитесь, что в `package.json` start скрипт использует `server-pg.js`

3. Деплойте проект - теперь данные будут сохраняться в Supabase!

## Проверка подключения

После запуска сервера вы должны увидеть:
```
Database connected at: 2024-01-20T10:30:00.000Z
Database tables initialized successfully!
Database: PostgreSQL (Supabase)
```

## Управление базой данных

В Supabase Dashboard:
- **Table Editor**: Просмотр и редактирование данных
- **SQL Editor**: Выполнение SQL запросов
- **Database → Backups**: Автоматические бэкапы

## Безопасность

⚠️ **Важно**:
- Никогда не коммитьте файл `.env` в git
- Используйте разные пароли для dev и production
- В production используйте connection pooling URL

## Устранение проблем

### Ошибка подключения
- Проверьте правильность DATABASE_URL
- Убедитесь, что IP вашего сервера не заблокирован (Supabase → Settings → Database → Allowed IP addresses)

### Медленные запросы
- Используйте connection pooling URL (с портом 5432)
- Проверьте индексы в таблице scores

### Превышен лимит подключений
- Уменьшите `max` в настройках Pool в `server-pg.js`
- Используйте PgBouncer (включен в Supabase по умолчанию)

## Мониторинг

Supabase предоставляет:
- Метрики использования БД
- Логи запросов
- Алерты при превышении лимитов

Проверяйте в разделе **Reports** в dashboard.