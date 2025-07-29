# Сохранение данных Leaderboard на Render

## Проблема

На бесплатном плане Render файловая система эфемерная (ephemeral). Это означает, что все файлы, включая SQLite базу данных `leaderboard.db`, удаляются при:
- Перезапуске сервера
- Деплое новой версии
- Автоматическом спящем режиме (после 15 минут неактивности)

## Решения

### 1. Использование внешней базы данных (Рекомендуется)

#### PostgreSQL (Бесплатный вариант)
1. Создайте бесплатную PostgreSQL базу данных на [Render](https://render.com) или [Supabase](https://supabase.com)
2. Установите зависимость: `npm install pg`
3. Замените SQLite на PostgreSQL в `server.js`

#### Пример подключения PostgreSQL:
```javascript
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Создание таблицы
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS scores (
      id SERIAL PRIMARY KEY,
      nickname TEXT NOT NULL,
      score INTEGER NOT NULL,
      xp INTEGER NOT NULL,
      level INTEGER NOT NULL,
      game_time INTEGER NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      timestamp BIGINT NOT NULL,
      is_valid BOOLEAN DEFAULT true,
      validation_hash TEXT
    )
  `);
}
```

### 2. Использование облачного хранилища

#### MongoDB Atlas (Бесплатный вариант)
1. Создайте бесплатный кластер на [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Установите: `npm install mongodb`
3. Используйте MongoDB вместо SQLite

### 3. Временное решение - JSON файл с GitHub

Если нужно быстрое решение без внешней БД:
1. Сохраняйте данные в JSON файл
2. Коммитьте изменения в GitHub репозиторий
3. При старте загружайте данные из репозитория

**Внимание**: Это не рекомендуется для production!

## Переменные окружения для Render

Добавьте в настройках Render:
```
DATABASE_URL=postgresql://user:password@host:port/database
NODE_ENV=production
```

## Миграция существующих данных

Для сохранения текущих данных:
1. Скачайте backup: `GET /api/admin/backup-scores`
2. Импортируйте в новую БД после настройки

## Важные изменения в коде

Основные изменения уже внесены:
- ✅ Удалена автоматическая очистка таблицы при запуске
- ✅ Используется `CREATE TABLE IF NOT EXISTS`
- ⚠️ Необходимо заменить SQLite на внешнюю БД для Render

## Контакты

При возникновении вопросов обращайтесь в Issues проекта.