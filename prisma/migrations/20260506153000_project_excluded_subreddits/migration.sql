ALTER TABLE "Project"
ADD COLUMN "excludedSubreddits" TEXT[] DEFAULT ARRAY[]::TEXT[];

UPDATE "Project"
SET "excludedSubreddits" = ARRAY[]::TEXT[]
WHERE "excludedSubreddits" IS NULL;

ALTER TABLE "Project"
ALTER COLUMN "excludedSubreddits" SET NOT NULL;
