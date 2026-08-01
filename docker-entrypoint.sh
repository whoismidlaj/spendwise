#!/bin/sh

# Exit immediately if a command exits with a non-zero status
set -e

echo "Running Prisma migrations..."
# Run migrations using the generated prisma client
npx prisma migrate deploy

echo "Starting application..."
# Execute the container's main process (CMD)
exec "$@"
