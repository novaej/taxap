-- AlterTable
ALTER TABLE "classification_events" ADD COLUMN     "ai_confidence" DECIMAL(3,2),
ADD COLUMN     "ai_reasoning" TEXT;
