import { defineConfig } from 'prisma/config'

// Prisma skips .env loading when a config file exists, so load it here for local development.
try { process.loadEnvFile?.() } catch { /* production passes real environment variables */ }

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node --project tsconfig.seed.json prisma/seed.ts',
  },
})
