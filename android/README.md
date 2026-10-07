# Spendwise Android app

This is the Phase 1 native Android client. It is a read-only companion: login, account balances and recent balance activity. Spendwise is a monthly obligation planner, so the mobile app intentionally cannot create expenses or transactions.

## Local development

1. Start the Spendwise web server from the repository root with `npm run dev`.
2. From the repository root, apply the Prisma migration with `npx prisma migrate deploy`.
3. Open `android/` in Android Studio and run the `app` configuration on an emulator.

Repository checks also run from the root directory, not from `android/`:

```bash
cd ..
npx prisma generate
npx tsc --noEmit
git diff --check
```

For a physical device connected with wireless debugging, forward the backend port before launching:

```bash
adb reverse tcp:3000 tcp:3000
```

The app then reaches the host through `http://127.0.0.1:3000`. The manifest allows cleartext HTTP for local development only; use HTTPS and a release-specific API URL before publishing.
