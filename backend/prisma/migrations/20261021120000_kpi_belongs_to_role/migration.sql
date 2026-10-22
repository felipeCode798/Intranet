-- Los KPI pasan de colgar de la tarea a colgar del rol.
-- Los KPI existentes se conservan: heredan el rol de la tarea a la que estaban atados.

-- DropForeignKey
ALTER TABLE "Kpi" DROP CONSTRAINT "Kpi_taskId_fkey";

-- DropIndex
DROP INDEX "Kpi_taskId_idx";

-- AlterTable
ALTER TABLE "Kpi" ADD COLUMN "roleId" TEXT;

-- Backfill
UPDATE "Kpi" SET "roleId" = "RoleTask"."roleId" FROM "RoleTask" WHERE "RoleTask"."id" = "Kpi"."taskId";

-- AlterTable
ALTER TABLE "Kpi" ALTER COLUMN "roleId" SET NOT NULL;
ALTER TABLE "Kpi" DROP COLUMN "taskId";

-- CreateIndex
CREATE INDEX "Kpi_roleId_idx" ON "Kpi"("roleId");

-- AddForeignKey
ALTER TABLE "Kpi" ADD CONSTRAINT "Kpi_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "JobRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
