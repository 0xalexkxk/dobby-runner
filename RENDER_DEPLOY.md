# 🚀 Деплой на Render с Supabase

## ✅ Что уже готово
- PostgreSQL версия сервера (`server-pg.js`)
- Настроенный `package.json` (запускает PostgreSQL по умолчанию)
- Конфигурация Supabase готова

## 🔧 Деплой за 5 минут

### 1. Подготовка Render
1. Зайдите на [render.com](https://render.com)
2. Подключите ваш GitHub репозиторий
3. Создайте **Web Service**

### 2. Настройки сервиса
```
Name: donut-runner-server
Environment: Node
Build Command: npm install
Start Command: npm start
```

### 3. Environment Variables
Добавьте в Render Dashboard:

```
DATABASE_URL = postgresql://postgres:Derrixgod228!@db.yzpybjdnxoearneimpqw.supabase.co:5432/postgres
NODE_ENV = production
SECRET_KEY = donut-runner-secret-2024
PORT = 3000
```

### 4. Деплой
- Нажмите **Create Web Service**
- Ждите ~3-5 минут
- ✅ Готово! Leaderboard навсегда сохраняется в Supabase

## 🔍 Проверка работы

После деплоя проверьте:
- `https://your-app.onrender.com/api/health` - статус сервера
- `https://your-app.onrender.com/api/leaderboard` - таблица лидеров
- Логи в Render Dashboard покажут: `Database connected at: ...`

## 🎯 Результат

- **Локально (WSL)**: Может не подключаться к Supabase (IPv6 проблема)
- **На Render**: Всё работает идеально ✨
- **Leaderboard**: Навсегда сохраняется, никогда не сбрасывается!

## 🔄 Обновления

При изменении кода:
1. Пушите в GitHub
2. Render автоматически пересобирает
3. Данные в Supabase остаются нетронутыми

---

💡 **Совет**: Если нужно тестировать локально, используйте `npm run start:sqlite` для SQLite версии.