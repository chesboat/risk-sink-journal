// ═══════════════════════════════════════════════════
// RISK SINK JOURNAL — Data Store & Calculations
// ═══════════════════════════════════════════════════

// ── Constants ──
export const INSTRUMENTS = ['MNQ', 'MES', 'MYM'];
// Dollars per 1.0 point of price movement per contract — used to derive
// risk $ (and therefore R) from entry/stop prices instead of hand-typing R.
export const POINT_VALUES = { MNQ: 2, MES: 5, MYM: 0.5 };

// Derive dollar risk and realized R from optional per-entry price fields.
// Returns null when the data isn't there — derived R is an assist, never a
// requirement; the stored `r` remains the source of truth for stats.
export function deriveEntryRisk(entry, instrument) {
  const pv = POINT_VALUES[instrument];
  const qty = Number(entry?.qty);
  const ep = Number(entry?.entryPrice);
  const sp = Number(entry?.stopPrice);
  if (!pv || !qty || !isFinite(ep) || !isFinite(sp) || ep === sp) return null;
  const riskDollars = Math.abs(ep - sp) * qty * pv;
  if (!(riskDollars > 0)) return null;
  const pnl = Number(entry?.pnl) || 0;
  return {
    riskDollars,
    suggestedR: Math.round((pnl / riskDollars) * 10) / 10,
  };
}
export const SESSIONS = ['New York AM', 'New York PM', 'London', 'Asian'];
export const SETUPS = ['CISD', 'BOS', 'FVG', 'OB', 'Liquidity Sweep', 'EQ Level', 'Other'];
export const EMOTIONS = ['Calm', 'Confident', 'Anxious', 'FOMO', 'Revenge', 'Frustrated'];
export const QUALITIES = ['A+', 'A', 'B', 'C', 'D', 'F'];
export const HEALTH_STATUSES = ['Eval', 'Funded', 'Near Payout', 'Damaged', 'Critical', 'Passed'];

// ── Tag Categories (Tradezella-style) ──
export const MISTAKES = ['Moved Stop', 'Early Entry', 'Late Entry', 'Oversized', 'FOMO Entry', 'No Plan', 'Chased', 'Revenge Trade', 'Wrong Session', 'Ignored Levels'];
export const CONDITIONS = ['Trending', 'Ranging', 'Choppy', 'News Event', 'Low Volume', 'High Volume', 'Volatile', 'Pre-Market', 'Gap Up', 'Gap Down'];
export const CONFIRMATIONS = ['BOS', 'CISD', 'FVG Fill', 'Order Block', 'Liquidity Sweep', 'EQ Level', 'Divergence', 'Volume Spike', 'Displacement', 'Inducement'];
// Risk Sink Style — matches the three-style framework used in the AI export
// (Style 1 = Equal Division, Style 2 = Building Position, Style 3 = Decreasing Risk)
export const RISK_SINK_STYLES = ['Style 1', 'Style 2', 'Style 3'];

export const TAG_CATEGORIES = [
  { key: 'confirmations', label: 'Confirmations',     options: CONFIRMATIONS,     color: 'var(--green)'  },
  { key: 'conditions',    label: 'Market Conditions', options: CONDITIONS,        color: 'var(--blue)'   },
  { key: 'riskSinkStyles',label: 'Risk Sink Style',   options: RISK_SINK_STYLES,  color: 'var(--purple)' },
  { key: 'mistakes',      label: 'Mistakes',          options: MISTAKES,          color: 'var(--red)'    },
];

// Today's date in the USER'S timezone as YYYY-MM-DD.
// Never use new Date().toISOString().slice(0,10) for this: that's the UTC
// date, so anyone west of UTC logging an evening session gets stamped with
// TOMORROW's date (8pm ET = midnight UTC). Every filter in the app compares
// local dates, so a UTC stamp lands the trade on the wrong day, the wrong
// week, and — at month end — outside "this month" entirely.
export function todayLocal(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// First day (Sunday) of the current LOCAL calendar week, as YYYY-MM-DD.
// "Week" everywhere means the current Sun–Sat trading week — matching the
// Calendar page's weekly rows — NOT a rolling 7 days (which straddled
// months and disagreed with the calendar).
export function startOfWeekLocal(d = new Date()) {
  const x = new Date(d);
  x.setDate(x.getDate() - x.getDay());
  return todayLocal(x);
}

export const ENTRY_COLORS = { 1: 'var(--green)', 2: 'var(--orange)', 3: 'var(--teal)' };
export const ENTRY_LABELS = { 1: 'E1 · 3R', 2: 'E2 · 4R', 3: 'E3 · 5R' };
export const ENTRY_TARGETS = { 1: 3, 2: 4, 3: 5 };

// ── Default State ──
// Accounts share a single array. `kind` discriminates manual (risk-sink E1/E2/E3)
// from bot (auto-ingested fills). Manual is the default for backwards-compat with
// pre-bot-feature data — see normalizeAccount() for the read-path defaulting.
export function getDefaultState() {
  return {
    trades: [],
    botTrades: [],
    strategyAssignments: [],
    accounts: [
      { id: 1, kind: 'manual', name: 'Account 1', slot: 1, health: 'Eval', startingPnl: 0, history: [] },
      { id: 2, kind: 'manual', name: 'Account 2', slot: 2, health: 'Eval', startingPnl: 0, history: [] },
      { id: 3, kind: 'manual', name: 'Account 3', slot: 3, health: 'Eval', startingPnl: 0, history: [] },
    ],
    settings: {
      theme: 'dark',
      mll: 2000,
      profitTarget: 3000,
      accountSize: 50000,
      // Target dollar risk per entry — with a shared stop across accounts,
      // each entry is sized to risk this same amount. Grades "Risk control".
      riskPerEntry: 200,
      // User-added tags persist here so they reappear on the next trade
      customTags: {
        confirmations: [],
        conditions: [],
        riskSinkStyles: [],
        mistakes: [],
      },
    },
  };
}

// ── Persistence ──
// NOTE: localStorage sync was removed in favor of Supabase-as-source-of-truth.
// State is now pulled from Supabase on auth and mutated via per-operation
// pushes with optimistic UI + revert-on-failure. See App.jsx.

export function exportData(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `risk-sink-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── AI-Friendly Export ──
// Builds a self-contained Markdown document designed to be pasted into Claude
// or ChatGPT. Includes:
//   • a glossary explaining the risk-sink schema and account mapping (E1/E2/E3)
//   • per-account settings, three-style description, and per-trade detail
//     showing which account got the win on each idea
//   • summary tables (idea-level, by entry, by setup, by session)
//   • an analysis prompt asking the AI to simulate Styles 1/2/3 on this data
// Screenshots are intentionally excluded — they'd blow up the file size.
export function exportForAI(state) {
  const md = buildAIMarkdown(state);
  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `risk-sink-ai-export-${new Date().toISOString().slice(0,10)}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

export function buildAIMarkdown(state) {
  const trades = state?.trades || [];
  const accounts = state?.accounts || [];
  const settings = state?.settings || {};
  const mll = settings.mll ?? 2000;
  const pt = settings.profitTarget ?? 3000;
  const acctSize = settings.accountSize ?? 50000;

  // Sort chronologically (oldest first) so the AI can reason about equity curve
  const sorted = [...trades].sort((a, b) => {
    const da = new Date(a.date + 'T00:00:00').getTime();
    const db = new Date(b.date + 'T00:00:00').getTime();
    if (da !== db) return da - db;
    return (a.createdAt || 0) - (b.createdAt || 0);
  });

  const fmt$ = (n) => {
    if (n == null || n === 0) return '$0';
    const sign = n >= 0 ? '+' : '-';
    return `${sign}$${Math.abs(Math.round(n)).toLocaleString()}`;
  };
  const slotName = (slot) => {
    const acct = getActiveManualAccounts(accounts).find(a => a.slot === slot)
      || accounts.find(a => a.slot === slot);
    return acct ? acct.name : `Slot ${slot}`;
  };
  const cleanText = (s) => (s || '').replace(/\s+/g, ' ').trim();

  // Per-account totals (each account only owns trades in its active window)
  const perAccount = accounts.map(a => {
    const triggered = sorted.filter(t => tradeInAccountWindow(a, t))
      .flatMap(t => (t.entries || []).filter(e => e.slot === a.slot && e.triggered));
    const wins = triggered.filter(e => e.result === 'W');
    const losses = triggered.filter(e => e.result === 'L');
    const bes = triggered.filter(e => e.result === 'BE');
    const journalPnl = triggered.reduce((s, e) => s + (e.pnl || 0), 0);
    const totalPnl = (a.startingPnl || 0) + journalPnl;
    const decisive = wins.length + losses.length;
    return {
      ...a,
      triggers: triggered.length,
      wins: wins.length,
      losses: losses.length,
      bes: bes.length,
      wr: decisive > 0 ? wins.length / decisive : null,
      journalPnl,
      totalPnl,
    };
  });

  const stats = calcStats(trades, 'all');
  const lift = calcRiskSinkLift(trades);

  const lines = [];

  // ── Header ──
  lines.push('# Risk Sink Journal — AI Analysis Export');
  lines.push('');
  lines.push(`**Generated:** ${new Date().toISOString().slice(0, 10)}`);
  lines.push(`**Total ideas logged:** ${trades.length}`);
  if (sorted.length > 0) {
    lines.push(`**Date range:** ${sorted[0].date} → ${sorted[sorted.length - 1].date}`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  // ── Glossary ──
  lines.push('## How to read this export');
  lines.push('');
  lines.push('This is a **futures-trading journal** for a **risk-sink strategy** spread across 3 prop-firm accounts. The trader logs one *idea* per setup and may enter that idea sequentially — once on each account — so a single losing entry on one account does not mean the idea lost overall.');
  lines.push('');
  lines.push('Each idea has up to 3 entries (E1, E2, E3), one per account. Standard pattern: if E1 stops out, the same idea is re-entered on the next account at a refined price (CISD-style precision entries).');
  lines.push('');
  lines.push('**Account mapping in this dataset (slot → account):**');
  if (accounts.length === 0) {
    lines.push('- *(no accounts configured)*');
  } else {
    accounts.forEach(a => {
      const archivedTag = a.archived ? ` — ARCHIVED${a.archivedAt ? ` ${a.archivedAt.slice(0, 10)}` : ''} (historical era)` : '';
      lines.push(`- **E${a.slot}** (slot ${a.slot}) → \`${a.name}\` — health: ${a.health || 'unknown'}, starting PnL: ${fmt$(a.startingPnl || 0)}${archivedTag}`);
    });
  }
  lines.push('');
  lines.push('**R targets per entry (the journal\'s convention):**');
  lines.push('- E1 → 3R target');
  lines.push('- E2 → 4R target');
  lines.push('- E3 → 5R target');
  lines.push('');
  lines.push('**Entry results:**');
  lines.push('- **W** = entry hit its target (PnL is positive, R column is the realized multiple).');
  lines.push('- **L** = entry stopped out (PnL is negative, ≈ -1R).');
  lines.push('- **BE** = exited flat / at small profit before target (PnL ≈ $0).');
  lines.push('');
  lines.push('**Idea result** is derived from the entries:');
  lines.push('- **WIN** if any triggered entry won.');
  lines.push('- **LOSS** if every triggered entry lost.');
  lines.push('- **BE / incomplete** otherwise.');
  lines.push('');

  // ── Settings ──
  lines.push('## Account settings');
  lines.push('');
  lines.push(`- **Per-account Max Loss Limit (MLL):** $${mll.toLocaleString()} (trailing)`);
  lines.push(`- **Per-account profit target:** $${pt.toLocaleString()}`);
  lines.push(`- **Account size:** $${acctSize.toLocaleString()}`);
  lines.push(`- **Pooled MLL across all ${accounts.length || 3} accounts:** $${(mll * (accounts.length || 3)).toLocaleString()}`);
  lines.push(`- **Pooled profit target:** $${(pt * (accounts.length || 3)).toLocaleString()}`);
  lines.push('');

  // ── Three Styles ──
  lines.push('## The three risk-sink styles to compare');
  lines.push('');
  lines.push('### Style 1 — Equal Division (currently used / "Our Method")');
  lines.push('Divide the hard stop equally across the 3 accounts. **Same size, same dollar risk per account.**');
  lines.push('- $200 risk per account, sequential entries');
  lines.push('- Stopped → immediately enter next account');
  lines.push('- Best for CISD-precise entries — works fast or not at all');
  lines.push('');
  lines.push('> The PnL numbers in the *Trades* section below come from this style — these are the trader\'s actual recorded outcomes.');
  lines.push('');
  lines.push('### Style 2 — Building Position (JD\'s Method)');
  lines.push('Keep $200 risk per account, **increase contract size as you average in**. Same dollar risk, bigger position on later entries because the stop is closer.');
  lines.push('- Entry 1: 2 contracts → Entry 2: 3 contracts → Entry 3: 5 contracts (illustrative ratios)');
  lines.push('- Risk per entry stays equal at $200; size grows with each re-entry');
  lines.push('');
  lines.push('### Style 3 — Decreasing Risk (Conservative)');
  lines.push('**Same contract size every entry**, so dollar risk naturally decreases on later entries (closer stop).');
  lines.push('- Entry 1: $200 risk → Entry 2: $120 risk → Entry 3: $80 risk (illustrative)');
  lines.push('- Total risk drops from $600 to ~$400');
  lines.push('- Last account is "almost free" — useful for protecting damaged accounts');
  lines.push('');

  // ── Trades ──
  lines.push('---');
  lines.push('');
  lines.push('## Trades (chronological, oldest first)');
  lines.push('');
  lines.push('Each block is one idea. The table shows whether each account triggered, the actual result, R-multiple realized, and dollar PnL. \"Net R\" / \"Net PnL\" sum across all triggered entries on that idea.');
  lines.push('');

  if (sorted.length === 0) {
    lines.push('*(No trades logged yet.)*');
    lines.push('');
  } else {
    sorted.forEach((t, idx) => {
      const result = getIdeaResult(t);
      const netR = getNetR(t);
      const netPnl = getNetPnl(t);
      const tags = t.tags || {};

      const headerBits = [
        `#${idx + 1}`,
        t.date,
        t.instrument || '?',
        t.session || '?',
        t.setup || 'no-setup',
      ];
      lines.push(`### ${headerBits.join(' · ')}`);
      lines.push('');

      const meta = [];
      if (t.quality) meta.push(`Quality **${t.quality}**`);
      if (t.emotion) meta.push(`Emotion: ${t.emotion}`);
      if (result) meta.push(`Idea result: **${result}**`);
      else meta.push('Idea result: incomplete');
      meta.push(`Net R: ${netR >= 0 ? '+' : ''}${netR.toFixed(1)}`);
      meta.push(`Net PnL: ${fmt$(netPnl)}`);
      lines.push(meta.join(' · '));
      lines.push('');

      lines.push('| Slot | Account | Triggered | Result | R | PnL |');
      lines.push('|------|---------|-----------|--------|---|-----|');
      (t.entries || []).forEach(e => {
        const tr = e.triggered ? 'yes' : 'no';
        const rs = e.triggered && e.result ? e.result : '—';
        const rv = e.triggered && e.result === 'W' && e.r != null ? e.r.toFixed(1)
                 : e.triggered && e.result === 'L' ? '-1.0'
                 : e.triggered && e.result === 'BE' ? '0'
                 : '—';
        const pv = e.triggered ? fmt$(e.pnl || 0) : '—';
        lines.push(`| E${e.slot} | ${slotName(e.slot)} | ${tr} | ${rs} | ${rv} | ${pv} |`);
      });
      lines.push('');

      if (t.thesis) { lines.push(`**Thesis:** ${cleanText(t.thesis)}`); lines.push(''); }
      if (t.notes)  { lines.push(`**Notes:** ${cleanText(t.notes)}`);   lines.push(''); }
      if (t.lesson) { lines.push(`**Lesson:** ${cleanText(t.lesson)}`); lines.push(''); }

      const tagBits = [];
      if (tags.confirmations?.length)  tagBits.push(`Confirmations: ${tags.confirmations.join(', ')}`);
      if (tags.conditions?.length)     tagBits.push(`Conditions: ${tags.conditions.join(', ')}`);
      if (tags.riskSinkStyles?.length) tagBits.push(`Risk Sink Style: ${tags.riskSinkStyles.join(', ')}`);
      if (tags.mistakes?.length)       tagBits.push(`Mistakes: ${tags.mistakes.join(', ')}`);
      if (tagBits.length) {
        lines.push(`*${tagBits.join(' · ')}*`);
        lines.push('');
      }

      if (t.screenshot) {
        lines.push('*(A chart screenshot is attached in-app but not included in this export.)*');
        lines.push('');
      }
    });
  }

  // ── Per-account totals ──
  lines.push('---');
  lines.push('');
  lines.push('## Per-account totals');
  lines.push('');
  lines.push('| Account | Slot | Triggers | W | L | BE | Entry WR | Journal PnL | Total PnL (incl. starting) | Health |');
  lines.push('|---------|------|----------|---|---|----|----------|-------------|----------------------------|--------|');
  perAccount.forEach(a => {
    const wr = a.wr != null ? `${(a.wr * 100).toFixed(0)}%` : '—';
    lines.push(`| ${a.name} | E${a.slot} | ${a.triggers} | ${a.wins} | ${a.losses} | ${a.bes} | ${wr} | ${fmt$(a.journalPnl)} | ${fmt$(a.totalPnl)} | ${a.health || '—'} |`);
  });
  lines.push('');

  // ── Idea-level summary ──
  lines.push('## Idea-level summary');
  lines.push('');
  lines.push(`- **Completed ideas:** ${stats.totalTrades}`);
  lines.push(`- **Idea wins:** ${stats.ideaWins}`);
  lines.push(`- **Idea losses:** ${stats.ideaLosses}`);
  lines.push(`- **Idea win rate:** ${(stats.ideaWR * 100).toFixed(1)}%`);
  lines.push(`- **Total triggered entries:** ${stats.totalEntries}`);
  lines.push(`- **Entry win rate:** ${(stats.entryWR * 100).toFixed(1)}%`);
  lines.push(`- **Total R (Style 1 actual):** ${stats.totalR >= 0 ? '+' : ''}${stats.totalR.toFixed(1)}`);
  lines.push(`- **Total PnL (Style 1 actual):** ${fmt$(stats.totalPnl)}`);
  lines.push(`- **Best win streak:** ${stats.bestWinStreak} ideas`);
  lines.push(`- **Worst loss streak:** ${stats.worstLossStreak} ideas`);
  if (lift && (lift.actualR !== 0 || lift.baselineR !== 0)) {
    lines.push(`- **Risk-sink lift vs E1-only baseline:** ${lift.liftR >= 0 ? '+' : ''}${lift.liftR.toFixed(1)}R / ${fmt$(lift.liftPnl)} (rescues: ${lift.rescues})`);
  }
  lines.push('');

  if (stats.byEntry?.length) {
    lines.push('### By entry slot');
    lines.push('');
    lines.push('| Entry | Triggers | Wins | Losses | WR | Total R | Total PnL |');
    lines.push('|-------|----------|------|--------|----|---------|-----------|');
    stats.byEntry.forEach(e => {
      const decisive = e.wins + e.losses;
      const wr = decisive > 0 ? `${((e.wins / decisive) * 100).toFixed(0)}%` : '—';
      lines.push(`| E${e.slot} | ${e.trades} | ${e.wins} | ${e.losses} | ${wr} | ${e.totalR >= 0 ? '+' : ''}${e.totalR.toFixed(1)} | ${fmt$(e.totalPnl)} |`);
    });
    lines.push('');
  }

  if (stats.bySetup?.length) {
    lines.push('### By setup');
    lines.push('');
    lines.push('| Setup | Ideas | Wins | WR | Total R | Total PnL |');
    lines.push('|-------|-------|------|----|---------|-----------|');
    stats.bySetup.forEach(s => {
      const wr = s.trades > 0 ? `${((s.wins / s.trades) * 100).toFixed(0)}%` : '—';
      lines.push(`| ${s.setup} | ${s.trades} | ${s.wins} | ${wr} | ${s.totalR >= 0 ? '+' : ''}${s.totalR.toFixed(1)} | ${fmt$(s.pnl)} |`);
    });
    lines.push('');
  }

  if (stats.bySession?.length) {
    lines.push('### By session');
    lines.push('');
    lines.push('| Session | Ideas | WR | Total PnL |');
    lines.push('|---------|-------|----|-----------|');
    stats.bySession.forEach(s => {
      const wr = s.ideas > 0 ? `${(s.wr * 100).toFixed(0)}%` : '—';
      lines.push(`| ${s.session} | ${s.ideas} | ${wr} | ${fmt$(s.pnl)} |`);
    });
    lines.push('');
  }

  if (stats.byEmotion?.length) {
    lines.push('### By emotion');
    lines.push('');
    lines.push('| Emotion | Ideas | WR | Total PnL |');
    lines.push('|---------|-------|----|-----------|');
    stats.byEmotion.forEach(e => {
      const wr = e.trades > 0 ? `${(e.wr * 100).toFixed(0)}%` : '—';
      lines.push(`| ${e.emotion} | ${e.trades} | ${wr} | ${fmt$(e.pnl)} |`);
    });
    lines.push('');
  }

  // ── Analysis prompt ──
  lines.push('---');
  lines.push('');
  lines.push('## What I\'d like you to analyze');
  lines.push('');
  lines.push('Using the trade-by-trade data above, please **simulate what my outcomes would have been under each of the three styles** and report the differences. The PnL recorded above reflects Style 1 actuals; you\'ll need to derive Styles 2 and 3.');
  lines.push('');
  lines.push('1. **Per-style cumulative PnL.** State your assumptions explicitly so I can sanity-check them. A reasonable starting point:');
  lines.push('   - **Style 1 (Equal Division):** use the actual per-entry PnL recorded.');
  lines.push('   - **Style 2 (Building Position):** assume contracts scale 2 / 3 / 5 across E1 / E2 / E3 with $200 risk per entry, so a winning entry pays its R-multiple × $200 (same $-per-entry as Style 1), but consider whether the realized R-multiple itself should change because the entry price is closer to target.');
  lines.push('   - **Style 3 (Decreasing Risk):** same contract size each entry, so dollar risk drops to roughly $200 / $120 / $80 on E1 / E2 / E3. A winning entry pays its R-multiple × that entry\'s dollar risk; a loss is -1× that entry\'s dollar risk.');
  lines.push('   If any of those assumptions don\'t fit how I actually trade, push back and ask before computing.');
  lines.push('');
  lines.push('2. **Equity curve per style** — list or chart the running total by date for each style.');
  lines.push('');
  lines.push('3. **Where does each style win or lose?** Look at *rescue* ideas (E1 lost, later entry won) — does Style 2 amplify them meaningfully? Look at *clean* E1 wins — does Style 3 give up too much there?');
  lines.push('');
  lines.push('4. **Single-account drawdown safety.** Under each style, what\'s the worst $-drawdown any single account would have seen? Would any style have busted an account given the $2,000 trailing MLL?');
  lines.push('');
  lines.push('5. **Recommendation.** Given my actual win rate, where wins tend to land (E1 vs later entries), and the emotion / quality tags on those wins, which style fits my realized behavior best? Be specific about *when* to switch — e.g., "use Style 3 only on damaged accounts" or "Style 2 amplifies your edge but only when E1 lost."');
  lines.push('');
  lines.push('Show your math.');
  lines.push('');

  return lines.join('\n');
}

export function importData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        resolve({ ...getDefaultState(), ...data });
      } catch { reject(new Error('Invalid JSON')); }
    };
    reader.readAsText(file);
  });
}

// ── Trade Helpers ──
// Carry-forward defaults: the next New Trade opens pre-filled with the last
// instrument/session/setup so daily logging doesn't re-pick the same chips.
const LAST_DEFAULTS_KEY = 'rsj-last-trade-defaults';
export function rememberTradeDefaults(trade) {
  try {
    localStorage.setItem(LAST_DEFAULTS_KEY, JSON.stringify({
      instrument: trade.instrument,
      session: trade.session,
      setup: trade.setup,
    }));
  } catch { /* storage unavailable — skip */ }
}
function lastTradeDefaults() {
  try {
    return JSON.parse(localStorage.getItem(LAST_DEFAULTS_KEY)) || {};
  } catch {
    return {};
  }
}

export function createTrade(overrides = {}) {
  const last = lastTradeDefaults();
  return {
    id: crypto.randomUUID(),
    date: todayLocal(),
    instrument: last.instrument || 'MNQ',
    session: last.session || 'New York AM',
    setup: last.setup || '',
    side: null, // 'long' | 'short' | null — direction of the idea
    thesis: '',
    entries: [
      { slot: 1, triggered: false, result: null, r: 0, pnl: 0 },
      { slot: 2, triggered: false, result: null, r: 0, pnl: 0 },
      { slot: 3, triggered: false, result: null, r: 0, pnl: 0 },
    ],
    emotion: '',
    quality: '',
    thesis: '',
    notes: '',
    lesson: '',
    tags: {
      mistakes: [],
      conditions: [],
      confirmations: [],
      riskSinkStyles: [],
    },
    screenshot: null,
    createdAt: Date.now(),
    ...overrides,
  };
}

export function getIdeaResult(trade) {
  const triggered = trade.entries.filter(e => e.triggered);
  if (triggered.length === 0) return null;
  if (triggered.some(e => e.result === 'W')) return 'WIN';
  if (triggered.every(e => e.result === 'L')) return 'LOSS';
  if (triggered.some(e => e.result === 'BE') && !triggered.some(e => e.result === 'W')) {
    const nonBE = triggered.filter(e => e.result !== 'BE');
    if (nonBE.length === 0) return 'BE';
    if (nonBE.every(e => e.result === 'L')) return 'LOSS';
  }
  return null; // incomplete
}

export function getNetR(trade) {
  return trade.entries.reduce((sum, e) => {
    if (!e.triggered) return sum;
    if (e.result === 'W') return sum + (e.r || 0);
    if (e.result === 'L') return sum - 1;
    return sum; // BE = 0
  }, 0);
}

export function getNetPnl(trade) {
  return trade.entries.reduce((sum, e) => {
    if (!e.triggered) return sum;
    return sum + (e.pnl || 0);
  }, 0);
}

// ── Statistics ──
export function calcStats(trades, period = 'all') {
  let filtered = trades;
  const now = new Date();

  if (period === 'week') {
    const weekStart = startOfWeekLocal(now);
    filtered = trades.filter(t => t.date >= weekStart);
  } else if (period === 'month') {
    filtered = trades.filter(t => {
      const d = new Date(t.date + 'T00:00:00');
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  } else if (period && typeof period === 'object') {
    // Custom range: { start, end } as YYYY-MM-DD (inclusive, either optional)
    const { start, end } = period;
    filtered = trades.filter(t => (!start || t.date >= start) && (!end || t.date <= end));
  }

  const completedTrades = filtered.filter(t => getIdeaResult(t) !== null);
  const wins = completedTrades.filter(t => getIdeaResult(t) === 'WIN');
  const losses = completedTrades.filter(t => getIdeaResult(t) === 'LOSS');

  const allEntries = filtered.flatMap(t => t.entries.filter(e => e.triggered && e.result));
  const entryWins = allEntries.filter(e => e.result === 'W');
  const entryLosses = allEntries.filter(e => e.result === 'L');
  const entryBEs = allEntries.filter(e => e.result === 'BE');
  // Entry WR is W/(W+L) — break-evens are excluded from the denominator,
  // matching the per-slot wr in byEntry so every page shows the same number.
  const decisiveEntries = entryWins.length + entryLosses.length;

  const totalR = filtered.reduce((s, t) => s + getNetR(t), 0);
  const totalPnl = filtered.reduce((s, t) => s + getNetPnl(t), 0);

  // By entry position
  const byEntry = [1, 2, 3].map(slot => {
    const entries = filtered.flatMap(t => t.entries.filter(e => e.slot === slot && e.triggered && e.result));
    const w = entries.filter(e => e.result === 'W');
    const l = entries.filter(e => e.result === 'L');
    return {
      slot,
      trades: entries.length,
      wins: w.length,
      losses: l.length,
      wr: entries.length > 0 ? w.length / (w.length + l.length) : 0,
      totalR: entries.reduce((s, e) => s + (e.result === 'W' ? (e.r || 0) : e.result === 'L' ? -1 : 0), 0),
      totalPnl: entries.reduce((s, e) => s + (e.pnl || 0), 0),
    };
  });

  // By session
  const bySession = SESSIONS.map(session => {
    const sessionTrades = filtered.filter(t => t.session === session);
    const completed = sessionTrades.filter(t => getIdeaResult(t) !== null);
    const sessionWins = completed.filter(t => getIdeaResult(t) === 'WIN');
    return {
      session,
      ideas: completed.length,
      wr: completed.length > 0 ? sessionWins.length / completed.length : 0,
      pnl: sessionTrades.reduce((s, t) => s + getNetPnl(t), 0),
    };
  });

  // By setup
  const setupMap = {};
  filtered.forEach(t => {
    if (!t.setup) return;
    if (!setupMap[t.setup]) setupMap[t.setup] = { setup: t.setup, trades: 0, wins: 0, totalR: 0, pnl: 0 };
    const result = getIdeaResult(t);
    if (result) {
      setupMap[t.setup].trades++;
      if (result === 'WIN') setupMap[t.setup].wins++;
    }
    setupMap[t.setup].totalR += getNetR(t);
    setupMap[t.setup].pnl += getNetPnl(t);
  });
  const bySetup = Object.values(setupMap).sort((a, b) => b.pnl - a.pnl);

  // Streaks
  const results = completedTrades
    .sort((a, b) => new Date(a.date + 'T00:00:00') - new Date(b.date + 'T00:00:00'))
    .map(t => getIdeaResult(t));
  let currentStreak = 0, bestWin = 0, worstLoss = 0, streak = 0, lastResult = null;
  results.forEach(r => {
    if (r === lastResult) { streak++; }
    else { streak = 1; lastResult = r; }
    if (r === 'WIN') { bestWin = Math.max(bestWin, streak); }
    if (r === 'LOSS') { worstLoss = Math.max(worstLoss, streak); }
  });
  if (results.length > 0) {
    const last = results[results.length - 1];
    let cnt = 0;
    for (let i = results.length - 1; i >= 0 && results[i] === last; i--) cnt++;
    currentStreak = last === 'WIN' ? cnt : -cnt;
  }

  // By emotion — pnl sums COMPLETED trades only, matching the `trades` count
  // so downstream per-trade averages (pnl / trades) aren't skewed by pending ideas.
  const byEmotion = EMOTIONS.map(emotion => {
    const emotionTrades = filtered.filter(t => t.emotion === emotion);
    const completed = emotionTrades.filter(t => getIdeaResult(t) !== null);
    const emotionWins = completed.filter(t => getIdeaResult(t) === 'WIN');
    return {
      emotion,
      trades: completed.length,
      wr: completed.length > 0 ? emotionWins.length / completed.length : 0,
      pnl: completed.reduce((s, t) => s + getNetPnl(t), 0),
    };
  }).filter(e => e.trades > 0);

  // Daily PnL for chart
  const dailyPnl = {};
  filtered.forEach(t => {
    if (!dailyPnl[t.date]) dailyPnl[t.date] = 0;
    dailyPnl[t.date] += getNetPnl(t);
  });
  const sortedDays = Object.keys(dailyPnl).sort();
  let cumulative = 0;
  const equityCurve = sortedDays.map(date => {
    cumulative += dailyPnl[date];
    return { date, daily: dailyPnl[date], cumulative };
  });

  // Expectancy & payoff — completed ideas only, so open trades can't
  // dilute the averages
  const completedPnls = completedTrades.map(getNetPnl);
  const completedRs = completedTrades.map(getNetR);
  const winPnls = wins.map(getNetPnl);
  const lossPnls = losses.map(getNetPnl);
  const avg = (arr) => (arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);
  const expectancyPnl = avg(completedPnls);
  const expectancyR = avg(completedRs);
  const avgWinPnl = avg(winPnls);
  const avgLossPnl = Math.abs(avg(lossPnls));
  const payoffRatio = avgLossPnl > 0 ? avgWinPnl / avgLossPnl : (avgWinPnl > 0 ? Infinity : 0);

  return {
    totalTrades: completedTrades.length,
    ideaWins: wins.length,
    ideaLosses: losses.length,
    ideaWR: completedTrades.length > 0 ? wins.length / completedTrades.length : 0,
    expectancyPnl,
    expectancyR,
    avgWinPnl,
    avgLossPnl,
    payoffRatio,
    totalEntries: allEntries.length,
    entryWins: entryWins.length,
    entryLosses: entryLosses.length,
    entryBEs: entryBEs.length,
    entryWR: decisiveEntries > 0 ? entryWins.length / decisiveEntries : 0,
    totalR,
    totalPnl,
    byEntry,
    bySession,
    bySetup,
    byEmotion,
    currentStreak,
    bestWinStreak: bestWin,
    worstLossStreak: worstLoss,
    equityCurve,
    dailyPnl,
  };
}

// ── Tag performance ──
// Aggregates completed ideas per tag within each tag category: how often a
// tag appears, its idea win rate, and its net P&L. This is where "Moved Stop
// cost me $1,400" comes from. Custom (user-added) tags are included because
// aggregation iterates the tags actually present on trades, not the presets.
export function calcTagStats(trades) {
  const completed = (trades || []).filter(t => getIdeaResult(t) !== null);
  return TAG_CATEGORIES.map(cat => {
    const byTag = {};
    completed.forEach(t => {
      (t.tags?.[cat.key] || []).forEach(tag => {
        if (!byTag[tag]) byTag[tag] = { tag, ideas: 0, wins: 0, pnl: 0, totalR: 0 };
        byTag[tag].ideas++;
        if (getIdeaResult(t) === 'WIN') byTag[tag].wins++;
        byTag[tag].pnl += getNetPnl(t);
        byTag[tag].totalR += getNetR(t);
      });
    });
    const tags = Object.values(byTag)
      .map(x => ({ ...x, wr: x.ideas > 0 ? x.wins / x.ideas : 0, avgPnl: x.ideas > 0 ? x.pnl / x.ideas : 0 }))
      // Mistakes ranked most-damaging first; everything else by impact size
      .sort((a, b) => cat.key === 'mistakes' ? a.pnl - b.pnl : Math.abs(b.pnl) - Math.abs(a.pnl));
    return { key: cat.key, label: cat.label, color: cat.color, tags };
  }).filter(c => c.tags.length > 0);
}

// ── Risk Sink Score ──
//
// Grades BEHAVIOR YOU CONTROL, not state you inherited. Design rules:
//   • Every component is a score 0-100 with the underlying stat exposed as
//     `detail`, so the card can never present a score as if it were the raw
//     statistic (the old version showed a capped WR score labeled "Idea WR").
//   • A component that can't be measured yet is EXCLUDED and the remaining
//     weights renormalize — no silent 50s, no free 100s.
//   • The final score is shrunk toward 50 by sample size, so a handful of
//     ideas can't read as "Elite".
//   • Style-neutral: nothing rewards firing all three entries. With a shared
//     stop, an idea that wins on E1 alone is a GREAT outcome, not poor
//     discipline (the old "avg entries ÷ 3" metric punished exactly that).
export const SCORE_WEIGHTS = {
  edge: 0.30,
  riskControl: 0.20,
  drawdown: 0.20,
  process: 0.15,
  consistency: 0.15,
};
export const SCORE_MIN_SAMPLE = 5;      // below this, no score at all
export const SCORE_FULL_CONFIDENCE = 30; // ideas needed for an unshrunk score

const clamp01to100 = (n) => Math.max(0, Math.min(100, n));

export function scoreLabel(score) {
  return score >= 80 ? 'Elite'
    : score >= 65 ? 'Strong'
    : score >= 50 ? 'Developing'
    : score >= 35 ? 'Needs Work'
    : 'Critical';
}

// Rolling window: the score always grades the LAST 30 completed ideas
// (SCORE_FULL_CONFIDENCE), regardless of calendar periods. A behavior grade
// that reset every month asked for "5 more ideas" on the 1st despite months
// of history; a rolling window has no boundary resets and old-era trades
// age out naturally as new ones are logged.
export function calcRiskScore(trades, accounts, settings) {
  const s = settings || {};
  const riskPerEntry = s.riskPerEntry || 200;
  const all = trades || [];
  const allCompleted = all.filter(t => getIdeaResult(t) !== null);

  if (allCompleted.length < SCORE_MIN_SAMPLE) {
    return {
      score: 0,
      label: 'Not enough data',
      sampleSize: allCompleted.length,
      needed: SCORE_MIN_SAMPLE - allCompleted.length,
      confidence: 0,
      components: [],
    };
  }

  const recent = [...allCompleted]
    .sort((a, b) => {
      const da = new Date(a.date + 'T00:00:00').getTime();
      const db = new Date(b.date + 'T00:00:00').getTime();
      if (da !== db) return da - db;
      return (a.createdAt || 0) - (b.createdAt || 0);
    })
    .slice(-SCORE_FULL_CONFIDENCE);
  const n = recent.length;

  const stats = calcStats(recent, 'all');
  // Pooled drawdown stays all-trades: trailing floors and peaks are account
  // state, not a sample of behavior (account windows handle the eras).
  const pooled = calcPooledHealth(all, accounts, s);
  const components = [];
  const add = (key, label, score, detail, measured = true, hint = null) =>
    components.push({ key, label, weight: SCORE_WEIGHTS[key], score: Math.round(score), detail, measured, hint });

  // ── 1. EDGE (30%) — expectancy in R per completed idea.
  // Breakeven maps to 50; +2R/idea maxes it. This is the component the old
  // score lacked entirely: nothing in it cared whether you made money.
  const expR = stats.expectancyR || 0;
  add('edge', 'Edge', clamp01to100(50 + expR * 25),
    `${expR >= 0 ? '+' : ''}${expR.toFixed(2)}R per idea · ${formatPnl(stats.expectancyPnl || 0)} avg`);

  // ── 2. RISK CONTROL (20%) — did each entry actually risk the target $?
  // Only measurable once contracts/entry/stop prices are logged.
  const risks = [];
  recent.forEach(t => (t.entries || []).forEach(e => {
    if (!e.triggered) return;
    const derived = deriveEntryRisk(e, t.instrument);
    if (derived) risks.push(derived.riskDollars);
  }));
  if (risks.length >= 3) {
    const avgDev = risks.reduce((sum, d) => sum + Math.abs(d - riskPerEntry) / riskPerEntry, 0) / risks.length;
    // 0% drift = 100, 25% avg drift = 50, 50%+ = 0
    add('riskControl', 'Risk control', clamp01to100(100 - avgDev * 200),
      `avg ${Math.round(avgDev * 100)}% off your $${riskPerEntry} target · ${risks.length} entries priced`);
  } else {
    add('riskControl', 'Risk control', 0, 'not measured', false,
      'Log contracts + entry & stop prices on entries to grade your sizing.');
  }

  // ── 3. DRAWDOWN DISCIPLINE (20%) — how deep you dug into the POOLED
  // buffer (3 accounts × per-account MLL). Measures damage taken, not
  // buffer inherited: fresh accounts don't get a free 100 forever, and one
  // idea can hit all three accounts at once.
  if (pooled.pooledMll > 0) {
    const ddShare = pooled.maxDd / pooled.pooledMll;
    // 0% of pool = 100, 33% = 50, 66%+ = 0
    add('drawdown', 'Drawdown control', clamp01to100(100 - ddShare * 150),
      `worst -$${Math.round(pooled.maxDd).toLocaleString()} of $${pooled.pooledMll.toLocaleString()} pooled (${Math.round(ddShare * 100)}%)`);
  } else {
    add('drawdown', 'Drawdown control', 0, 'not measured', false, 'No active accounts configured.');
  }

  // ── 4. PROCESS (15%) — self-reported mistakes per idea. Only graded if
  // you actually tag trades, so non-taggers aren't scored on silence.
  const anyTagged = recent.some(t => Object.values(t.tags || {}).some(arr => arr?.length > 0));
  if (anyTagged) {
    const mistakes = recent.reduce((sum, t) => sum + (t.tags?.mistakes?.length || 0), 0);
    const perIdea = mistakes / n;
    // clean = 100, 1 mistake per idea = 50, 2+ = 0
    add('process', 'Process', clamp01to100(100 - perIdea * 50),
      `${mistakes} mistake tag${mistakes === 1 ? '' : 's'} across ${n} ideas`);
  } else {
    add('process', 'Process', 0, 'not measured', false,
      'Tag mistakes when logging trades to grade execution discipline.');
  }

  // ── 5. CONSISTENCY (15%) — best day as a share of total profit. This is
  // the rule prop firms actually enforce for payouts, and unlike the old
  // coefficient-of-variation metric it doesn't punish you for a big green day
  // (it only cares that profit isn't concentrated in one session).
  const dailyValues = Object.values(stats.dailyPnl || {});
  const totalNet = dailyValues.reduce((sum, v) => sum + v, 0);
  const bestDay = dailyValues.length > 0 ? Math.max(...dailyValues) : 0;
  if (dailyValues.length >= 3 && totalNet > 0 && bestDay > 0) {
    const share = bestDay / totalNet;
    // ≤30% of profit in one day = 100, 100% in one day = 0
    add('consistency', 'Consistency', clamp01to100(((1 - share) / 0.7) * 100),
      `best day is ${Math.round(share * 100)}% of total profit · ${dailyValues.length} trading days`);
  } else {
    add('consistency', 'Consistency', 0, 'not measured', false,
      totalNet > 0 ? 'Needs 3+ trading days.' : 'Needs a net-positive stretch to measure profit concentration.');
  }

  // ── Combine: renormalize over measured components only ──
  const measured = components.filter(c => c.measured);
  const totalWeight = measured.reduce((sum, c) => sum + c.weight, 0);
  const raw = totalWeight > 0
    ? measured.reduce((sum, c) => sum + c.score * c.weight, 0) / totalWeight
    : 50;

  // ── Confidence: shrink toward neutral until the sample supports the claim ──
  const confidence = Math.max(0, Math.min(1, n / SCORE_FULL_CONFIDENCE));
  const score = Math.round(50 + (raw - 50) * confidence);

  return {
    score: clamp01to100(score),
    rawScore: Math.round(raw),
    label: scoreLabel(score),
    sampleSize: n,
    confidence,
    components,
  };
}

// ── Risk Sync Lift ──
// How much R/$ has the sequential risk-sink structure actually earned you
// compared to a hypothetical "single account, one shot" version of the same idea?
//
// Single-account baseline = you take the trade on E1 only, stop there.
//   E1 W → +E1.r,  E1 L → -1R,  E1 BE → 0,  E1 skipped → 0 (idea never entered)
//
// Risk-sink actual = sum over triggered entries of their R/PNL contributions.
//
// Lift = actual - baseline. Positive means risk sink rescued or improved the idea.
export function calcRiskSinkLift(trades) {
  let actualR = 0
  let baselineR = 0
  let actualPnl = 0
  let basePnl = 0
  let rescues = 0       // ideas where E1 lost but a later entry caught a win
  let missedWins = 0    // ideas where you'd have won at E1 alone — risk sink had no effect here
  let perIdea = []

  ;(trades || []).forEach((t) => {
    const entries = t.entries || []
    const e1 = entries.find((e) => e.slot === 1)

    // Actual net from all triggered entries
    const aR = entries.reduce((s, e) => {
      if (!e.triggered) return s
      if (e.result === 'W') return s + (e.r || 0)
      if (e.result === 'L') return s - 1
      return s
    }, 0)
    const aP = entries.reduce((s, e) => {
      if (!e.triggered) return s
      return s + (e.pnl || 0)
    }, 0)

    // Hypothetical E1-only outcome
    let bR = 0
    let bP = 0
    if (e1 && e1.triggered) {
      if (e1.result === 'W') {
        bR = e1.r || 0
        missedWins++
      } else if (e1.result === 'L') {
        bR = -1
      }
      bP = e1.pnl || 0
    }

    // Only count ideas that had *some* action (E1 triggered or any triggered)
    const anyTriggered = entries.some((e) => e.triggered)
    if (!anyTriggered) return

    actualR += aR
    baselineR += bR
    actualPnl += aP
    basePnl += bP

    // Was this a rescue? E1 lost, later entry won
    if (e1 && e1.triggered && e1.result === 'L') {
      const laterWin = entries.some((e) => e.slot > 1 && e.triggered && e.result === 'W')
      if (laterWin) rescues++
    }

    perIdea.push({
      date: t.date,
      actualR: aR,
      baselineR: bR,
      liftR: aR - bR,
      actualPnl: aP,
      basePnl: bP,
      liftPnl: aP - bP,
    })
  })

  return {
    actualR,
    baselineR,
    liftR: actualR - baselineR,
    actualPnl,
    basePnl,
    liftPnl: actualPnl - basePnl,
    rescues,
    missedWins,
    perIdea,
  }
}

// ── Pooled Risk Sink Health ──
// Treats the 3 prop accounts as a single system. Risk sink's real value is pooled
// MLL headroom: you get 3× per-account MLL ($6k default) to keep taking shots
// without any single account busting. Accounts are allowed to diverge — one can
// be deep red while two are green and the system is still healthy.
//
// Max drawdown is computed peak-to-trough on the COMBINED equity curve
// (all accounts summed, chronological by trade date then createdAt).
export function calcPooledHealth(trades, accounts, settings) {
  const s = settings || { mll: 2000, profitTarget: 3000, accountSize: 50000 }
  // Pooled risk-sink health is a manual-strategy concept (E1/E2/E3). Bot accounts
  // have their own MLL/PT tracking and don't belong in this pool; archived
  // accounts are no longer part of the live system.
  const accts = getActiveManualAccounts(accounts || [])
  const perAccountMll = s.mll || 2000
  const perAccountPt = s.profitTarget || 3000
  const pooledMll = perAccountMll * accts.length
  const pooledPt = perAccountPt * accts.length

  // Per-account totals using trailing MLL (peak-aware)
  const perAccount = accts.map((a) => {
    const trailing = calcTrailingMll(a, trades || [], s)
    const totalPnl = trailing.currentPnl
    const ptProgress = Math.max(0, totalPnl)
    const ptPct = (ptProgress / perAccountPt) * 100
    return {
      id: a.id,
      name: a.name,
      slot: a.slot,
      health: a.health,
      totalPnl,
      peak: trailing.peak,
      trailingFloor: trailing.trailingFloor,
      mllDistance: trailing.distanceToBust,
      mllUsed: trailing.mllUsed,
      mllUsedPct: trailing.mllUsedPct,
      busted: trailing.busted,
      ptProgress,
      ptPct,
    }
  })

  // Combined PnL across accounts right now (for display)
  const combinedPnl = perAccount.reduce((s, a) => s + a.totalPnl, 0)

  // Pooled headroom = sum of per-account distance-to-bust (cannot exceed per-account MLL,
  // since that's the max any single account can have as runway at any moment).
  // This is the honest answer to "how much total dollar drawdown can the system absorb
  // before ANY account busts", assuming losses land on the weakest account.
  const pooledHeadroom = perAccount.reduce(
    (s, a) => s + Math.max(0, Math.min(perAccountMll, a.mllDistance)),
    0
  )
  // Guard: with zero active accounts pooledMll is 0 — report 0% not NaN
  const pooledHeadroomPct = pooledMll > 0 ? (pooledHeadroom / pooledMll) * 100 : 0
  const combinedMllUsed = pooledMll - pooledHeadroom
  const combinedMllLeft = pooledHeadroom

  // Worst-account indicator: the account closest to its own MLL
  const worst = perAccount.reduce((w, a) => {
    if (!w) return a
    return a.mllUsedPct > w.mllUsedPct ? a : w
  }, null)

  // Best-account indicator: the account closest to payout
  const best = perAccount.reduce((b, a) => {
    if (!b) return a
    return a.ptPct > b.ptPct ? a : b
  }, null)

  // Combined equity curve + per-account curves + max drawdown
  // Sort trades chronologically and accumulate both combined and per-account state.
  const sorted = [...(trades || [])].sort((a, b) => {
    const da = new Date(a.date + 'T00:00:00').getTime()
    const db = new Date(b.date + 'T00:00:00').getTime()
    if (da !== db) return da - db
    return (a.createdAt || 0) - (b.createdAt || 0)
  })
  const startingCombined = accts.reduce((s, a) => s + (a.startingPnl || 0), 0)

  // Per-account running state for building individual curves with trailing floor
  const acctState = accts.map((a) => ({
    id: a.id,
    name: a.name,
    slot: a.slot,
    running: a.startingPnl || 0,
    peak: a.startingPnl || 0,
  }))
  const floorOf = (peak) => Math.min(0, peak - perAccountMll)
  const accountCurves = acctState.map((st) => ({
    id: st.id,
    name: st.name,
    slot: st.slot,
    points: [
      { date: null, pnl: st.running, peak: st.peak, floor: floorOf(st.peak) },
    ],
  }))

  let running = startingCombined
  const initialCombinedFloor = acctState.reduce((s, st) => s + floorOf(st.peak), 0)
  const curve = [{ date: null, combined: running, floor: initialCombinedFloor }]
  sorted.forEach((t) => {
    const dayDelta = (t.entries || []).reduce((s, e) => {
      if (!e.triggered) return s
      const idx = acctState.findIndex((st) => st.slot === e.slot)
      if (idx >= 0 && !tradeInAccountWindow(accts[idx], t)) return s
      if (idx >= 0) {
        acctState[idx].running += e.pnl || 0
        if (acctState[idx].running > acctState[idx].peak) {
          acctState[idx].peak = acctState[idx].running
        }
      }
      return s + (e.pnl || 0)
    }, 0)
    running += dayDelta
    const combinedFloor = acctState.reduce((s, st) => s + floorOf(st.peak), 0)
    curve.push({ date: t.date, combined: running, floor: combinedFloor })
    acctState.forEach((st, idx) => {
      accountCurves[idx].points.push({
        date: t.date,
        pnl: st.running,
        peak: st.peak,
        floor: floorOf(st.peak),
      })
    })
  })

  // Peak-to-trough drawdown (in dollars) across the combined curve
  let peak = startingCombined
  let peakDate = null
  let maxDd = 0
  let maxDdAt = null
  let maxDdPeak = startingCombined
  let maxDdPeakAt = null
  curve.forEach((pt) => {
    if (pt.combined > peak) {
      peak = pt.combined
      peakDate = pt.date
    }
    const dd = peak - pt.combined
    if (dd > maxDd) {
      maxDd = dd
      maxDdAt = pt.date
      maxDdPeak = peak
      maxDdPeakAt = peakDate
    }
  })
  const maxDdPctOfPool = pooledMll > 0 ? (maxDd / pooledMll) * 100 : 0
  const currentCombinedPeak = peak
  const currentCombinedPeakAt = peakDate

  // Drawdown DURATION: how long the combined curve has stayed below a prior
  // peak. Depth says how much it hurt; duration says how long it dragged on.
  let maxDdDays = 0
  let underwaterSince = null
  {
    let ddPeakVal = startingCombined
    let ddPeakDate = null
    curve.forEach((pt) => {
      if (pt.combined >= ddPeakVal) {
        if (underwaterSince && pt.date) {
          const days = (new Date(pt.date) - new Date(underwaterSince)) / 86400000
          if (days > maxDdDays) maxDdDays = days
        }
        ddPeakVal = pt.combined
        ddPeakDate = pt.date
        underwaterSince = null
      } else if (underwaterSince === null) {
        underwaterSince = ddPeakDate // null when the very first point is a loss
      }
    })
  }
  const currentUnderwaterDays = underwaterSince
    ? Math.max(0, Math.round((Date.now() - new Date(underwaterSince + 'T00:00:00').getTime()) / 86400000))
    : 0
  if (currentUnderwaterDays > maxDdDays) maxDdDays = currentUnderwaterDays

  return {
    pooledMll,
    pooledPt,
    combinedPnl,
    combinedMllUsed,
    combinedMllLeft,
    pooledHeadroom,
    pooledHeadroomPct,
    perAccount,
    worst,
    best,
    curve,
    accountCurves,
    perAccountMll,
    maxDd,
    maxDdAt,
    maxDdPeak,
    maxDdPeakAt,
    maxDdPctOfPool,
    maxDdDays: Math.round(maxDdDays),
    underwaterSince,
    currentUnderwaterDays,
    currentCombinedPeak,
    currentCombinedPeakAt,
  }
}

// ── Trailing MLL ──
// Topstep / Tradeify / Lucid-style trailing drawdown:
//   • Peak PnL is tracked chronologically (EOD-equivalent, i.e. after each trade)
//   • Trailing floor = min(0, peak − MLL_initial) — trails $-for-$ with profit,
//     locks at $0 once peak hits +MLL_initial
//   • Account busts the moment current PnL drops below the floor
// startingPnl is used as the peak seed (best estimate; pre-journal peaks unknown).
export function calcTrailingMll(account, trades, settings) {
  const s = settings || { mll: 2000 }
  const mllInitial = s.mll || 2000
  const seed = account.startingPnl || 0

  // Build per-account chronological deltas from triggered entries on this slot,
  // limited to the account's active window (generational accounts).
  const sorted = getTradesForAccount(account, trades).sort((a, b) => {
    const da = new Date(a.date + 'T00:00:00').getTime()
    const db = new Date(b.date + 'T00:00:00').getTime()
    if (da !== db) return da - db
    return (a.createdAt || 0) - (b.createdAt || 0)
  })

  let running = seed
  let peak = seed
  sorted.forEach((t) => {
    const e = (t.entries || []).find((x) => x.slot === account.slot && x.triggered)
    if (!e) return
    running += e.pnl || 0
    if (running > peak) peak = running
  })

  const currentPnl = running
  const trailingFloor = Math.min(0, peak - mllInitial)
  const distanceToBust = currentPnl - trailingFloor
  const busted = distanceToBust <= 0
  // mllUsed: how much of the $mllInitial buffer is consumed right now.
  // When peak is below the initial MLL, this equals (mllInitial − distance).
  // When peak has locked the floor at $0, mllUsed only grows as currentPnl drops below $0.
  const mllUsed = Math.max(0, Math.min(mllInitial, mllInitial - distanceToBust))
  const mllLeft = Math.max(0, mllInitial - mllUsed)
  const mllPercent = (mllLeft / mllInitial) * 100
  const mllUsedPct = (mllUsed / mllInitial) * 100

  return {
    peak,
    currentPnl,
    trailingFloor,
    distanceToBust,
    busted,
    mllInitial,
    mllUsed,
    mllLeft,
    mllPercent,
    mllUsedPct,
  }
}

// ── Account Helpers ──
export function getAccountPnl(trades, slot) {
  return trades.reduce((sum, t) => {
    const entry = t.entries.find(e => e.slot === slot && e.triggered);
    return sum + (entry ? (entry.pnl || 0) : 0);
  }, 0);
}

export function getAccountStats(account, trades, settings) {
  const s = settings || { mll: 2000, profitTarget: 3000, accountSize: 50000 };
  // Only trades inside this account's active window count toward its stats
  const owned = getTradesForAccount(account, trades);
  const journalPnl = getAccountPnl(owned, account.slot);
  const totalPnl = (account.startingPnl || 0) + journalPnl;

  // Trailing MLL: uses chronological peak tracking per account
  const trailing = calcTrailingMll(account, trades || [], s);

  const ptProgress = Math.max(0, totalPnl);
  const ptLeft = s.profitTarget - ptProgress;

  const entries = owned.flatMap(t => t.entries.filter(e => e.slot === account.slot && e.triggered && e.result));
  const wins = entries.filter(e => e.result === 'W');
  const slotWR = entries.length > 0 ? wins.length / entries.length : 0;

  // Per-account edge metrics over this account's (windowed) entries.
  // Caveat for risk-sink accounts: E2/E3 only fire after earlier entries
  // stopped out, so these read as "what re-entries earn", not independent
  // account skill.
  const entryPnls = entries.map(e => Number(e.pnl) || 0);
  const losers = entryPnls.filter(p => p < 0);
  const grossWin = entryPnls.reduce((s, p) => s + Math.max(0, p), 0);
  const grossLoss = Math.abs(entryPnls.reduce((s, p) => s + Math.min(0, p), 0));
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : (grossWin > 0 ? Infinity : 0);
  const expectancyPerEntry = entries.length > 0
    ? entryPnls.reduce((s, p) => s + p, 0) / entries.length
    : 0;

  // Max drawdown of THIS account's equity (chronological, window-aware)
  const chrono = [...owned].sort((a, b) => {
    const da = new Date(a.date + 'T00:00:00').getTime();
    const db = new Date(b.date + 'T00:00:00').getTime();
    if (da !== db) return da - db;
    return (a.createdAt || 0) - (b.createdAt || 0);
  });
  let running = account.startingPnl || 0;
  let ddPeak = running;
  let maxDrawdown = 0;
  chrono.forEach(t => {
    const e = (t.entries || []).find(x => x.slot === account.slot && x.triggered);
    if (!e) return;
    running += Number(e.pnl) || 0;
    if (running > ddPeak) ddPeak = running;
    if (ddPeak - running > maxDrawdown) maxDrawdown = ddPeak - running;
  });

  return {
    journalPnl,
    totalPnl,
    // MLL fields now come from trailing calculation
    mllUsed: trailing.mllUsed,
    mllLeft: trailing.mllLeft,
    mllPercent: trailing.mllPercent,
    // Extra trailing fields for richer UI
    mllPeak: trailing.peak,
    mllFloor: trailing.trailingFloor,
    mllDistance: trailing.distanceToBust,
    mllBusted: trailing.busted,
    ptProgress,
    ptLeft,
    ptPercent: (ptProgress / s.profitTarget) * 100,
    slotWR,
    totalEntries: entries.length,
    grossWin,
    grossLoss,
    profitFactor,
    expectancyPerEntry,
    avgWin: wins.length > 0 ? grossWin / wins.length : 0,
    avgLoss: losers.length > 0 ? grossLoss / losers.length : 0,
    maxDrawdown,
  };
}

// ── Behavioral Flags ──
export function getBehavioralFlags(trades) {
  const flags = [];
  const today = todayLocal();

  // Overtrading: >3 ideas in a single day
  const byDate = {};
  trades.forEach(t => {
    if (!byDate[t.date]) byDate[t.date] = [];
    byDate[t.date].push(t);
  });
  Object.entries(byDate).forEach(([date, dayTrades]) => {
    if (dayTrades.length > 3) {
      flags.push({ type: 'overtrade', date, message: `${dayTrades.length} ideas on ${date} — possible overtrading` });
    }
  });

  // Revenge trading: loss followed by trade within same session
  const sorted = [...trades].sort((a, b) => new Date(a.date + 'T00:00:00') - new Date(b.date + 'T00:00:00') || a.createdAt - b.createdAt);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (prev.date === curr.date && prev.session === curr.session && getIdeaResult(prev) === 'LOSS') {
      flags.push({ type: 'revenge', date: curr.date, message: `Possible revenge trade on ${curr.date} (${curr.session})` });
    }
  }

  return flags;
}

// ── Date Helpers ──
export function getCalendarDays(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = (firstDay.getDay() + 6) % 7; // Mon=0
  const daysInMonth = lastDay.getDate();

  const days = [];
  // Previous month padding
  const prevMonthLast = new Date(year, month, 0).getDate();
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    days.push({ day: prevMonthLast - i, inMonth: false });
  }
  // Current month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({ day: i, inMonth: true });
  }
  // Next month padding
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    days.push({ day: i, inMonth: false });
  }
  return days;
}

export function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatCurrency(n) {
  const abs = Math.abs(n);
  const formatted = abs >= 1000 ? `$${(abs / 1000).toFixed(1)}k` : `$${abs.toFixed(0)}`;
  return n >= 0 ? `+${formatted}` : `-${formatted}`;
}

export function formatPnl(n) {
  // toFixed can round -0.4 to "-0"; treat anything that rounds to zero as flat
  if (Math.abs(n) < 0.5) return '$0';
  return n > 0 ? `+$${n.toFixed(0)}` : `-$${Math.abs(n).toFixed(0)}`;
}

// ═══════════════════════════════════════════════════
// BOT ACCOUNTS, BOT TRADES, STRATEGY ASSIGNMENTS
// ═══════════════════════════════════════════════════

export const BROKERS = ['tradovate', 'topstepx'];
// Display label for a broker key
export const BROKER_LABEL = { tradovate: 'Tradovate', topstepx: 'TopstepX' };

// Read-path defaulting: any account written before the `kind` field existed
// gets treated as manual. Always call this when reading accounts from state.
export function normalizeAccount(a) {
  return { kind: 'manual', ...a };
}

export function getManualAccounts(accounts) {
  return (accounts || []).map(normalizeAccount).filter(a => a.kind === 'manual');
}

// ── Account generations ──
// Manual accounts are generational: archiving an account freezes its trade
// window and frees its slot for a fresh account. Attribution stays slot-based —
// an account owns a trade when the slots match AND the trade date falls inside
// the account's [activeFrom, archivedAt] window. Legacy accounts (no window
// fields) own every trade on their slot, which matches pre-generation behavior.

export function getActiveManualAccounts(accounts) {
  return getManualAccounts(accounts).filter(a => !a.archived);
}

export function getArchivedManualAccounts(accounts) {
  return getManualAccounts(accounts).filter(a => a.archived);
}

export function tradeInAccountWindow(account, trade) {
  const d = trade.date; // YYYY-MM-DD strings compare lexically
  if (account.activeFrom && d < account.activeFrom) return false;
  if (account.archived && account.archivedAt && d > account.archivedAt.slice(0, 10)) return false;
  return true;
}

export function getTradesForAccount(account, trades) {
  return (trades || []).filter(t => tradeInAccountWindow(account, t));
}

export function createManualAccount({ name, slot, startingPnl = 0 } = {}) {
  return {
    id: crypto.randomUUID(),
    kind: 'manual',
    name: (name || '').trim() || 'New Account',
    slot,
    health: 'Eval',
    startingPnl: Number(startingPnl) || 0,
    history: [],
    activeFrom: todayLocal(),
  };
}

export function getBotAccounts(accounts) {
  return (accounts || []).map(normalizeAccount).filter(a => a.kind === 'bot');
}

// Create a new bot account. broker is the platform that hosts the account
// (tradovate covers Lucid + Tradeify; topstepx covers Topstep).
// externalAccountId is the broker's own account ID, used by ingestion to know
// which Tradovate/TopstepX account a fill came from.
export function createBotAccount({ name, broker, externalAccountId, propFirm = '', startingPnl = 0 } = {}) {
  return {
    id: crypto.randomUUID(),
    kind: 'bot',
    name: name || 'Bot Account',
    broker: broker || 'tradovate',
    propFirm,               // free-form: 'Lucid', 'Tradeify', 'Topstep', …
    externalAccountId: externalAccountId || '',
    health: 'Eval',
    startingPnl,
    history: [],            // unused for bots; kept for shape parity
    createdAt: Date.now(),
  };
}

// ── Strategy assignment helpers ──

export function createStrategyAssignment({ accountId, strategyName, startedAt, note }) {
  return {
    id: crypto.randomUUID(),
    accountId,
    strategyName: (strategyName || '').trim(),
    startedAt: startedAt || new Date().toISOString(),
    endedAt: null,
    note: (note || '').trim() || null,
  };
}

// Active assignment for an account (ended_at is null).
export function getActiveAssignment(assignments, accountId) {
  return (assignments || []).find(a => a.accountId === accountId && !a.endedAt) || null;
}

// All assignments for an account, sorted newest-first by startedAt.
export function getAssignmentHistory(assignments, accountId) {
  return (assignments || [])
    .filter(a => a.accountId === accountId)
    .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
}

// Which strategy was active on `accountId` at ISO timestamp `ts`?
// Used to attribute a bot_trade to a strategy at fill time.
// Returns the assignment record, or null if none was active then.
export function getStrategyAt(assignments, accountId, ts) {
  const tms = new Date(ts).getTime();
  return (assignments || []).find(a => {
    if (a.accountId !== accountId) return false;
    const start = new Date(a.startedAt).getTime();
    if (start > tms) return false;
    if (!a.endedAt) return true; // currently active
    return new Date(a.endedAt).getTime() > tms;
  }) || null;
}

// Tag every bot trade with its strategyName based on the active assignment
// at exit_ts. Returns a new array; does not mutate input.
export function tagBotTradesWithStrategy(botTrades, assignments) {
  return (botTrades || []).map(t => {
    const a = getStrategyAt(assignments, t.account_id, t.exit_ts);
    return { ...t, strategy: a ? a.strategyName : null };
  });
}

// Distinct strategy names seen across history — useful for autocomplete
// when adding a new assignment.
export function getAllStrategyNames(assignments) {
  const set = new Set();
  (assignments || []).forEach(a => { if (a.strategyName) set.add(a.strategyName); });
  return Array.from(set).sort();
}

// ── Bot account stats ──
// Mirrors getAccountStats() shape for manual accounts so the same UI components
// can render either. Operates on bot_trades rather than trades.entries.
export function getBotAccountStats(account, botTrades, settings) {
  const s = settings || { mll: 2000, profitTarget: 3000, accountSize: 50000 };
  const mine = (botTrades || []).filter(t => t.account_id === account.id);

  // Sort chronologically by exit_ts to compute peak/floor
  const sorted = [...mine].sort((a, b) => new Date(a.exit_ts) - new Date(b.exit_ts));

  let running = account.startingPnl || 0;
  let peak = running;
  sorted.forEach(t => {
    running += (Number(t.pnl) || 0) - (Number(t.fees) || 0);
    if (running > peak) peak = running;
  });

  const totalPnl = running;
  const trailingFloor = Math.min(0, peak - s.mll);
  const distanceToBust = totalPnl - trailingFloor;
  const busted = distanceToBust <= 0;
  const mllUsed = Math.max(0, Math.min(s.mll, s.mll - distanceToBust));
  const mllLeft = Math.max(0, s.mll - mllUsed);
  const mllPercent = (mllLeft / s.mll) * 100;

  const ptProgress = Math.max(0, totalPnl);
  const wins = mine.filter(t => Number(t.pnl) > 0).length;
  const losses = mine.filter(t => Number(t.pnl) < 0).length;
  const decisive = wins + losses;

  return {
    totalPnl,
    trades: mine.length,
    wins,
    losses,
    winRate: decisive > 0 ? wins / decisive : 0,
    mllUsed,
    mllLeft,
    mllPercent,
    mllPeak: peak,
    mllFloor: trailingFloor,
    mllDistance: distanceToBust,
    mllBusted: busted,
    ptProgress,
    ptLeft: s.profitTarget - ptProgress,
    ptPercent: (ptProgress / s.profitTarget) * 100,
  };
}
