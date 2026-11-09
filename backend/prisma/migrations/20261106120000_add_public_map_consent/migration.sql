ALTER TABLE "Report"
ADD COLUMN "publicMapConsent" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Report_status_publicMapConsent_archivedAt_updatedAt_idx"
ON "Report"("status", "publicMapConsent", "archivedAt", "updatedAt");
