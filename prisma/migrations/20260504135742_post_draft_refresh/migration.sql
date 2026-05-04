-- CreateTable
CREATE TABLE "PostDraft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "actionKey" TEXT NOT NULL,
    "subreddit" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "rules" TEXT[],
    "reviewVerdict" TEXT NOT NULL,
    "reviewSummary" TEXT NOT NULL,
    "reviewIssues" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PostDraft_userId_projectId_idx" ON "PostDraft"("userId", "projectId");

-- CreateIndex
CREATE INDEX "PostDraft_projectId_updatedAt_idx" ON "PostDraft"("projectId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PostDraft_projectId_actionKey_key" ON "PostDraft"("projectId", "actionKey");

-- AddForeignKey
ALTER TABLE "PostDraft" ADD CONSTRAINT "PostDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostDraft" ADD CONSTRAINT "PostDraft_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
