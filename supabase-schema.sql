-- ═══════════════════════════════════════════════════
-- RISK SINK JOURNAL — Supabase Schema
-- Run in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- Idempotent: safe to re-run.
-- ═══════════════════════════════════════════════════

-- ───────────────────────────────────────────────
-- Manual trades (existing) — one row per idea, JSONB
-- ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trades (
  id TEXT PRIMARY KEY,
  user_id UUID,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trades_user_updated ON trades (user_id, updated_at DESC);

ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on trades" ON trades;
DROP POLICY IF EXISTS "Owner only on trades" ON trades;
CREATE POLICY "Owner only on trades" ON trades
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ───────────────────────────────────────────────
-- Config (existing) — one row per user, accounts + settings as JSONB
-- ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS config (
  user_id UUID PRIMARY KEY,
  accounts JSONB,
  settings JSONB,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on config" ON config;
DROP POLICY IF EXISTS "Owner only on config" ON config;
CREATE POLICY "Owner only on config" ON config
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════
-- Bot-trade ingestion (new)
-- ═══════════════════════════════════════════════════

-- ───────────────────────────────────────────────
-- bot_trades: one row per closed bot position
-- Strategy is NOT denormalized here — it's resolved at read time
-- by looking up bot_strategy_assignments active at exit_ts.
-- (user_id, source, external_id) is the idempotency key: re-running
-- ingestion never duplicates rows.
-- ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bot_trades (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL,
  source TEXT NOT NULL,          -- 'tradovate' | 'topstepx' | 'manual'
  external_id TEXT NOT NULL,     -- broker's trade/order ID
  account_id TEXT NOT NULL,      -- references config.accounts[].id (loose, jsonb-resident)
  broker TEXT,                   -- 'tradovate' | 'topstepx' (platform that hosts the account)
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,            -- 'long' | 'short'
  qty NUMERIC NOT NULL,
  entry_ts TIMESTAMPTZ NOT NULL,
  exit_ts TIMESTAMPTZ NOT NULL,
  entry_price NUMERIC,
  exit_price NUMERIC,
  pnl NUMERIC NOT NULL DEFAULT 0,
  fees NUMERIC NOT NULL DEFAULT 0,
  raw_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, source, external_id)
);

CREATE INDEX IF NOT EXISTS idx_bot_trades_user_exit ON bot_trades (user_id, exit_ts DESC);
CREATE INDEX IF NOT EXISTS idx_bot_trades_user_account ON bot_trades (user_id, account_id);

ALTER TABLE bot_trades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on bot_trades" ON bot_trades;
DROP POLICY IF EXISTS "Owner only on bot_trades" ON bot_trades;
CREATE POLICY "Owner only on bot_trades" ON bot_trades
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ───────────────────────────────────────────────
-- bot_strategy_assignments: timeline of which strategy ran on which account.
-- ended_at IS NULL means the assignment is currently active.
-- When a bot is swapped, the active row is closed (ended_at set) and a new
-- row is inserted with started_at = swap timestamp.
-- ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bot_strategy_assignments (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL,
  account_id TEXT NOT NULL,
  strategy_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_assignments_user_account
  ON bot_strategy_assignments (user_id, account_id, started_at DESC);

-- Enforce: at most one currently-active assignment per (user_id, account_id).
-- A partial unique index on rows where ended_at IS NULL.
CREATE UNIQUE INDEX IF NOT EXISTS idx_bot_assignments_one_active_per_account
  ON bot_strategy_assignments (user_id, account_id)
  WHERE ended_at IS NULL;

ALTER TABLE bot_strategy_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on bot_strategy_assignments" ON bot_strategy_assignments;
DROP POLICY IF EXISTS "Owner only on bot_strategy_assignments" ON bot_strategy_assignments;
CREATE POLICY "Owner only on bot_strategy_assignments" ON bot_strategy_assignments
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
