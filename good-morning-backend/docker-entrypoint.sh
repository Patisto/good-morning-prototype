#!/bin/sh
set -e

echo "Running migrations..."
node dist/db/migrate.js

echo "Checking seed data..."
node dist/seed.js

echo "Starting API..."
exec node dist/index.js
