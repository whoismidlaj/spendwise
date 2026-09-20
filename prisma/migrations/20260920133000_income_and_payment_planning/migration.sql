CREATE TYPE "IncomeType" AS ENUM ('SALARY', 'FREELANCE', 'RENTAL', 'INTEREST', 'OTHER');
CREATE TYPE "IncomeFrequency" AS ENUM ('MONTHLY', 'WEEKLY', 'ONE_TIME');
CREATE TYPE "IncomeStatus" AS ENUM ('EXPECTED', 'RECEIVED', 'SKIPPED');
CREATE TYPE "PaymentPlanType" AS ENUM ('RENT', 'UTILITY', 'SUBSCRIPTION', 'INSURANCE', 'FAMILY', 'SAVINGS', 'OTHER');
ALTER TABLE "User" ADD COLUMN "cashBuffer" DECIMAL(15,2) NOT NULL DEFAULT 0;

CREATE TABLE "IncomeSource" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "accountId" TEXT,
  "name" TEXT NOT NULL,
  "type" "IncomeType" NOT NULL DEFAULT 'SALARY',
  "frequency" "IncomeFrequency" NOT NULL DEFAULT 'MONTHLY',
  "payday" INTEGER,
  "grossAmount" DECIMAL(15,2),
  "expectedInHand" DECIMAL(15,2) NOT NULL,
  "defaultDeductions" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IncomeSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IncomeOccurrence" (
  "id" TEXT NOT NULL,
  "incomeSourceId" TEXT NOT NULL,
  "expectedDate" TIMESTAMP(3) NOT NULL,
  "expectedAmount" DECIMAL(15,2) NOT NULL,
  "actualAmount" DECIMAL(15,2),
  "receivedAt" TIMESTAMP(3),
  "status" "IncomeStatus" NOT NULL DEFAULT 'EXPECTED',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IncomeOccurrence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentPlan" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "accountId" TEXT,
  "name" TEXT NOT NULL,
  "type" "PaymentPlanType" NOT NULL DEFAULT 'OTHER',
  "amount" DECIMAL(15,2) NOT NULL,
  "dueDay" INTEGER NOT NULL,
  "isEssential" BOOLEAN NOT NULL DEFAULT true,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentPlanOccurrence" (
  "id" TEXT NOT NULL,
  "paymentPlanId" TEXT NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "amount" DECIMAL(15,2) NOT NULL,
  "paidAt" TIMESTAMP(3),
  "accountId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentPlanOccurrence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IncomeOccurrence_incomeSourceId_expectedDate_key" ON "IncomeOccurrence"("incomeSourceId", "expectedDate");
CREATE UNIQUE INDEX "PaymentPlanOccurrence_paymentPlanId_dueDate_key" ON "PaymentPlanOccurrence"("paymentPlanId", "dueDate");
ALTER TABLE "IncomeSource" ADD CONSTRAINT "IncomeSource_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IncomeSource" ADD CONSTRAINT "IncomeSource_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IncomeOccurrence" ADD CONSTRAINT "IncomeOccurrence_incomeSourceId_fkey" FOREIGN KEY ("incomeSourceId") REFERENCES "IncomeSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentPlan" ADD CONSTRAINT "PaymentPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentPlan" ADD CONSTRAINT "PaymentPlan_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentPlanOccurrence" ADD CONSTRAINT "PaymentPlanOccurrence_paymentPlanId_fkey" FOREIGN KEY ("paymentPlanId") REFERENCES "PaymentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
