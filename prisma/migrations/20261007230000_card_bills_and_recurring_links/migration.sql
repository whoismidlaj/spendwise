-- AlterTable
ALTER TABLE "PaymentPlan" ADD COLUMN     "endDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PaymentPlanOccurrence" ADD COLUMN     "transactionId" TEXT;

-- CreateTable
CREATE TABLE "CardBill" (
    "id" TEXT NOT NULL,
    "creditCardId" TEXT NOT NULL,
    "statementDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3) NOT NULL,
    "statementAmount" DECIMAL(15,2) NOT NULL,
    "minimumDue" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "paidAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardPayment" (
    "id" TEXT NOT NULL,
    "creditCardId" TEXT NOT NULL,
    "cardBillId" TEXT,
    "amount" DECIMAL(15,2) NOT NULL,
    "paidDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accountId" TEXT,
    "transactionId" TEXT,
    "usedDelta" DECIMAL(15,2) NOT NULL,
    "dueDelta" DECIMAL(15,2) NOT NULL,
    "minimumDelta" DECIMAL(15,2) NOT NULL,
    "expectedDelta" DECIMAL(15,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CardBill_creditCardId_dueDate_key" ON "CardBill"("creditCardId", "dueDate");

-- AddForeignKey
ALTER TABLE "CardBill" ADD CONSTRAINT "CardBill_creditCardId_fkey" FOREIGN KEY ("creditCardId") REFERENCES "CreditCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardPayment" ADD CONSTRAINT "CardPayment_creditCardId_fkey" FOREIGN KEY ("creditCardId") REFERENCES "CreditCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardPayment" ADD CONSTRAINT "CardPayment_cardBillId_fkey" FOREIGN KEY ("cardBillId") REFERENCES "CardBill"("id") ON DELETE SET NULL ON UPDATE CASCADE;
