#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
PGDATA_DIR="$BACKEND_DIR/.pgdata"

echo "========================================="
echo "  ACME Store - Sample Product"
echo "========================================="
echo ""

# --- PostgreSQL ---
echo "[1/5] Starting PostgreSQL..."
if pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
  echo "  PostgreSQL already running."
else
  if [ ! -d "$PGDATA_DIR" ]; then
    echo "  Initializing database..."
    LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 initdb -D "$PGDATA_DIR" --locale=C > /dev/null 2>&1
  fi
  pg_ctl -D "$PGDATA_DIR" -l "$PGDATA_DIR/logfile" start > /dev/null 2>&1
  sleep 2
  echo "  PostgreSQL started."
fi

# Create database if not exists
if ! psql -h localhost -lqt | cut -d \| -f 1 | grep -qw merchant_store; then
  createdb -h localhost merchant_store
  echo "  Created database: merchant_store"
fi

# --- Backend setup ---
echo "[2/5] Installing backend dependencies..."
cd "$BACKEND_DIR"
npm install --silent 2>/dev/null

echo "[3/5] Running database migrations..."
npx prisma generate > /dev/null 2>&1
npx prisma migrate deploy > /dev/null 2>&1

echo "[4/5] Seeding database..."
node prisma/seed.js 2>/dev/null && echo "  Database seeded." || echo "  Seed skipped (data may already exist)."

# --- Start services ---
echo "[5/5] Starting services..."
echo ""

# Start backend
node "$BACKEND_DIR/src/server.js" &
BACKEND_PID=$!

# Start frontend (simple http server)
cd "$FRONTEND_DIR"
npx --yes serve -s . -l 5173 --no-clipboard > /dev/null 2>&1 &
FRONTEND_PID=$!

sleep 2

echo "========================================="
echo "  Services running:"
echo "    Backend API:  http://localhost:3000"
echo "    Frontend:     http://localhost:5173"
echo "========================================="
echo ""
echo "Press Ctrl+C to stop all services."

# Cleanup on exit
cleanup() {
  echo ""
  echo "Shutting down..."
  kill $BACKEND_PID 2>/dev/null
  kill $FRONTEND_PID 2>/dev/null
  echo "Done."
}
trap cleanup EXIT INT TERM

wait
