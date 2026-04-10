// ═══════════════════════════════════════════════════
// SUPABASE CLIENT & SYNC (multi-user, user_id scoped)
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
// DATA SYNC (scoped by userId)
// ═══════════════════════════════════════════════════

// ── Push full state to Supabase ──
export async function pushState(state, userId) {
  if (!supabase || !userId) return;

  try {
    // Upsert trades
    if (state.trades && state.trades.length > 0) {
      const tradeRows = state.trades.map(t => ({
        id: t.id,
        user_id: userId,
        data: t,
        updated_at: new Date().toISOString(),
      }));
      const { error: tradeErr } = await supabase
        .from('trades')
        .upsert(tradeRows, { onConflict: 'id' });
      if (tradeErr) console.error('Supabase trade push error:', tradeErr);
    }

    // Upsert accounts & settings — one row per user
    const { error: configErr } = await supabase
      .from('config')
      .upsert({
        user_id: userId,
        accounts: state.accounts,
        settings: state.settings,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    if (configErr) console.error('Supabase config push error:', configErr);
  } catch (err) {
    console.error('Supabase push failed:', err);
  }
}

// ── Pull full state from Supabase (scoped to current user) ──
export async function pullState(userId) {
  if (!supabase || !userId) return null;

  try {
    // Fetch user's trades
    const { data: tradeRows, error: tradeErr } = await supabase
      .from('trades')
      .select('id, data')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (tradeErr) {
      console.error('Supabase trade pull error:', tradeErr);
      return null;
    }

    // Fetch user's config
    const { data: configRow, error: configErr } = await supabase
      .from('config')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (configErr) {
      console.error('Supabase config pull error:', configErr);
    }

    const trades = tradeRows ? tradeRows.map(r => r.data) : [];
    const accounts = configRow?.accounts || null;
    const settings = configRow?.settings || null;

    return { trades, accounts, settings };
  } catch (err) {
    console.error('Supabase pull failed:', err);
    return null;
  }
}

// ── Delete a trade from Supabase ──
export async function deleteTrade(tradeId, userId) {
  if (!supabase || !userId) return;

  try {
    const { error } = await supabase
      .from('trades')
      .delete()
      .eq('id', tradeId)
      .eq('user_id', userId);
    if (error) console.error('Supabase delete error:', error);
  } catch (err) {
    console.error('Supabase delete failed:', err);
  }
}

// ── Push a single trade (for faster saves) ──
export async function pushTrade(trade, userId) {
  if (!supabase || !userId) return;

  try {
    const { error } = await supabase
      .from('trades')
      .upsert({
        id: trade.id,
        user_id: userId,
        data: trade,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
    if (error) console.error('Supabase trade upsert error:', error);
  } catch (err) {
    console.error('Supabase trade upsert failed:', err);
  }
}

// ── Push config (accounts + settings) ──
export async function pushConfig(accounts, settings, userId) {
  if (!supabase || !userId) return;

  try {
    const { error } = await supabase
      .from('config')
      .upsert({
        user_id: userId,
        accounts,
        settings,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    if (error) console.error('Supabase config push error:', error);
  } catch (err) {
    console.error('Supabase config push failed:', err);
  }
}
