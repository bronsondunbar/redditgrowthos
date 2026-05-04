/*
  Warnings:

  - A unique constraint covering the columns `[projectId,redditId]` on the table `Opportunity` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[projectId,term]` on the table `TrackedKeyword` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Opportunity_userId_redditId_key";

-- DropIndex
DROP INDEX "TrackedKeyword_userId_term_key";

-- AlterTable
ALTER TABLE "Opportunity" ADD COLUMN     "projectId" TEXT;

-- AlterTable
ALTER TABLE "TrackedKeyword" ADD COLUMN     "projectId" TEXT;

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "websiteUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Project_userId_updatedAt_idx" ON "Project"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "Opportunity_projectId_status_idx" ON "Opportunity"("projectId", "status");

-- CreateIndex
CREATE INDEX "Opportunity_projectId_subreddit_idx" ON "Opportunity"("projectId", "subreddit");

-- CreateIndex
CREATE UNIQUE INDEX "Opportunity_projectId_redditId_key" ON "Opportunity"("projectId", "redditId");

-- CreateIndex
CREATE INDEX "TrackedKeyword_projectId_idx" ON "TrackedKeyword"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "TrackedKeyword_projectId_term_key" ON "TrackedKeyword"("projectId", "term");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackedKeyword" ADD CONSTRAINT "TrackedKeyword_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
