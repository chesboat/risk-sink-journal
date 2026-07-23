// ═══════════════════════════════════════════════════
// CSV IMPORT — Bot trades from Tradovate / TopstepX exports
// ═══════════════════════════════════════════════════
//
// Both brokers' "Trades" / "Performance" exports give one row per closed
// position with realized P&L. We don't try to pair raw fills — that's a
// separate (more complex) feature if we ever need it.
//
// Approach: header auto-detection. We don't hardcode exact column names
// because broker exports drift over time and prop firms sometimes customize
// the format. Instead we keep a list of likely synonyms per field and pick
// the first match (case-insensitive, whitespace-normalized).
// ═══════════════════════════════════════════════════

// ── CSV parsing ──
// Minimal RFC-4180-ish parser. Handles quoted fields, escaped quotes, commas
// inside quotes. Good enough for broker exports which are typically clean.
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const src = text.replace(/\r\n?/g, '\n'); // normalize line endings

  while (i < src.length) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i += 2; continue; } // escaped quote
        inQuotes = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === ',') { row.push(field); field = ''; i++; continue; }
    if (ch === '\n') {
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = []; i++; continue;
    }
    field += ch; i++;
  }
  // Trailing field/row
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0] !== '') rows.push(row);
  }

  if (rows.length === 0) return { headers: [], data: [] };
  const headers = rows[0].map(h => h.trim());
  const data = rows.slice(1).map(r => {
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = r[idx] !== undefined ? r[idx].trim() : ''; });
    return obj;
  });
  return { headers, data };
}

// ── Header-to-field mapping ──
// Each field lists likely header synonyms in priority order. The detector
// scans the CSV headers and picks the first match per field. Case- and
// whitespace-insensitive.
const FIELD_SYNONYMS = {
  externalId: ['Trade ID', 'TradeId', 'TradeID', 'Order ID', 'OrderId', 'orderId', 'Id', 'ID', 'Order', 'Position ID', 'PositionId'],
  symbol: ['Symbol', 'Contract', 'Instrument', 'Product', 'Ticker'],
  side: ['Side', 'B/S', 'Buy/Sell', 'Direction', 'Long/Short', 'Position'],
  qty: ['Qty', 'Quantity', 'Contracts', 'Size', 'Filled Qty', 'filledQty', 'Number of Contracts'],
  entryPrice: ['Entry Price', 'EntryPrice', 'Buy Price', 'Open Price', 'Avg Entry Price', 'avgEntryPrice', 'avgPrice', 'Entry'],
  exitPrice: ['Exit Price', 'ExitPrice', 'Sell Price', 'Close Price', 'Avg Exit Price', 'avgExitPrice', 'Exit'],
  entryTs: ['Entry Time', 'EntryTime', 'Open Time', 'Buy Time', 'Start Time', 'Date Entered', 'Entered At'],
  exitTs: ['Exit Time', 'ExitTime', 'Close Time', 'Sell Time', 'End Time', 'Date Exited', 'Exited At', 'Fill Time', 'Timestamp'],
  pnl: ['P&L', 'PnL', 'PL', 'Profit/Loss', 'Realized P&L', 'Realized PnL', 'Net P&L', 'Net PnL', 'Net Profit', 'Profit'],
  fees: ['Fees', 'Commission', 'Commissions', 'Fee', 'Total Fees', 'Total Commission'],
  accountLabel: ['Account', 'Account ID', 'Account Number', 'Account Name'],
};

const norm = (s) => (s || '').toLowerCase().replace(/[\s_-]+/g, '');

// Given the CSV headers, return a mapping { fieldName: headerName | null }.
// Auto-detects using FIELD_SYNONYMS.
export function detectMapping(headers) {
  const normToOrig = {};
  headers.forEach(h => { normToOrig[norm(h)] = h; });

  const mapping = {};
  for (const [field, synonyms] of Object.entries(FIELD_SYNONYMS)) {
    mapping[field] = null;
    for (const syn of synonyms) {
      const hit = normToOrig[norm(syn)];
      if (hit) { mapping[field] = hit; break; }
    }
  }
  return mapping;
}

// Fields that MUST resolve for a row to be importable.
export const REQUIRED_FIELDS = ['externalId', 'symbol', 'qty', 'pnl', 'exitTs'];

// Returns a list of required fields that the mapping failed to detect.
export function missingRequired(mapping) {
  return REQUIRED_FIELDS.filter(f => !mapping[f]);
}

// ── Value normalizers ──

const parseNumber = (v) => {
  if (v == null || v === '') return null;
  // Strip $ , whitespace, and handle parenthesis-negative
  const s = String(v).trim();
  const isNeg = /^\(.*\)$/.test(s);
  const cleaned = s.replace(/[$,\s]/g, '').replace(/^[()]|[()]$/g, '');
  const n = parseFloat(cleaned);
  if (isNaN(n)) return null;
  return isNeg ? -n : n;
};

const parseSide = (v) => {
  if (!v) return null;
  const s = v.trim().toLowerCase();
  if (['b', 'buy', 'long', 'l'].includes(s)) return 'long';
  if (['s', 'sell', 'short', 'sh'].includes(s)) return 'short';
  // Net direction strings like "1" / "-1" or "Long"/"Short" handled above
  return s.includes('short') ? 'short' : s.includes('long') ? 'long' : null;
};

// ── Timezone-aware timestamp parsing ──
// Broker exports usually carry NAIVE timestamps ("2026-03-04 09:32:14") in
// exchange/account time with no offset. Parsing those as browser-local (the
// old behavior) shifts trades across midnight for anyone not in that zone,
// corrupting daily P&L buckets. `tz` says how to interpret naive strings:
//   'America/New_York' (default — futures convention), any IANA zone,
//   'UTC', or 'local' (browser timezone).
// Strings with an explicit offset/Z, and epoch values, are unambiguous and
// ignore tz.

// Convert a wall-clock time in an IANA zone to a UTC timestamp. Two-pass
// offset resolution handles DST boundaries.
const zonedWallTimeToUtc = (y, mo, d, hh, mm, ss, timeZone) => {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const wallOf = (ts) => {
    const p = {};
    dtf.formatToParts(ts).forEach(x => { p[x.type] = x.value; });
    return Date.UTC(+p.year, +p.month - 1, +p.day, +(p.hour === '24' ? 0 : p.hour), +p.minute, +p.second);
  };
  const target = Date.UTC(y, mo - 1, d, hh, mm, ss);
  let ts = target - (wallOf(target) - target);
  ts = target - (wallOf(ts) - ts);
  return ts;
};

const NAIVE_ISO = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/;
const NAIVE_US = /^(\d{1,2})\/(\d{1,2})\/(\d{4})[ ,]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i;

const parseTs = (v, tz = 'America/New_York') => {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return new Date(v).toISOString();
  const s = String(v).trim();
  if (/^\d{13}$/.test(s)) return new Date(parseInt(s, 10)).toISOString();
  if (/^\d{10}$/.test(s)) return new Date(parseInt(s, 10) * 1000).toISOString();

  // Explicit offset or Z → unambiguous, let Date handle it
  if (/(?:Z|[+-]\d{2}:?\d{2})$/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  // Naive formats → interpret in the chosen timezone
  let y, mo, d, hh, mm, ss;
  let m = s.match(NAIVE_ISO);
  if (m) {
    [y, mo, d, hh, mm, ss] = [+m[1], +m[2], +m[3], +m[4], +m[5], +(m[6] || 0)];
  } else {
    m = s.match(NAIVE_US);
    if (m) {
      [mo, d, y, hh, mm, ss] = [+m[1], +m[2], +m[3], +m[4], +m[5], +(m[6] || 0)];
      const ampm = (m[7] || '').toUpperCase();
      if (ampm === 'PM' && hh < 12) hh += 12;
      if (ampm === 'AM' && hh === 12) hh = 0;
    }
  }
  if (y != null) {
    if (tz === 'local') {
      return new Date(y, mo - 1, d, hh, mm, ss).toISOString();
    }
    if (tz === 'UTC') {
      return new Date(Date.UTC(y, mo - 1, d, hh, mm, ss)).toISOString();
    }
    try {
      return new Date(zonedWallTimeToUtc(y, mo, d, hh, mm, ss, tz)).toISOString();
    } catch {
      // Unknown zone id — fall through to permissive parsing
    }
  }

  // Last resort: permissive Date parsing (browser-local)
  const d1 = new Date(s);
  if (!isNaN(d1.getTime())) return d1.toISOString();
  const d2 = new Date(s.replace(' ', 'T'));
  if (!isNaN(d2.getTime())) return d2.toISOString();
  return null;
};

// ── Row → bot_trade ──
//
// account is the bot account record this CSV is being imported into.
// source is a short identifier like 'tradovate-csv' or 'topstepx-csv'.
// opts:
//   tz            — how naive timestamps are interpreted (see parseTs)
//   feesIncluded  — true when the CSV's P&L column is already net of
//                   commissions (the common case). Fees are then recorded
//                   as 0 so downstream `pnl - fees` math doesn't subtract
//                   them a second time.
// Returns an object ready for upsert, or null + error reason if unimportable.
export function normalizeRow(row, mapping, account, source, opts = {}) {
  const { tz = 'America/New_York', feesIncluded = true } = opts;
  const get = (field) => mapping[field] ? row[mapping[field]] : null;

  const externalId = get('externalId');
  if (!externalId) return { ok: false, reason: 'missing trade ID' };

  const exitTs = parseTs(get('exitTs'), tz);
  if (!exitTs) return { ok: false, reason: 'missing or unparseable exit time' };
  const entryTs = parseTs(get('entryTs'), tz) || exitTs;

  const qty = parseNumber(get('qty'));
  if (qty == null) return { ok: false, reason: 'missing quantity' };

  const pnl = parseNumber(get('pnl'));
  if (pnl == null) return { ok: false, reason: 'missing P&L' };

  const symbol = (get('symbol') || '').trim();
  if (!symbol) return { ok: false, reason: 'missing symbol' };

  return {
    ok: true,
    trade: {
      id: crypto.randomUUID(),
      source,
      external_id: String(externalId),
      account_id: account.id,
      broker: account.broker || null,
      symbol,
      // null when the CSV has no side column — an honest unknown beats
      // silently marking every trade long
      side: parseSide(get('side')),
      qty: Math.abs(qty),
      entry_ts: entryTs,
      exit_ts: exitTs,
      entry_price: parseNumber(get('entryPrice')),
      exit_price: parseNumber(get('exitPrice')),
      pnl,
      fees: feesIncluded ? 0 : (parseNumber(get('fees')) || 0),
      raw_payload: row,
    },
  };
}

// Deduplicate against trades already present in state. Keyed per ACCOUNT —
// broker order ids are only unique within an account, so the same id on two
// accounts is two different trades, not a duplicate.
// Returns { fresh: [trade...], duplicates: [{trade, existingId}...] }.
export function dedupe(newTrades, existing) {
  const keyOf = (t) => `${t.source}|${t.external_id}|${t.account_id}`;
  const seen = new Map();
  (existing || []).forEach(t => { seen.set(keyOf(t), t); });
  const fresh = [];
  const duplicates = [];
  newTrades.forEach(t => {
    const key = keyOf(t);
    if (seen.has(key)) duplicates.push({ trade: t, existing: seen.get(key) });
    else { fresh.push(t); seen.set(key, t); }
  });
  return { fresh, duplicates };
}

// Convenience: parse + normalize + dedupe in one call.
// Returns { headers, mapping, missing, rows: {ok,error}[], fresh, duplicates }.
export function processCsv(text, account, source, existingTrades, opts = {}) {
  const { headers, data } = parseCsv(text);
  const mapping = detectMapping(headers);
  const missing = missingRequired(mapping);
  if (missing.length > 0) {
    return { headers, mapping, missing, rows: [], fresh: [], duplicates: [] };
  }
  const rows = data.map(row => normalizeRow(row, mapping, account, source, opts));
  const oks = rows.filter(r => r.ok).map(r => r.trade);
  const { fresh, duplicates } = dedupe(oks, existingTrades);
  return { headers, mapping, missing, rows, fresh, duplicates };
}
