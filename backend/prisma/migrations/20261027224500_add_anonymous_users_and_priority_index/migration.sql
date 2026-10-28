ALTER TABLE "User"
ADD COLUMN "isAnonymous" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Report_priority_idx" ON "Report"("priority");
