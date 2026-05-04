-- CreateEnum
CREATE TYPE "OpportunityStatus" AS ENUM ('NEW', 'SAVED', 'REPLIED', 'DISMISSED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "productName" TEXT,
    "productDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackedKeyword" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackedKeyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "redditId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "subreddit" TEXT NOT NULL,
    "author" TEXT,
    "permalink" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "commentsCount" INTEGER NOT NULL DEFAULT 0,
    "intentScore" INTEGER NOT NULL DEFAULT 0,
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "status" "OpportunityStatus" NOT NULL DEFAULT 'NEW',
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");

-- CreateIndex
CREATE INDEX "TrackedKeyword_userId_idx" ON "TrackedKeyword"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TrackedKeyword_userId_term_key" ON "TrackedKeyword"("userId", "term");

-- CreateIndex
CREATE INDEX "Opportunity_userId_status_idx" ON "Opportunity"("userId", "status");

-- CreateIndex
CREATE INDEX "Opportunity_userId_subreddit_idx" ON "Opportunity"("userId", "subreddit");

-- CreateIndex
CREATE UNIQUE INDEX "Opportunity_userId_redditId_key" ON "Opportunity"("userId", "redditId");

-- AddForeignKey
ALTER TABLE "TrackedKeyword" ADD CONSTRAINT "TrackedKeyword_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
