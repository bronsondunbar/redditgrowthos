-- CreateTable
CREATE TABLE "DailyActionCompletion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "actionDate" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyActionCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyActionCompletion_projectId_actionId_actionDate_key" ON "DailyActionCompletion"("projectId", "actionId", "actionDate");

-- CreateIndex
CREATE INDEX "DailyActionCompletion_userId_projectId_actionDate_idx" ON "DailyActionCompletion"("userId", "projectId", "actionDate");

-- AddForeignKey
ALTER TABLE "DailyActionCompletion" ADD CONSTRAINT "DailyActionCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyActionCompletion" ADD CONSTRAINT "DailyActionCompletion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
