// ═══════════════════════════════════════════════════
// SUPABASE CLIENT & SYNC (multi-user, user_id scoped)
// Authoritative-remote model: helpers throw on failure
// so callers can implement optimistic-with-revert.
// ═══════════════════════════════════════════════════
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Only create client if configured
export const supabase = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

export const isSupabaseConfigured = () => !!supabase;

// ═══════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════
export async function signInWithGoogle() {
  if (!supabase) return;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  if (error) console.error('Google sign-in error:', error);
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function getCurrentUser() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data?.user || null;
}

export function onAuthChange(cb) {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    cb(session?.user || null);
  });
  return () => data.subscription.unsubscribe();
}

// ═══════════════════════════════════════════════════
// DATA SYNC (scoped by userId) — throw on failure
// ═══════════════════════════════════════════════════

// ── Pull full state from Supabase (scoped to current user) ──
// Returns { trades, botTrades, strategyAssignments, accounts, settings } or throws.
// Returns null only if supabase isn't configured.
//
// The bot_trades and bot_strategy_assignments fetches are wrapped in try/catch
// so a user who hasn't yet run the latest SQL migration can still load their
// manual journal — bot data simply comes back empty until the tables exist.
export async function pullState(userId) {
  if (!supabase || !userId) return null;

  // Fetch user's manual trades
  const { data: tradeRows, error: tradeErr } = await supabase
    .from('trades')
    .select('id, data')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (tradeErr) throw tradeErr;

  // Fetch user's config
  const { data: configRow, error: configErr } = await supabase
    .from('config')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (configErr) throw configErr;

  // Fetch bot trades and strategy assignments (graceful degradation if missing)
  let botTrades = [];
  let strategyAssignments = [];
  try {
    const { data: botRows, error: botErr } = await supabase
      .from('bot_trades')
      .select('*')
      .eq('user_id', userId)
      .order('exit_ts', { ascending: false });
    if (botErr) throw botErr;
    botTrades = botRows || [];
  } catch (err) {
    console.warn('bot_trades unavailable (run the latest migration?):', err.message);
  }
  try {
    const { data: asgRows, error: asgErr } = await supabase
      .from('bot_strategy_assignments')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false });
    if (asgErr) throw asgErr;
    strategyAssignments = (asgRows || []).map(r => ({
      id: r.id,
      accountId: r.account_id,
      strategyName: r.strategy_name,
      startedAt: r.started_at,
      endedAt: r.ended_at,
      note: r.note,
    }));
  } catch (err) {
    console.warn('bot_strategy_assignments unavailable (run the latest migration?):', err.message);
  }

  const trades = tradeRows ? tradeRows.map(r => r.data) : [];
  const accounts = configRow?.accounts || null;
  const settings = configRow?.settings || null;

  return { trades, botTrades, strategyAssignments, accounts, settings };
}

// ── Push a single trade (upsert) ──
export async function pushTrade(trade, userId) {
  if (!supabase || !userId) return;
  const { error } = await supabase
    .from('trades')
    .upsert({
      id: trade.id,
      user_id: userId,
      data: trade,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
  if (error) throw error;
}

// ── Delete a trade from Supabase ──
export async function deleteTrade(tradeId, userId) {
  if (!supabase || !userId) return;
  const { error } = await supabase
    .from('trades')
    .delete()
    .eq('id', tradeId)
    .eq('user_id', userId);
  if (error) throw error;
}

// ── Push config (accounts + settings) ──
export async function pushConfig(accounts, settings, userId) {
  if (!supabase || !userId) return;
  const { error } = await supabase
    .from('config')
    .upsert({
      user_id: userId,
      accounts,
      settings,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  if (error) throw error;
}

// ── Bulk push — used for import-data only ──
export async function pushAllTrades(trades, userId) {
  if (!supabase || !userId) return;
  if (!trades || trades.length === 0) return;
  const rows = trades.map(t => ({
    id: t.id,
    user_id: userId,
    data: t,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase
    .from('trades')
    .upsert(rows, { onConflict: 'id' });
  if (error) throw error;
}

// ── Replace all trades — delete everything, then insert new set ──
export async function replaceAllTrades(trades, userId) {
  if (!supabase || !userId) return;
  const { error: delErr } = await supabase
    .from('trades')
    .delete()
    .eq('user_id', userId);
  if (delErr) throw delErr;
  if (trades && trades.length > 0) {
    await pushAllTrades(trades, userId);
  }
}

// ═══════════════════════════════════════════════════
// BOT TRADES
// ═══════════════════════════════════════════════════

// Upsert a single bot trade. Idempotent on (user_id, source, external_id).
export async function pushBotTrade(trade, userId) {
  if (!supabase || !userId) return;
  const row = { ...trade, user_id: userId, updated_at: new Date().toISOString() };
  const { error } = await supabase
    .from('bot_trades')
    .upsert(row, { onConflict: 'user_id,source,external_id' });
  if (error) throw error;
}

export async function deleteBotTrade(id, userId) {
  if (!supabase || !userId) return;
  const { error } = await supabase
    .from('bot_trades')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}

// Bulk upsert — used by the ingestion cron.
export async function upsertBotTrades(trades, userId) {
  if (!supabase || !userId) return;
  if (!trades || trades.length === 0) return;
  const rows = trades.map(t => ({
    ...t,
    user_id: userId,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase
    .from('bot_trades')
    .upsert(rows, { onConflict: 'user_id,source,external_id' });
  if (error) throw error;
}

// ═══════════════════════════════════════════════════
// BOT STRATEGY ASSIGNMENTS
// ═══════════════════════════════════════════════════

// Camel-case (app) ⇄ snake-case (db) mappers — keeps the rest of the app
// camelCase without leaking SQL conventions.
const assignmentToRow = (a, userId) => ({
  id: a.id,
  user_id: userId,
  account_id: a.accountId,
  strategy_name: a.strategyName,
  started_at: a.startedAt,
  ended_at: a.endedAt,
  note: a.note,
});

export async function pushAssignment(assignment, userId) {
  if (!supabase || !userId) return;
  const { error } = await supabase
    .from('bot_strategy_assignments')
    .upsert(assignmentToRow(assignment, userId), { onConflict: 'id' });
  if (error) throw error;
}

// Close out the currently-active assignment on an account by setting ended_at.
// Returns the closed row (or null if no active assignment existed).
export async function closeActiveAssignment(accountId, endedAt, userId) {
  if (!supabase || !userId) return null;
  const { data, error } = await supabase
    .from('bot_strategy_assignments')
    .update({ ended_at: endedAt })
    .eq('user_id', userId)
    .eq('account_id', accountId)
    .is('ended_at', null)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function deleteAssignment(id, userId) {
  if (!supabase || !userId) return;
  const { error } = await supabase
    .from('bot_strategy_assignments')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}
