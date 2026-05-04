-- CreateTable
CREATE TABLE "TrackedPost" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "redditId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subreddit" TEXT NOT NULL,
    "author" TEXT,
    "permalink" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "commentsCount" INTEGER NOT NULL DEFAULT 0,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackedPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrackedPost_userId_projectId_idx" ON "TrackedPost"("userId", "projectId");

-- CreateIndex
CREATE INDEX "TrackedPost_projectId_lastSyncedAt_idx" ON "TrackedPost"("projectId", "lastSyncedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TrackedPost_projectId_redditId_key" ON "TrackedPost"("projectId", "redditId");

-- AddForeignKey
ALTER TABLE "TrackedPost" ADD CONSTRAINT "TrackedPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackedPost" ADD CONSTRAINT "TrackedPost_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
