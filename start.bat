@echo off
echo 🍩 Starting Donut Runner...

REM Check if node_modules exists
if not exist "server\node_modules" (
    echo 📦 Installing server dependencies...
    cd server
    call npm install
    cd ..
)

REM Start the server
echo 🚀 Starting server on http://localhost:3000
cd server
npm start