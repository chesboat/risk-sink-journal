-- ═══════════════════════════════════════════════════
-- MIGRATION: atomic strategy switch (2026-07-22)
--
-- Switching a bot's strategy is close-active-row + insert-new-row. Done as
-- two client calls, a failure between them left the account with NO active
-- strategy. This function does both in one transaction; the app falls back
-- to the old two-step automatically if the function isn't installed.
--
-- HOW TO RUN: Supabase Dashboard → SQL Editor → paste → Run. Optional but
-- recommended.
-- ═══════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION switch_strategy(
  p_id TEXT,
  p_account_id TEXT,
  p_strategy_name TEXT,
  p_started_at TIMESTAMPTZ,
  p_note TEXT DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER -- runs as the calling user, so RLS still applies
AS $$
BEGIN
  UPDATE bot_strategy_assignments
     SET ended_at = p_started_at
   WHERE user_id = auth.uid()
     AND account_id = p_account_id
     AND ended_at IS NULL;

  INSERT INTO bot_strategy_assignments (id, user_id, account_id, strategy_name, started_at, note)
  VALUES (p_id, auth.uid(), p_account_id, p_strategy_name, p_started_at, p_note);
END;
$$;
