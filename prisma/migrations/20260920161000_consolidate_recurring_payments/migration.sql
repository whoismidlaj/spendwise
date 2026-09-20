-- Move loan-like recurring entries into the single Loans & Lending model.
INSERT INTO "Debt" (
  "id", "userId", "name", "direction", "type", "amount", "remaining",
  "interestRate", "isRecurring", "paymentDate", "paymentAmount",
  "totalInstallments", "startDate", "priority", "description", "isActive",
  "createdAt", "updatedAt"
)
SELECT
  recurring."id",
  recurring."userId",
  recurring."name",
  'BORROWED',
  'LOAN',
  COALESCE(recurring."loanAmount", recurring."emiAmount" * GREATEST(COALESCE(recurring."totalEMIs", 1), 1)),
  CASE
    WHEN recurring."loanAmount" IS NOT NULL AND recurring."totalEMIs" IS NOT NULL AND recurring."totalEMIs" > 0
      THEN ROUND(recurring."loanAmount" * GREATEST(recurring."totalEMIs" - recurring."paidEMIs", 0) / recurring."totalEMIs", 2)
    ELSE GREATEST(COALESCE(recurring."loanAmount", recurring."emiAmount") - recurring."emiAmount" * recurring."paidEMIs", 0)
  END,
  COALESCE(recurring."interestRate", 0),
  true,
  recurring."emiDate",
  recurring."emiAmount",
  recurring."totalEMIs",
  recurring."startDate",
  'MEDIUM',
  'Moved from the former Recurring Payments screen',
  recurring."isActive",
  recurring."createdAt",
  NOW()
FROM "RecurringExpense" recurring
WHERE recurring."type" IN ('EMI', 'LOAN')
ON CONFLICT ("id") DO NOTHING;

-- Keep every recorded loan payment and its original date.
INSERT INTO "DebtPayment" ("id", "debtId", "amount", "paidDate", "accountId")
SELECT payment."id", payment."recurringExpenseId", payment."amount", payment."paidDate", recurring."accountId"
FROM "EMIPayment" payment
JOIN "RecurringExpense" recurring ON recurring."id" = payment."recurringExpenseId"
WHERE recurring."type" IN ('EMI', 'LOAN')
ON CONFLICT ("id") DO NOTHING;

-- Preserve legacy paid-installment counts even when older versions did not create payment rows.
INSERT INTO "DebtPayment" ("id", "debtId", "amount", "paidDate", "accountId")
SELECT
  recurring."id" || '-legacy-' || series."number",
  recurring."id",
  recurring."emiAmount",
  recurring."startDate" + ((actual."count" + series."number" - 1) * INTERVAL '1 month'),
  recurring."accountId"
FROM "RecurringExpense" recurring
CROSS JOIN LATERAL (
  SELECT COUNT(*)::integer AS "count"
  FROM "EMIPayment" payment
  WHERE payment."recurringExpenseId" = recurring."id"
) actual
CROSS JOIN LATERAL generate_series(1, GREATEST(recurring."paidEMIs" - actual."count", 0)) AS series("number")
WHERE recurring."type" IN ('EMI', 'LOAN');

-- Move rent, utilities, subscriptions and other regular bills into Bills.
INSERT INTO "PaymentPlan" (
  "id", "userId", "accountId", "name", "type", "amount", "dueDay",
  "isEssential", "isActive", "startDate", "notes", "createdAt", "updatedAt"
)
SELECT
  recurring."id",
  recurring."userId",
  recurring."accountId",
  recurring."name",
  CASE recurring."type"
    WHEN 'RENT' THEN 'RENT'::"PaymentPlanType"
    WHEN 'UTILITY' THEN 'UTILITY'::"PaymentPlanType"
    WHEN 'SUBSCRIPTION' THEN 'SUBSCRIPTION'::"PaymentPlanType"
    ELSE 'OTHER'::"PaymentPlanType"
  END,
  recurring."emiAmount",
  recurring."emiDate",
  true,
  recurring."isActive",
  recurring."startDate",
  'Moved from the former Recurring Payments screen',
  recurring."createdAt",
  NOW()
FROM "RecurringExpense" recurring
WHERE recurring."type" NOT IN ('EMI', 'LOAN')
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "PaymentPlanOccurrence" (
  "id", "paymentPlanId", "dueDate", "amount", "paidAt", "accountId", "createdAt"
)
SELECT
  payment."id",
  payment."recurringExpenseId",
  payment."paidDate",
  payment."amount",
  payment."paidDate",
  recurring."accountId",
  payment."paidDate"
FROM "EMIPayment" payment
JOIN "RecurringExpense" recurring ON recurring."id" = payment."recurringExpenseId"
WHERE recurring."type" NOT IN ('EMI', 'LOAN')
ON CONFLICT ("paymentPlanId", "dueDate") DO NOTHING;

DROP TABLE "EMIPayment";
DROP TABLE "RecurringExpense";
DROP TYPE "RecurringType";
