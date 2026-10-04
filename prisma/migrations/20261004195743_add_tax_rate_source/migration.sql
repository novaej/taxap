/*
  Warnings:

  - Added the required column `created_by` to the `tax_rates` table without a default value. This is not possible if the table is not empty.
  - Added the required column `source` to the `tax_rates` table without a default value. This is not possible if the table is not empty.
  - Added the required column `verified_at` to the `tax_rates` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "tax_rates" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "created_by" UUID NOT NULL,
ADD COLUMN     "source" TEXT NOT NULL,
ADD COLUMN     "verified_at" DATE NOT NULL;

-- AddForeignKey
ALTER TABLE "tax_rates" ADD CONSTRAINT "tax_rates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
