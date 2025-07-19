#!/bin/bash

echo "🍩 Starting Donut Runner..."

# Check if node_modules exists
if [ ! -d "server/node_modules" ]; then
    echo "📦 Installing server dependencies..."
    cd server
    npm install
    cd ..
fi

# Start the server
echo "🚀 Starting server on http://localhost:3000"
cd server
npm start