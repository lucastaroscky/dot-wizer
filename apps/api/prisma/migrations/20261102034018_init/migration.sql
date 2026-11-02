-- CreateEnum
CREATE TYPE "wallet_entry_type" AS ENUM ('PURCHASE', 'DAILY_BONUS', 'ROUND_PAYMENT', 'DEFICIT_OFFSET', 'WIN_BONUS');

-- CreateEnum
CREATE TYPE "purchase_status" AS ENUM ('PENDING', 'PAID');

-- CreateEnum
CREATE TYPE "payment_provider" AS ENUM ('TEST');

-- CreateEnum
CREATE TYPE "match_status" AS ENUM ('IN_PROGRESS', 'FINISHED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "birth_date" DATE,
    "photo_path" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "provider" "payment_provider" NOT NULL,
    "status" "purchase_status" NOT NULL DEFAULT 'PENDING',
    "provider_transaction_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMPTZ(6),

    CONSTRAINT "purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "table_id" INTEGER NOT NULL,
    "point_value" INTEGER NOT NULL,
    "status" "match_status" NOT NULL DEFAULT 'IN_PROGRESS',
    "winner_id" UUID,
    "last_round" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(6),

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_players" (
    "match_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "start_balance" INTEGER NOT NULL,
    "result" INTEGER NOT NULL DEFAULT 0,
    "deficit" INTEGER NOT NULL DEFAULT 0,
    "win_bonus" INTEGER NOT NULL DEFAULT 0,
    "final_balance" INTEGER,

    CONSTRAINT "match_players_pkey" PRIMARY KEY ("match_id","user_id")
);

-- CreateTable
CREATE TABLE "wallet_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "from_account" TEXT NOT NULL,
    "to_account" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" "wallet_entry_type" NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "match_id" UUID,
    "round_number" INTEGER,
    "purchase_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "purchases_user_id_idx" ON "purchases"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchases_provider_provider_transaction_id_key" ON "purchases"("provider", "provider_transaction_id");

-- CreateIndex
CREATE INDEX "match_players_user_id_idx" ON "match_players"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_entries_idempotency_key_key" ON "wallet_entries"("idempotency_key");

-- CreateIndex
CREATE INDEX "wallet_entries_from_account_created_at_idx" ON "wallet_entries"("from_account", "created_at");

-- CreateIndex
CREATE INDEX "wallet_entries_to_account_created_at_idx" ON "wallet_entries"("to_account", "created_at");

-- CreateIndex
CREATE INDEX "wallet_entries_match_id_idx" ON "wallet_entries"("match_id");

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_entries" ADD CONSTRAINT "wallet_entries_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_entries" ADD CONSTRAINT "wallet_entries_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wallet_entries"
  ADD CONSTRAINT "wallet_entries_amount_positive" CHECK ("amount" > 0),
  ADD CONSTRAINT "wallet_entries_distinct_accounts" CHECK ("from_account" <> "to_account");

CREATE FUNCTION "reject_wallet_entry_change"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'wallet_entries are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "wallet_entries_immutable"
  BEFORE UPDATE OR DELETE ON "wallet_entries"
  FOR EACH ROW EXECUTE FUNCTION "reject_wallet_entry_change"();
