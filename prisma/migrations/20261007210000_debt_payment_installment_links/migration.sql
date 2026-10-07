ALTER TABLE "DebtPayment" ADD COLUMN "interestAmount" DECIMAL(15,2),
ADD COLUMN "installmentNumber" INTEGER,
ADD COLUMN "scheduledDueDate" TIMESTAMP(3),
ADD COLUMN "transactionId" TEXT;

-- NULL installment numbers (ad-hoc and legacy payments) never conflict in PostgreSQL.
CREATE UNIQUE INDEX "DebtPayment_debtId_installmentNumber_key" ON "DebtPayment"("debtId", "installmentNumber");

-- Legacy payments: interest is whatever part of the payment was not principal.
UPDATE "DebtPayment" SET "interestAmount" = "amount" - "principalAmount" WHERE "principalAmount" IS NOT NULL;
