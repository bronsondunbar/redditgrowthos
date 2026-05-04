-- AlterTable
ALTER TABLE "Opportunity" ADD COLUMN     "replyDraft" TEXT,
ADD COLUMN     "replySoftPromotionScore" INTEGER NOT NULL DEFAULT 0;
