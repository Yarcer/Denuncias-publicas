-- CreateEnum
CREATE TYPE "AdministrativeRequestStatus" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA');

-- CreateTable
CREATE TABLE "AdministrativeUserRequest" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "entityName" TEXT NOT NULL,
    "jurisdiction" TEXT,
    "status" "AdministrativeRequestStatus" NOT NULL DEFAULT 'PENDIENTE',
    "requestedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewComment" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdministrativeUserRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdministrativeUserRequest_status_idx" ON "AdministrativeUserRequest"("status");

-- CreateIndex
CREATE INDEX "AdministrativeUserRequest_requestedById_idx" ON "AdministrativeUserRequest"("requestedById");

-- AddForeignKey
ALTER TABLE "AdministrativeUserRequest" ADD CONSTRAINT "AdministrativeUserRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdministrativeUserRequest" ADD CONSTRAINT "AdministrativeUserRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;