ALTER TABLE "User"
ADD COLUMN "anonymousIpHash" TEXT;

ALTER TABLE "User"
ALTER COLUMN "passwordHash" DROP NOT NULL;

ALTER TABLE "Report"
ADD COLUMN "reporterIpHash" TEXT;

CREATE INDEX "User_anonymousIpHash_createdAt_idx"
ON "User"("anonymousIpHash", "createdAt");

CREATE INDEX "User_isAnonymous_createdAt_idx"
ON "User"("isAnonymous", "createdAt");

CREATE INDEX "Report_reporterIpHash_createdAt_idx"
ON "Report"("reporterIpHash", "createdAt");
