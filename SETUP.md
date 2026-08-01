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

**Using Docker for PostgreSQL:**
```bash
docker run -d \
  --name spendwise-db \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=spendwise \
  -p 5432:5432 \
  postgres:15
```
Then set: `DATABASE_URL="postgresql://postgres:password@localhost:5432/spendwise"`

### 3. Set up the database
```bash
npx prisma migrate dev --name init
npx prisma db seed
```

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
- 3 recurring expenses (Home Loan EMI, Netflix, Car Loan EMI)
- 20 sample transactions over 3 months
- All default expense and income categories

---

## Install as PWA
- **Mobile Chrome:** tap browser menu → "Add to Home Screen"
- **iOS Safari:** tap Share → "Add to Home Screen"
- **Desktop Chrome:** click the install icon in the address bar

---

## Tech Stack
- **Framework:** Next.js 14 (App Router, TypeScript)
- **Database:** PostgreSQL + Prisma ORM
- **Auth:** NextAuth.js v4 (email/password with JWT)
- **Styling:** Tailwind CSS v3 with custom color palette
- **Charts:** Recharts
- **Forms:** React Hook Form + Zod
- **PWA:** next-pwa
- **Icons:** Lucide React

---

## Project Structure
```
app/
  (auth)/login, register    — Auth pages
  (app)/dashboard           — Dashboard with balance, cards, recent txns
  (app)/accounts            — Bank accounts + credit cards management
  (app)/transactions        — Full transaction list with filters
  (app)/expenses            — Expense analysis + recurring EMIs
  (app)/reports             — Charts: trends, categories, export CSV
  settings/                 — Profile, password, categories, currency
  api/                      — All REST API routes
components/
  ui/                       — Button, Input, Select, Sheet, Badge, Card, FAB
  layout/                   — TopBar
  transactions/             — TransactionForm
lib/
  prisma.ts                 — Prisma singleton + Decimal toJson helper
  auth.ts                   — NextAuth config
  currency.ts               — formatCurrency, remainingPrincipal
prisma/
  schema.prisma             — Full database schema
  seed.ts                   — Demo data seed
```
