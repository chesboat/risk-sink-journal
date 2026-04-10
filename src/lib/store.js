// ═══════════════════════════════════════════════════
// RISK SINK JOURNAL — Data Store & Calculations
// ═══════════════════════════════════════════════════

const STORAGE_KEY = 'risk-sink-journal';

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
export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultState();
    const parsed = JSON.parse(raw);
    const defaults = getDefaultState();
    return {
      ...defaults,
      ...parsed,
      settings: { ...defaults.settings, ...(parsed.settings || {}) },
      accounts: parsed.accounts || defaults.accounts,
      trades: parsed.trades || defaults.trades,
    };
  } catch {
    return getDefaultState();
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save:', e);
  }
}

export function exportData(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `risk-sink-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
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

  // 3. MLL Management (20%) — how much buffer remains across accounts
  const totalMllRemaining = a.reduce((sum, acc) => {
    const journalPnl = getAccountPnl(trades, acc.slot);
    const totalPnl = (acc.startingPnl || 0) + journalPnl;
    const mllUsed = Math.max(0, -totalPnl);
    return sum + (s.mll - mllUsed);
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
  const mllUsed = Math.max(0, -totalPnl);
  const mllLeft = s.mll - mllUsed;
  const ptProgress = Math.max(0, totalPnl);
  const ptLeft = s.profitTarget - ptProgress;

  const entries = trades.flatMap(t => t.entries.filter(e => e.slot === account.slot && e.triggered && e.result));
  const wins = entries.filter(e => e.result === 'W');
  const slotWR = entries.length > 0 ? wins.length / entries.length : 0;

  return {
    journalPnl,
    totalPnl,
    mllUsed,
    mllLeft,
    mllPercent: (mllLeft / s.mll) * 100,
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
