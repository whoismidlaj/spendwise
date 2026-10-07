# Migration checklist and rollback

Before deploying a migration that changes financial records (`Debt`, `DebtPayment`, `Account`, ledger):

1. Download a Spendwise backup from Settings and keep it with the release notes.
2. Snapshot the database: `pg_dump -U <user> <db> > pre-<migration>.sql`.
3. Run `npm test` against a copy of production data (backup round-trip must pass).
4. Deploy. `docker-entrypoint.sh` runs `prisma migrate deploy`; if it fails the container exits and the new app never starts.

Rollback: stop the app, restore the snapshot (`psql <db> < pre-<migration>.sql` into a fresh database), then redeploy the previous image. Prisma migrations are forward-only, so never edit an applied migration; add a new one.

Seeding is opt-in: it only runs when `SEED_DATABASE=true`.

## When a migration fails

`docker-entrypoint.sh` runs with `set -e`, so a failed `prisma migrate deploy` stops the container before the new app starts; the previous release keeps serving if it is still running.

1. Read the failure: `docker logs <web container>` shows which migration failed and why.
2. If the migration was applied partially, Prisma marks it failed. Restore the pre-migration snapshot (above) rather than hand-editing `_prisma_migrations`.
3. Fix the migration in a new commit (never edit one that has been applied anywhere), take a fresh snapshot, redeploy.
4. Only as a last resort for a migration that is known to be safe to retry: `npx prisma migrate resolve --rolled-back <migration_name>` and redeploy.

## Health checks

`GET /api/health` returns `200 {"status":"ok","database":"ok"}` when the app can reach PostgreSQL and `503` otherwise. `docker-compose.yml` uses it for the web container and `pg_isready` for the database; the web container only starts once the database is healthy.

## Tests

- `npm test` runs the integration tests (they use the database in `DATABASE_URL` with temporary users that are removed afterwards) and the pure unit tests in `tests/unit`.
- `cd e2e && npm install && npx playwright test` runs the browser tests (navigation, money flows, restore, accessibility, 320px and desktop layouts). They start `npm run dev` on port 3100 unless `E2E_PORT` points at a running server; set `E2E_APP_DIR` to run a different checkout.
- Set `SPENDWISE_FAKE_NOW=2026-10-07T10:00:00` (non-production only) to pin the server clock.
