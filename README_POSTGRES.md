# Быстрый старт с PostgreSQL/Supabase

## 1. Настройка Supabase
1. Создайте проект на [supabase.com](https://supabase.com)
2. Скопируйте DATABASE_URL из Settings → Database → Connection string → URI

## 2. Настройка сервера
```bash
cd server
cp .env.example .env
# Вставьте ваш DATABASE_URL в .env файл
```

## 3. Запуск
```bash
npm install
npm start  # Запустит PostgreSQL версию (server-pg.js)
```

## 4. Миграция данных (опционально)
Если у вас есть данные в SQLite:
```bash
npm run migrate
```

## Доступные команды
- `npm start` - Запуск с PostgreSQL (по умолчанию)
- `npm run start:sqlite` - Запуск с SQLite (старая версия)
- `npm run migrate` - Миграция данных SQLite → PostgreSQL
- `npm run dev` - Запуск в режиме разработки с PostgreSQL

## Деплой на Render
1. Добавьте DATABASE_URL в Environment Variables
2. Деплойте - данные будут сохраняться в Supabase!

Подробная инструкция: [SUPABASE_SETUP.md](./SUPABASE_SETUP.md)