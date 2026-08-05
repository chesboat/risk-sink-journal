-- ═══════════════════════════════════════════════════
-- MIGRATION: query-timeout headroom + faster RLS (2026-08-03)
--
-- Symptom fixed: "canceling statement due to statement timeout" on login,
-- leaving the app empty. The full-journal pull (screenshot-bearing trade
-- rows are megabytes each) could exceed Supabase's default 8s statement
-- timeout on the free tier.
--
-- 1. Raise the API roles' statement timeout.
-- 2. Rewrite RLS policies with (select auth.uid()) so Postgres evaluates
--    the auth check once per query (initPlan) instead of once per row.
--
-- Pairs with the app-side fix that pages the trades pull in small batches.
-- HOW TO RUN: Supabase Dashboard → SQL Editor → paste → Run. Idempotent.
-- ═══════════════════════════════════════════════════

ALTER ROLE authenticated SET statement_timeout = '30s';
ALTER ROLE anon SET statement_timeout = '15s';

DROP POLICY IF EXISTS "Owner only on trades" ON trades;
CREATE POLICY "Owner only on trades" ON trades
  FOR ALL USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Owner only on config" ON config;
CREATE POLICY "Owner only on config" ON config
  FOR ALL USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Owner only on bot_trades" ON bot_trades;
CREATE POLICY "Owner only on bot_trades" ON bot_trades
  FOR ALL USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Owner only on bot_strategy_assignments" ON bot_strategy_assignments;
CREATE POLICY "Owner only on bot_strategy_assignments" ON bot_strategy_assignments
  FOR ALL USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

NOTIFY pgrst, 'reload config';
