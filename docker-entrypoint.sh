#!/bin/sh

# Exit immediately if a command exits with a non-zero status
set -e

# Construct and export URL-encoded DATABASE_URL to support password characters like @, :, #, /
if [ -n "$POSTGRES_PASSWORD" ]; then
  export DATABASE_URL=$(node -e "
    const user = encodeURIComponent(process.env.POSTGRES_USER || 'postgres');
    const pass = encodeURIComponent(process.env.POSTGRES_PASSWORD);
    const db = encodeURIComponent(process.env.POSTGRES_DB || 'spendwise');
    const url = \`postgresql://\${user}:\${pass}@spendwise-postgres-db:5432/\${db}?schema=public\`;
    process.stdout.write(url);
  " | tail -n 1)
else
  echo "WARNING: POSTGRES_PASSWORD is not set!"
fi

echo "Waiting for database spendwise-postgres-db:5432 to accept connections..."
while ! node -e "
  const net = require('net');
  const client = net.connect({ port: 5432, host: 'spendwise-postgres-db' }, () => {
    client.end();
    process.exit(0);
  });
  client.on('error', () => {
    process.exit(1);
  });
  setTimeout(() => process.exit(1), 1000);
"; do
  sleep 1
done
echo "Database is ready!"

echo "Running Prisma migrations..."
# Run migrations using the generated prisma client
npx prisma migrate deploy

echo "Seeding database..."
npx prisma db seed

echo "Starting application..."
# Execute the container's main process (CMD)
exec "$@"
