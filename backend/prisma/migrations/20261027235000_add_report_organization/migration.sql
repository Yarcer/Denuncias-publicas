ALTER TABLE "Report" ADD COLUMN "entityName" TEXT;

CREATE INDEX "Report_entityName_idx" ON "Report"("entityName");
