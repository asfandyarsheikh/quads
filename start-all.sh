#!/bin/bash

# Start all Caddy Router services
# This script starts the API, resolver, and cron services

echo "🚀 Starting Caddy Router System..."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Kill any existing processes on our ports
echo "🧹 Cleaning up existing processes..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:3001 | xargs kill -9 2>/dev/null || true

# Start API server in background
echo "✓ Starting API server on port 3000..."
node api.js > logs/api.log 2>&1 &
API_PID=$!
echo $API_PID > .api.pid

# Start Resolver server in background
echo "✓ Starting Resolver service on port 3001..."
node resolver.js > logs/resolver.log 2>&1 &
RESOLVER_PID=$!
echo $RESOLVER_PID > .resolver.pid

# Start Cron service in background
echo "✓ Starting Cron service..."
node cron.js > logs/cron.log 2>&1 &
CRON_PID=$!
echo $CRON_PID > .cron.pid

sleep 2

echo ""
echo "✅ All services started!"
echo ""
echo "📊 Service Status:"
echo "  API Server:     http://localhost:3000 (PID: $API_PID)"
echo "  Resolver:       http://localhost:3001 (PID: $RESOLVER_PID)"
echo "  Cron Service:   Running (PID: $CRON_PID)"
echo ""
echo "📝 Logs:"
echo "  tail -f logs/api.log"
echo "  tail -f logs/resolver.log"
echo "  tail -f logs/cron.log"
echo ""
echo "🛑 To stop all services:"
echo "  ./stop-all.sh"
echo ""
