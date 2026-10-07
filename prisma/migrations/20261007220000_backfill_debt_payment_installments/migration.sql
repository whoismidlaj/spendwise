-- Link legacy payments to lender-schedule installments by due month.
-- Only the first payment per debt and month is linked so the unique index cannot fail.
WITH matches AS (
  SELECT p."id" AS payment_id,
         (item.value->>'number')::int AS number,
         (item.value->>'dueDate')::date AS due_date,
         row_number() OVER (PARTITION BY p."debtId", (item.value->>'number') ORDER BY p."paidDate") AS rank_for_installment
  FROM "DebtPayment" p
  JOIN "Debt" d ON d."id" = p."debtId" AND d."installmentSchedule" IS NOT NULL AND jsonb_typeof(d."installmentSchedule") = 'array'
  CROSS JOIN LATERAL jsonb_array_elements(d."installmentSchedule") AS item(value)
  WHERE p."installmentNumber" IS NULL
    AND item.value ? 'number'
    AND to_char((item.value->>'dueDate')::date, 'YYYY-MM') = to_char(p."paidDate", 'YYYY-MM')
), unique_matches AS (
  SELECT payment_id, number, due_date FROM matches WHERE rank_for_installment = 1
)
UPDATE "DebtPayment" p
SET "installmentNumber" = m.number, "scheduledDueDate" = m.due_date
FROM unique_matches m
WHERE p."id" = m.payment_id;
