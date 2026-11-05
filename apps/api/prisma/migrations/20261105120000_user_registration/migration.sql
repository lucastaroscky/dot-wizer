-- AlterTable
ALTER TABLE "users" RENAME COLUMN "name" TO "nickname";
ALTER TABLE "users" ADD COLUMN     "full_name" TEXT,
ADD COLUMN     "cpf" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "pix_key_registered_at" TIMESTAMPTZ(6),
ADD COLUMN     "deactivated_at" TIMESTAMPTZ(6);

-- CreateIndex
CREATE UNIQUE INDEX "users_cpf_key" ON "users"("cpf");
