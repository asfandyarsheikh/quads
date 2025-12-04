#!/bin/bash

# Stop all Caddy Router services

echo "🛑 Stopping Caddy Router System..."

# Stop API server
if [ -f .api.pid ]; then
    API_PID=$(cat .api.pid)
    if kill -0 $API_PID 2>/dev/null; then
        echo "  Stopping API server (PID: $API_PID)..."
        kill $API_PID
        rm .api.pid
    fi
fi

# Stop Resolver server
if [ -f .resolver.pid ]; then
    RESOLVER_PID=$(cat .resolver.pid)
    if kill -0 $RESOLVER_PID 2>/dev/null; then
        echo "  Stopping Resolver service (PID: $RESOLVER_PID)..."
        kill $RESOLVER_PID
        rm .resolver.pid
    fi
fi

# Stop Cron service
if [ -f .cron.pid ]; then
    CRON_PID=$(cat .cron.pid)
    if kill -0 $CRON_PID 2>/dev/null; then
        echo "  Stopping Cron service (PID: $CRON_PID)..."
        kill $CRON_PID
        rm .cron.pid
    fi
fi

# Fallback: kill by port
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:3001 | xargs kill -9 2>/dev/null || true

echo "✅ All services stopped!"
