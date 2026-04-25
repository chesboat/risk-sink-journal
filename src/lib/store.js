// ═══════════════════════════════════════════════════
// RISK SINK JOURNAL — Data Store & Calculations
// ═══════════════════════════════════════════════════

// ── Constants ──
export const INSTRUMENTS = ['MNQ', 'MES', 'MYM'];
export const SESSIONS = ['New York AM', 'New York PM', 'London', 'Asian'];
export const SETUPS = ['CISD', 'BOS', 'FVG', 'OB', 'Liquidity Sweep', 'EQ Level', 'Other'];
export const EMOTIONS = ['Calm', 'Confident', 'Anxious', 'FOMO', 'Revenge', 'Frustrated'];
export const QUALITIES = ['A+', 'A', 'B', 'C', 'D', 'F'];
export const HEALTH_STATUSES = ['Eval', 'Funded', 'Near Payout', 'Damaged', 'Critical', 'Passed'];

// ── Tag Categories (Tradezella-style) ──
export const MISTAKES = ['Moved Stop', 'Early Entry', 'Late Entry', 'Oversized', 'FOMO Entry', 'No Plan', 'Chased', 'Revenge Trade', 'Wrong Session', 'Ignored Levels'];
export const CONDITIONS = ['Trending', 'Ranging', 'Choppy', 'News Event', 'Low Volume', 'High Volume', 'Volatile', 'Pre-Market', 'Gap Up', 'Gap Down'];
export const CONFIRMATIONS = ['BOS', 'CISD', 'FVG Fill', 'Order Block', 'Liquidity Sweep', 'EQ Level', 'Divergence', 'Volume Spike', 'Displacement', 'Inducement'];

export const ENTRY_COLORS = { 1: 'var(--green)', 2: 'var(--orange)', 3: 'var(--teal)' };
export const ENTRY_LABELS = { 1: 'E1 · 3R', 2: 'E2 · 4R', 3: 'E3 · 5R' };
export const ENTRY_TARGETS = { 1: 3, 2: 4, 3: 5 };

// ── Default State ──
export function getDefaultState() {
  return {
    trades: [],
    accounts: [
      { id: 1, name: 'Account 1', slot: 1, health: 'Eval', startingPnl: 0, history: [] },
      { id: 2, name: 'Account 2', slot: 2, health: 'Eval', startingPnl: 0, history: [] },
      { id: 3, name: 'Account 3', slot: 3, health: 'Eval', startingPnl: 0, history: [] },
    ],
    settings: {
      theme: 'dark',
      mll: 2000,
      profitTarget: 3000,
      accountSize: 50000,
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
    const acct = accounts.find(a => a.slot === slot);
    return acct ? acct.name : `Slot ${slot}`;
  };
  const cleanText = (s) => (s || '').replace(/\s+/g, ' ').trim();

  // Per-account totals
  const perAccount = accounts.map(a => {
    const triggered = sorted.flatMap(t => (t.entries || []).filter(e => e.slot === a.slot && e.triggered));
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
      lines.push(`- **E${a.slot}** (slot ${a.slot}) → \`${a.name}\` — health: ${a.health || 'unknown'}, starting PnL: ${fmt$(a.startingPnl || 0)}`);
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
      if (tags.confirmations?.length) tagBits.push(`Confirmations: ${tags.confirmations.join(', ')}`);
      if (tags.conditions?.length)    tagBits.push(`Conditions: ${tags.conditions.join(', ')}`);
      if (tags.mistakes?.length)      tagBits.push(`Mistakes: ${tags.mistakes.join(', ')}`);
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
export function createTrade(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    date: new Date().toISOString().slice(0, 10),
    instrument: 'MNQ',
    session: 'New York AM',
    setup: '',
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
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    filtered = trades.filter(t => new Date(t.date + 'T00:00:00') >= weekAgo);
  } else if (period === 'month') {
    filtered = trades.filter(t => {
      const d = new Date(t.date + 'T00:00:00');
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  }

  const completedTrades = filtered.filter(t => getIdeaResult(t) !== null);
  const wins = completedTrades.filter(t => getIdeaResult(t) === 'WIN');
  const losses = completedTrades.filter(t => getIdeaResult(t) === 'LOSS');

  const allEntries = filtered.flatMap(t => t.entries.filter(e => e.triggered && e.result));
  const entryWins = allEntries.filter(e => e.result === 'W');

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

  // By emotion
  const byEmotion = EMOTIONS.map(emotion => {
    const emotionTrades = filtered.filter(t => t.emotion === emotion);
    const completed = emotionTrades.filter(t => getIdeaResult(t) !== null);
    const emotionWins = completed.filter(t => getIdeaResult(t) === 'WIN');
    return {
      emotion,
      trades: completed.length,
      wr: completed.length > 0 ? emotionWins.length / completed.length : 0,
      pnl: emotionTrades.reduce((s, t) => s + getNetPnl(t), 0),
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

  return {
    totalTrades: completedTrades.length,
    ideaWins: wins.length,
    ideaLosses: losses.length,
    ideaWR: completedTrades.length > 0 ? wins.length / completedTrades.length : 0,
    totalEntries: allEntries.length,
    entryWins: entryWins.length,
    entryWR: allEntries.length > 0 ? entryWins.length / allEntries.length : 0,
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

// ── Risk Sink Score ──
export function calcRiskScore(trades, accounts, settings) {
  const s = settings || { mll: 2000, profitTarget: 3000, accountSize: 50000 };
  const a = accounts || [];
  if (!trades || trades.length < 3) return { score: 0, grades: {}, label: 'Not enough data' };

  const stats = calcStats(trades, 'all');

  // 1. Idea WR (25%) — target: 40%+ is great
  const wrScore = Math.min(100, (stats.ideaWR / 0.5) * 100);

  // 2. Entry Discipline (20%) — are you using all 3 entries consistently?
  const tradesWithEntries = trades.filter(t => t.entries.some(e => e.triggered));
  const avgEntriesPerTrade = tradesWithEntries.length > 0
    ? tradesWithEntries.reduce((sum, t) => sum + t.entries.filter(e => e.triggered).length, 0) / tradesWithEntries.length
    : 0;
  const disciplineScore = Math.min(100, (avgEntriesPerTrade / 3) * 100);

  // 3. MLL Management (20%) — how much buffer remains across accounts (trailing-aware).
  // Uses distance-to-bust from trailing MLL, capped per account at mll_initial.
  const totalMllRemaining = a.reduce((sum, acc) => {
    const trailing = calcTrailingMll(acc, trades, s);
    return sum + Math.max(0, Math.min(s.mll, trailing.distanceToBust));
  }, 0);
  const maxMll = a.length * s.mll;
  const mllScore = maxMll > 0 ? (totalMllRemaining / maxMll) * 100 : 100;

  // 4. Consistency (20%) — low variance in daily PnL
  const dailyValues = Object.values(stats.dailyPnl);
  if (dailyValues.length < 2) {
    var consistencyScore = 50;
  } else {
    const mean = dailyValues.reduce((s, v) => s + v, 0) / dailyValues.length;
    const variance = dailyValues.reduce((s, v) => s + (v - mean) ** 2, 0) / dailyValues.length;
    const stdDev = Math.sqrt(variance);
    const cv = mean !== 0 ? Math.abs(stdDev / mean) : 10;
    var consistencyScore = Math.max(0, Math.min(100, 100 - cv * 20));
  }

  // 5. Emotion Quality (15%) — WR when calm/confident vs anxious/fomo/revenge
  const calmTrades = trades.filter(t => ['Calm', 'Confident'].includes(t.emotion) && getIdeaResult(t));
  const stressTrades = trades.filter(t => ['Anxious', 'FOMO', 'Revenge', 'Frustrated'].includes(t.emotion) && getIdeaResult(t));
  let emotionScore = 50;
  if (calmTrades.length > 0) {
    const calmWR = calmTrades.filter(t => getIdeaResult(t) === 'WIN').length / calmTrades.length;
    emotionScore = calmWR * 100;
    if (stressTrades.length > 0) {
      const stressRatio = stressTrades.length / (calmTrades.length + stressTrades.length);
      emotionScore = emotionScore * (1 - stressRatio * 0.3);
    }
  }

  const score = Math.round(
    wrScore * 0.25 +
    disciplineScore * 0.20 +
    mllScore * 0.20 +
    consistencyScore * 0.20 +
    emotionScore * 0.15
  );

  const label = score >= 80 ? 'Elite' : score >= 65 ? 'Strong' : score >= 50 ? 'Developing' : score >= 35 ? 'Needs Work' : 'Critical';

  return {
    score: Math.min(100, Math.max(0, score)),
    label,
    grades: {
      ideaWR: Math.round(wrScore),
      discipline: Math.round(disciplineScore),
      mll: Math.round(mllScore),
      consistency: Math.round(consistencyScore),
      emotion: Math.round(emotionScore),
    },
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
  const accts = accounts || []
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
  const pooledHeadroomPct = (pooledHeadroom / pooledMll) * 100
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
  const maxDdPctOfPool = (maxDd / pooledMll) * 100
  const currentCombinedPeak = peak
  const currentCombinedPeakAt = peakDate

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

  // Build per-account chronological deltas from triggered entries on this slot
  const sorted = [...(trades || [])].sort((a, b) => {
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
  const journalPnl = getAccountPnl(trades || [], account.slot);
  const totalPnl = (account.startingPnl || 0) + journalPnl;

  // Trailing MLL: uses chronological peak tracking per account
  const trailing = calcTrailingMll(account, trades || [], s);

  const ptProgress = Math.max(0, totalPnl);
  const ptLeft = s.profitTarget - ptProgress;

  const entries = trades.flatMap(t => t.entries.filter(e => e.slot === account.slot && e.triggered && e.result));
  const wins = entries.filter(e => e.result === 'W');
  const slotWR = entries.length > 0 ? wins.length / entries.length : 0;

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
  };
}

// ── Behavioral Flags ──
export function getBehavioralFlags(trades) {
  const flags = [];
  const today = new Date().toISOString().slice(0, 10);

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
  return n >= 0 ? `+$${n.toFixed(0)}` : `-$${Math.abs(n).toFixed(0)}`;
}
