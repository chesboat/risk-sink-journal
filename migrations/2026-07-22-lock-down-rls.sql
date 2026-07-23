-- ═══════════════════════════════════════════════════
-- MIGRATION: Lock down row-level security (2026-07-22)
--
-- Before this migration every table's policy was USING (true) —
-- i.e. anyone with the public anon key (it ships in the app bundle)
-- could read, modify, or delete EVERY user's data. These policies
-- restrict each row to its owner via auth.uid().
--
-- HOW TO RUN: Supabase Dashboard → SQL Editor → New query →
-- paste this whole file → Run. Idempotent: safe to re-run.
--
-- Sanity check BEFORE running (should return 0 — rows with no owner
-- would become invisible to everyone once policies apply):
--   SELECT count(*) FROM trades WHERE user_id IS NULL;
--   SELECT count(*) FROM config WHERE user_id IS NULL;
-- ═══════════════════════════════════════════════════

-- trades
DROP POLICY IF EXISTS "Allow all on trades" ON trades;
DROP POLICY IF EXISTS "Owner only on trades" ON trades;
CREATE POLICY "Owner only on trades" ON trades
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- config
DROP POLICY IF EXISTS "Allow all on config" ON config;
DROP POLICY IF EXISTS "Owner only on config" ON config;
CREATE POLICY "Owner only on config" ON config
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- bot_trades
DROP POLICY IF EXISTS "Allow all on bot_trades" ON bot_trades;
DROP POLICY IF EXISTS "Owner only on bot_trades" ON bot_trades;
CREATE POLICY "Owner only on bot_trades" ON bot_trades
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- bot_strategy_assignments
DROP POLICY IF EXISTS "Allow all on bot_strategy_assignments" ON bot_strategy_assignments;
DROP POLICY IF EXISTS "Owner only on bot_strategy_assignments" ON bot_strategy_assignments;
CREATE POLICY "Owner only on bot_strategy_assignments" ON bot_strategy_assignments
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Tighten ownership columns: rows must always have an owner.
-- (The app has always written user_id, so this should succeed;
-- if it errors, run the sanity-check SELECTs above to find strays.)
ALTER TABLE trades ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE config ALTER COLUMN user_id SET NOT NULL;

-- Verify: this should list exactly one "Owner only" policy per table.
SELECT tablename, policyname FROM pg_policies
WHERE tablename IN ('trades', 'config', 'bot_trades', 'bot_strategy_assignments')
ORDER BY tablename;
