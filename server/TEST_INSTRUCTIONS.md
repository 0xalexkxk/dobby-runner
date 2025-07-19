# 🧪 Инструкция по тестированию сервера

## Быстрый старт

### Windows:
```bash
cd server
start-test.bat
```

### Linux/Mac:
```bash
cd server
chmod +x start-test.sh
./start-test.sh
```

## Ручное тестирование

### 1. Запустите сервер
```bash
cd server
npm start
```

### 2. В новом терминале запустите ngrok (опционально)
```bash
ngrok http 3000
```
Скопируйте новый URL и обновите его в:
- `server.js` (SERVER_URL)
- `load-test.js` (SERVER_URL)
- `../client/game.js` (SERVER_URL)

### 3. Запустите тест
```bash
cd server
npm test
```

## Проверка состояния сервера

### Локально:
```bash
curl http://localhost:3000/api/health
```

### Через ngrok:
```bash
curl https://ваш-url.ngrok-free.app/api/health
```

## Параметры теста

Измените в `load-test.js`:
```javascript
const TEST_CONFIG = {
    concurrent_users: 50,      // Количество пользователей
    test_duration_minutes: 5,  // Длительность теста
    score_submissions_per_user: 3,
    leaderboard_requests_per_user: 10
};
```

## Ожидаемые результаты

✅ **Хорошо:**
- Success Rate > 95%
- Average Response Time < 500ms
- Requests/Second > 20

⚠️ **Требует внимания:**
- Success Rate 90-95%
- Average Response Time 500-1000ms
- Requests/Second 10-20

❌ **Плохо:**
- Success Rate < 90%
- Average Response Time > 1000ms
- Requests/Second < 10

## Решение проблем

### "Server health check failed"
1. Проверьте, запущен ли сервер
2. Проверьте правильность URL в load-test.js
3. Попробуйте локальный тест

### "ECONNREFUSED"
- Сервер не запущен. Выполните `npm start`

### "429 Too Many Requests"
- Сработал rate limiter. Это нормально для теста
- Можно увеличить лимиты в server.js

### Высокое время отклика
- Проверьте загрузку CPU/памяти
- Убедитесь, что включен WAL режим SQLite
- Проверьте работу кэша