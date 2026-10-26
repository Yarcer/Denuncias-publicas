ALTER TYPE "Role" ADD VALUE 'SUPERADMINISTRADOR';

ALTER TABLE "User"
ADD COLUMN "managedReportType" "ReportType";

UPDATE "User"
SET "managedReportType" = CASE
  WHEN "entityName" ~* '(municipalidad|urbano|infraestructura|tránsito|transito|limpieza)' THEN 'URBANO'::"ReportType"
  WHEN "entityName" ~* 'bombero' THEN 'BOMBEROS'::"ReportType"
  WHEN "entityName" ~* '(policía|policia|policial)' THEN 'POLICIAL'::"ReportType"
  ELSE NULL
END
WHERE "role" = 'ENTE_PUBLICO';