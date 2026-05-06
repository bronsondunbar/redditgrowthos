ALTER TABLE "User"
ADD COLUMN "excludedSubreddits" TEXT[] DEFAULT ARRAY[]::TEXT[];

UPDATE "User" AS "user"
SET "excludedSubreddits" = COALESCE(
  ARRAY(
    SELECT DISTINCT regexp_replace(subreddit, '^r/', '', 'i')
    FROM (
      SELECT unnest("project"."excludedSubreddits") AS subreddit
      FROM "Project" AS "project"
      WHERE "project"."userId" = "user"."id"
    ) AS "subreddits"
    WHERE subreddit IS NOT NULL AND btrim(subreddit) <> ''
    ORDER BY 1
  ),
  ARRAY[]::TEXT[]
);

ALTER TABLE "User"
ALTER COLUMN "excludedSubreddits" SET NOT NULL;

ALTER TABLE "Project"
DROP COLUMN "excludedSubreddits";
