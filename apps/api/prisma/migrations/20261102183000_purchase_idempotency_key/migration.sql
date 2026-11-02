-- AlterTable
ALTER TABLE "purchases" ADD COLUMN     "idempotency_key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "purchases_user_id_idempotency_key_key" ON "purchases"("user_id", "idempotency_key");
