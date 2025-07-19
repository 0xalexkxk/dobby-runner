#!/bin/bash

echo "========================================"
echo "   Donut Runner Server Load Test"
echo "========================================"
echo
echo "Starting test sequence..."
echo

# Check if server is running
if ! curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "[!] Server not running. Starting server..."
    npm start &
    SERVER_PID=$!
    echo "Waiting for server to start..."
    sleep 5
fi

echo "[+] Running load test..."
echo
node load-test.js

# If we started the server, offer to stop it
if [ ! -z "$SERVER_PID" ]; then
    echo
    read -p "Stop server? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        kill $SERVER_PID
        echo "Server stopped."
    fi
fi