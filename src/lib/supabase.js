// ═══════════════════════════════════════════════════
// SUPABASE CLIENT & SYNC
// ═══════════════════════════════════════════════════
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Only create client if configured
export const supabase = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

export const isSupabaseConfigured = () => !!supabase;

// ── Push full state to Supabase ──
export async function pushState(state) {
  if (!supabase) return;

  try {
    // Upsert trades
    if (state.trades && state.trades.length > 0) {
      const tradeRows = state.trades.map(t => ({
        id: t.id,
        data: t,
        updated_at: new Date().toISOString(),
      }));
      const { error: tradeErr } = await supabase
        .from('trades')
        .upsert(tradeRows, { onConflict: 'id' });
      if (tradeErr) console.error('Supabase trade push error:', tradeErr);
    }

    // Upsert accounts & settings as a single config row
    const { error: configErr } = await supabase
      .from('config')
      .upsert({
        id: 'main',
        accounts: state.accounts,
        settings: state.settings,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
    if (configErr) console.error('Supabase config push error:', configErr);
  } catch (err) {
    console.error('Supabase push failed:', err);
  }
}

// ── Pull full state from Supabase ──
export async function pullState() {
  if (!supabase) return null;

  try {
    // Fetch all trades
    const { data: tradeRows, error: tradeErr } = await supabase
      .from('trades')
      .select('id, data')
      .order('updated_at', { ascending: false });

    if (tradeErr) {
      console.error('Supabase trade pull error:', tradeErr);
      return null;
    }

    // Fetch config
    const { data: configRows, error: configErr } = await supabase
      .from('config')
      .select('*')
      .eq('id', 'main')
      .single();

    if (configErr && configErr.code !== 'PGRST116') {
      // PGRST116 = no rows found, which is fine on first use
      console.error('Supabase config pull error:', configErr);
    }

    const trades = tradeRows ? tradeRows.map(r => r.data) : [];
    const accounts = configRows?.accounts || null;
    const settings = configRows?.settings || null;

    return { trades, accounts, settings };
  } catch (err) {
    console.error('Supabase pull failed:', err);
    return null;
  }
}

// ── Delete a trade from Supabase ──
export async function deleteTrade(tradeId) {
  if (!supabase) return;

  try {
    const { error } = await supabase
      .from('trades')
      .delete()
      .eq('id', tradeId);
    if (error) console.error('Supabase delete error:', error);
  } catch (err) {
    console.error('Supabase delete failed:', err);
  }
}

// ── Push a single trade (for faster saves) ──
export async function pushTrade(trade) {
  if (!supabase) return;

  try {
    const { error } = await supabase
      .from('trades')
      .upsert({
        id: trade.id,
        data: trade,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
    if (error) console.error('Supabase trade upsert error:', error);
  } catch (err) {
    console.error('Supabase trade upsert failed:', err);
  }
}

// ── Push config (accounts + settings) ──
export async function pushConfig(accounts, settings) {
  if (!supabase) return;

  try {
    const { error } = await supabase
      .from('config')
      .upsert({
        id: 'main',
        accounts,
        settings,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
    if (error) console.error('Supabase config push error:', error);
  } catch (err) {
    console.error('Supabase config push failed:', err);
  }
}
