ALTER TABLE "memory_snapshots"
ADD COLUMN "chain_transaction_hash" TEXT,
ADD COLUMN "anchored_at" TIMESTAMP(3);
