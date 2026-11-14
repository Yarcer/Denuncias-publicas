ALTER TABLE "Report"
ADD COLUMN "emailNotifications" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "emailNotificationsResolvedOnly" BOOLEAN NOT NULL DEFAULT false;
