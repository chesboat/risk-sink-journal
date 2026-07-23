-- ═══════════════════════════════════════════════════
-- MIGRATION: account-scoped bot-trade idempotency (2026-07-22)
--
-- Broker order ids are only unique WITHIN an account. The old unique key
-- (user_id, source, external_id) meant importing a second account's CSV
-- could silently overwrite the first account's rows. Adds account_id to
-- the key, and lets `side` be NULL for exports with no side column.
--
-- Safe to run any time (bot_trades is empty at time of writing).
-- HOW TO RUN: Supabase Dashboard → SQL Editor → paste → Run.
-- ═══════════════════════════════════════════════════

ALTER TABLE bot_trades ALTER COLUMN side DROP NOT NULL;
ALTER TABLE bot_trades DROP CONSTRAINT IF EXISTS bot_trades_user_id_source_external_id_key;
ALTER TABLE bot_trades DROP CONSTRAINT IF EXISTS bot_trades_user_source_external_account_key;
ALTER TABLE bot_trades ADD CONSTRAINT bot_trades_user_source_external_account_key
  UNIQUE (user_id, source, external_id, account_id);
