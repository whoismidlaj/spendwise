ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_categoryId_fkey";
ALTER TABLE "Transaction" DROP COLUMN "categoryId";
DROP TABLE "Budget";
DROP TABLE "Category";
