UPDATE "Account"
SET "institution" = CASE
  WHEN lower("name") LIKE '%hdfc%' THEN 'HDFC_BANK'
  WHEN lower("name") LIKE '%federal%' THEN 'FEDERAL_BANK'
  WHEN lower("name") LIKE '%jupiter%' THEN 'JUPITER'
  WHEN lower("name") LIKE '%canara%' THEN 'CANARA_BANK'
  ELSE "institution"
END
WHERE "institution" = 'OTHER';

UPDATE "CreditCard"
SET "institution" = CASE
  WHEN lower("bank" || ' ' || "name") LIKE '%amazon%' THEN 'AMAZON_PAY_LATER'
  WHEN lower("bank" || ' ' || "name") LIKE '%jupiter%' THEN 'JUPITER_CSB_CARD'
  WHEN lower("bank" || ' ' || "name") LIKE '%sbi%' THEN 'SBI_CARD'
  WHEN lower("bank" || ' ' || "name") LIKE '%hdfc%' THEN 'HDFC_CARD'
  ELSE "institution"
END
WHERE "institution" = 'OTHER';
