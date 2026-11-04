UPDATE "Report" AS report
SET "archivedAt" = COALESCE(
    (
        SELECT history."createdAt"
        FROM "ReportHistory" AS history
        WHERE history."reportId" = report."id"
          AND history."toStatus" = report."status"
        ORDER BY history."createdAt" DESC
        LIMIT 1
    ),
    report."resolvedAt",
    report."updatedAt"
)
WHERE report."status" IN ('RESUELTO', 'RECHAZADO')
  AND report."archivedAt" IS NULL;
