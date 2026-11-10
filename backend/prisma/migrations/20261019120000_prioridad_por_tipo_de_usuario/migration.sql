ALTER TABLE "User"
ADD COLUMN "isAnonymous" BOOLEAN NOT NULL DEFAULT false;

UPDATE "User"
SET "isAnonymous" = true
WHERE "email" LIKE 'anon-%@anonymous.local';

CREATE INDEX "Report_priority_idx" ON "Report"("priority");