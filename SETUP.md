# Spendwise — Local Setup

## Requirements
- Node.js 18+
- PostgreSQL 15+ running locally (or Docker)
- pnpm or npm

---

## Steps

### 1. Install dependencies
```bash
pnpm install
# or: npm install
```

### 2. Set up environment
```bash
cp .env.example .env
```

Edit `.env` and set:
```
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/spendwise"
NEXTAUTH_SECRET="any-random-string-at-least-32-chars"
NEXTAUTH_URL="http://localhost:3000"
```

**Using Docker / Podman Compose for Local Setup:**
```bash
# Start PostgreSQL for local development
podman compose -f docker-compose.dev.yml up -d spendwise-postgres-db
# or: docker compose -f docker-compose.dev.yml up -d spendwise-postgres-db

# Or start the full stack (web + database) in containers:
podman compose -f docker-compose.dev.yml up --build
```
Then set: `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/spendwise?schema=public"`

### 3. Set up the database

Starting only the PostgreSQL container creates the database, but does not create
the application tables. Apply the existing migrations before starting the local
app (and again after pulling new migrations):

```bash
npx prisma migrate deploy
npx prisma generate
```

Optionally load the demo account and sample data:

```bash
npx prisma db seed
```

Seeding replaces any existing demo account and its data. The full container stack
runs migrations and seeding automatically through the web container's entrypoint.

If API requests report `P2021` / "table does not exist", check
`npx prisma migrate status` and apply the migrations above. After recreating the
database, sign out of any old session and register or sign in to an account in
the new database.

### 4. Start the app
```bash
pnpm dev
# or: npm run dev
```

Open http://localhost:3000

---

## Demo login
- **Email:** demo@spendwise.app
- **Password:** demo1234

The demo account includes:
- 3 accounts (HDFC Savings, ICICI Current, PhonePe Wallet)
- 2 credit cards (HDFC Millennia, SBI SimplyCLICK)
- 2 installment loans (Home Loan EMI, Car Loan EMI)
- 1 recurring bill (Netflix)

---

## Install as PWA
- **Mobile Chrome:** tap browser menu → "Add to Home Screen"
- **iOS Safari:** tap Share → "Add to Home Screen"
- **Desktop Chrome:** click the install icon in the address bar

---

## Tech Stack
- **Framework:** Next.js 16 (App Router, TypeScript)
- **Database:** PostgreSQL + Prisma ORM
- **Auth:** NextAuth.js v4 (email/password with JWT)
- **Styling:** Tailwind CSS v3 with custom color palette
- **Validation:** Zod
- **PWA:** next-pwa
- **Icons:** Lucide React

---

## Project Structure
```
app/
  (auth)/login, register    — Auth pages
  (app)/dashboard           — This-month and next-month money plans
  (app)/bills               — Rent, utilities, subscriptions and other bills
  (app)/accounts            — Bank accounts + credit cards management
  (app)/debts               — Loans, EMIs, personal debts and lending
  (app)/income              — Expected and received salary or other income
  settings/                 — Profile, safety buffer and JSON backup/restore
  api/                      — APIs for the five planning areas and settings
components/
  ui/                       — Button, Input, Select, Sheet, Badge, Card, FAB
  layout/                   — TopBar
lib/
  prisma.ts                 — Prisma singleton + Decimal toJson helper
  auth.ts                   — NextAuth config
  currency.ts               — currency formatting
prisma/
  schema.prisma             — Full database schema
  seed.ts                   — Demo data seed
```

## Variable card bills and lending

- In **Accounts → Cards**, update current usage when you check the provider app.
  Expected due defaults to outstanding usage; leave the override blank to use that estimate.
  An override is a remaining estimate and decreases as payments are recorded.
- Enter the actual bill remaining, minimum due and current bill due date from
  each statement. New purchases do not change those statement amounts. Use
  **Record Payment** for full or partial payments. The estimate cannot predict
  provider fees, interest or installment schedules.
- The Money Plan shows each dated actual bill once, with its minimum separately.
  Without a current bill date, the due day is interpreted in the current month.
- In **Loans & Lending**, choose **I owe** or **Owed to me**. Adding a record tracks
  an existing balance without changing an account. Repayments debit or credit
  the selected account; principal repayments are transfers rather than income
  or expenses. Settled repayments remain in payment history.
- Managed payments use a private balance ledger so account totals stay
  auditable. The app has no manual transaction or reporting screens.

Database integration checks (use a local development database):
```bash
node --test tests/liabilities.integration.cjs tests/backup.integration.cjs
```
These checks create temporary users and remove their data afterward.

## Money planning workflow

1. In **Income**, add each salary or other regular income source using its
   expected in-hand amount and payday. Gross salary and regular deductions are
   optional reference values.
2. In **Bills**, add fixed recurring payments such as utilities, rent,
   insurance, subscriptions and savings transfers. Existing card statements,
   EMIs, loans and debt repayments are included in the same plan automatically.
3. Set a safety buffer in **Settings**. The **Money Plan** home screen uses
   current account balances, expected income and required payments to calculate
   safe-to-spend and flag any projected shortfall.
4. Record income only when it reaches your account. The expected amount is used
   for future planning; the actual received amount is what changes the balance.
