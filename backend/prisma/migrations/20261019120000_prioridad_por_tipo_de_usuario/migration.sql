ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "isAnonymous" BOOLEAN NOT NULL DEFAULT false;

UPDATE "User"
SET "isAnonymous" = true
WHERE "email" LIKE 'anon-%@anonymous.local';

CREATE INDEX IF NOT EXISTS "Report_priority_idx" ON "Report"("priority");