// ── Risk Sink analytics ──
// Everything on the Risk Sink page derives from the three things Chesley logs
// per entry: W/L (+BE), instrument, R. Nothing here needs prices, times or tags.
//
// The central idea is a COUNTERFACTUAL. Every idea contains its own control
// group, because E1 is the entry you would have taken either way:
//
//   actual  — what all filled entries made (the sink)
//   copied  — the same budget, no stagger: E1's result × 3 accounts
//   single  — one account, E1 only
//
// "Copied" is the honest alternative for a 3-prop-account trader: instead of
// staggering E2/E3 deeper, copy the first entry to all three. The sink wins
// when price runs deeper then reverses (deeper fills carry more contracts →
// more R) and loses when E1 runs away and only one account got on.
import { getIdeaResult } from './store'

const DEFAULT_RISK = 200

// ── Per-idea breakdown ──
export function ideaBreakdown(trade, riskPerEntry = DEFAULT_RISK) {
  const entries = trade.entries || []
  const filled = entries.filter(e => e.triggered && e.result)
  if (filled.length === 0) return null
  const result = getIdeaResult(trade)
  if (!result) return null // incomplete idea

  const rOf = (e) => (e.result === 'W' ? (e.r || 0) : e.result === 'L' ? -1 : 0)
  const pnlOf = (e) => {
    if (typeof e.pnl === 'number' && e.pnl !== 0) return e.pnl
    // Fall back to the fixed-risk rule when $ wasn't logged (W = R×risk, L = −risk)
    return rOf(e) * riskPerEntry
  }

  const e1 = entries.find(e => e.slot === 1)
  const e1Filled = !!(e1 && e1.triggered && e1.result)
  const e1R = e1Filled ? rOf(e1) : 0
  const e1Pnl = e1Filled ? pnlOf(e1) : 0

  const actualR = filled.reduce((s, e) => s + rOf(e), 0)
  const actualPnl = filled.reduce((s, e) => s + pnlOf(e), 0)

  const perSlot = {}
  ;[1, 2, 3].forEach(slot => {
    const e = entries.find(x => x.slot === slot)
    const on = !!(e && e.triggered && e.result)
    perSlot[slot] = { filled: on, r: on ? rOf(e) : 0, pnl: on ? pnlOf(e) : 0, result: on ? e.result : null }
  })

  return {
    id: trade.id,
    date: trade.date,
    instrument: trade.instrument,
    result,
    depth: filled.length,
    slots: filled.map(e => e.slot).sort(),
    perSlot,
    e1Filled,
    actualR,
    actualPnl,
    copiedR: e1R * 3,
    copiedPnl: e1Pnl * 3,
    singleR: e1R,
    singlePnl: e1Pnl,
    liftR: actualR - e1R * 3,
    liftPnl: actualPnl - e1Pnl * 3,
    // Style-1 signature: E1 lost, a later entry won. Impossible with one
    // shared stop, so these ideas come from the re-entry era.
    rescue: e1Filled && e1R < 0 && filled.some(e => e.slot > 1 && e.result === 'W'),
  }
}

// ── Curves ──
function cumulative(values) {
  let c = 0
  return values.map(v => (c += v))
}

function drawdownOf(cum) {
  let peak = 0
  let maxDd = 0
  const under = cum.map(v => {
    peak = Math.max(peak, v)
    const dd = v - peak
    maxDd = Math.min(maxDd, dd)
    return dd
  })
  return { under, maxDd: -maxDd }
}

// ── Seeded PRNG (mulberry32) so resampling charts don't flicker between renders ──
function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function quantile(sorted, q) {
  if (!sorted.length) return 0
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

// ── Bootstrap band for cumulative lift ──
// Resample the ideas (with replacement) B times and track the cumulative
// lift path. If the 5th percentile stays above zero the lift is not luck.
export function bootstrapLift(ideas, { B = 1000, seed = 7, key = 'liftR' } = {}) {
  const n = ideas.length
  if (n === 0) return { band: [], pAbove: 0, finalP5: 0, finalP50: 0, finalP95: 0 }
  const rand = mulberry32(seed)
  const vals = ideas.map(i => i[key])
  // paths[k] = list of cumulative values at step k across B resamples
  const paths = Array.from({ length: n }, () => new Array(B))
  let positive = 0
  for (let b = 0; b < B; b++) {
    let c = 0
    for (let k = 0; k < n; k++) {
      c += vals[Math.floor(rand() * n)]
      paths[k][b] = c
    }
    if (c > 0) positive++
  }
  const band = paths.map((arr, k) => {
    const s = arr.slice().sort((a, b) => a - b)
    return { idx: k + 1, p5: quantile(s, 0.05), p50: quantile(s, 0.5), p95: quantile(s, 0.95) }
  })
  const last = band[band.length - 1]
  return { band, pAbove: positive / B, finalP5: last.p5, finalP50: last.p50, finalP95: last.p95 }
}

// ── Monte Carlo account survival ──
// Resample the next H ideas from history. Each of the 3 accounts carries its
// own equity curve: under the sink, account k gets slot k's result; under
// copied, every account gets E1's result. An account "busts" when its
// peak-to-trough drawdown reaches the MLL.
export function monteCarloSurvival(ideas, { horizon = 50, B = 1000, seed = 11, mll = 2000, riskPerEntry = DEFAULT_RISK } = {}) {
  const n = ideas.length
  if (n === 0) return null
  const rand = mulberry32(seed)
  const run = (mode) => {
    let anyBust = 0
    let bustCount = 0
    const finals = []
    const worstDds = []
    for (let b = 0; b < B; b++) {
      const eq = [0, 0, 0], peak = [0, 0, 0], bust = [false, false, false]
      let pooled = 0, pooledPeak = 0, pooledDd = 0
      for (let h = 0; h < horizon; h++) {
        const idea = ideas[Math.floor(rand() * n)]
        for (let a = 0; a < 3; a++) {
          const pnl = mode === 'sink' ? idea.perSlot[a + 1].pnl : idea.singlePnl
          eq[a] += pnl
          peak[a] = Math.max(peak[a], eq[a])
          if (!bust[a] && peak[a] - eq[a] >= mll) bust[a] = true
          pooled += pnl
        }
        pooledPeak = Math.max(pooledPeak, pooled)
        pooledDd = Math.max(pooledDd, pooledPeak - pooled)
      }
      const busted = bust.filter(Boolean).length
      if (busted > 0) anyBust++
      bustCount += busted
      finals.push(pooled)
      worstDds.push(pooledDd)
    }
    finals.sort((a, b) => a - b)
    worstDds.sort((a, b) => a - b)
    return {
      pAnyBust: anyBust / B,
      expectedBusts: bustCount / B,
      medianPnl: quantile(finals, 0.5),
      p10Pnl: quantile(finals, 0.1),
      p90Pnl: quantile(finals, 0.9),
      medianMaxDd: quantile(worstDds, 0.5),
      p90MaxDd: quantile(worstDds, 0.9),
    }
  }
  return { horizon, mll, sink: run('sink'), copied: run('copied') }
}

// ── The full report ──
export function calcRiskSinkReport(trades, settings = {}, opts = {}) {
  const riskPerEntry = settings.riskPerEntry || DEFAULT_RISK
  const { from = '', excludeRescues = false, window = 30 } = opts

  let ideas = (trades || [])
    .map(t => ideaBreakdown(t, riskPerEntry))
    .filter(Boolean)
    .filter(i => !from || i.date >= from)
  const rescuesFound = ideas.filter(i => i.rescue).length
  if (excludeRescues) ideas = ideas.filter(i => !i.rescue)
  ideas.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  const n = ideas.length
  const sum = (k) => ideas.reduce((s, i) => s + i[k], 0)

  const totals = {
    actualR: sum('actualR'), actualPnl: sum('actualPnl'),
    copiedR: sum('copiedR'), copiedPnl: sum('copiedPnl'),
    singleR: sum('singleR'), singlePnl: sum('singlePnl'),
  }
  totals.liftR = totals.actualR - totals.copiedR
  totals.liftPnl = totals.actualPnl - totals.copiedPnl
  totals.liftVsSingleR = totals.actualR - totals.singleR
  totals.liftVsSinglePnl = totals.actualPnl - totals.singlePnl
  totals.liftPerIdeaR = n ? totals.liftR / n : 0
  totals.liftPerIdeaPnl = n ? totals.liftPnl / n : 0

  // Equity + underwater curves, per idea
  const cumA = cumulative(ideas.map(i => i.actualPnl))
  const cumC = cumulative(ideas.map(i => i.copiedPnl))
  const cumS = cumulative(ideas.map(i => i.singlePnl))
  const cumL = cumulative(ideas.map(i => i.liftPnl))
  const cumAR = cumulative(ideas.map(i => i.actualR))
  const cumCR = cumulative(ideas.map(i => i.copiedR))
  const cumSR = cumulative(ideas.map(i => i.singleR))
  const cumLR = cumulative(ideas.map(i => i.liftR))
  const ddA = drawdownOf(cumA)
  const ddC = drawdownOf(cumC)
  const ddS = drawdownOf(cumS)
  const curve = ideas.map((i, k) => ({
    idx: k + 1,
    date: i.date,
    actual: cumA[k], copied: cumC[k], single: cumS[k], lift: cumL[k],
    actualR: cumAR[k], copiedR: cumCR[k], singleR: cumSR[k], liftR: cumLR[k],
    ddActual: ddA.under[k], ddCopied: ddC.under[k], ddSingle: ddS.under[k],
  }))

  // Rolling-window lift (matches the Risk Score's 30-idea window)
  const rolling = []
  for (let k = 0; k < n; k++) {
    const start = Math.max(0, k - window + 1)
    let lr = 0, lp = 0
    for (let j = start; j <= k; j++) { lr += ideas[j].liftR; lp += ideas[j].liftPnl }
    rolling.push({ idx: k + 1, date: ideas[k].date, liftR: lr, liftPnl: lp, full: k - start + 1 >= window })
  }

  // Fill funnel — how often each slot got on (of completed ideas)
  const funnel = [1, 2, 3].map(slot => {
    const c = ideas.filter(i => i.perSlot[slot].filled).length
    return { slot, count: c, pct: n ? c / n : 0 }
  })

  // Outcome by depth (1, 2 or 3 entries filled)
  const byDepth = [1, 2, 3].map(d => {
    const set = ideas.filter(i => i.depth === d)
    const wins = set.filter(i => i.result === 'WIN')
    const losses = set.filter(i => i.result === 'LOSS')
    const avgWinR = wins.length ? wins.reduce((s, i) => s + i.actualR, 0) / wins.length : 0
    const avgLossR = losses.length ? losses.reduce((s, i) => s + i.actualR, 0) / losses.length : 0
    const decisive = wins.length + losses.length
    const wr = decisive ? wins.length / decisive : 0
    // Break-even WR: p·avgWin + (1−p)·avgLoss = 0 → p = |avgLoss| / (avgWin + |avgLoss|)
    const breakEvenWR = avgWinR + Math.abs(avgLossR) > 0 ? Math.abs(avgLossR) / (avgWinR + Math.abs(avgLossR)) : 0
    return {
      depth: d,
      ideas: set.length,
      share: n ? set.length / n : 0,
      wins: wins.length,
      losses: losses.length,
      wr,
      avgWinR,
      avgLossR,
      avgR: set.length ? set.reduce((s, i) => s + i.actualR, 0) / set.length : 0,
      avgPnl: set.length ? set.reduce((s, i) => s + i.actualPnl, 0) / set.length : 0,
      totalPnl: set.reduce((s, i) => s + i.actualPnl, 0),
      liftPnl: set.reduce((s, i) => s + i.liftPnl, 0),
      breakEvenWR,
      edgeOverBreakEven: wr - breakEvenWR,
    }
  })

  // Per-slot R (winning R values only → "deeper = more R" evidence)
  const bySlot = [1, 2, 3].map(slot => {
    const fills = ideas.filter(i => i.perSlot[slot].filled).map(i => i.perSlot[slot])
    const wins = fills.filter(f => f.result === 'W')
    const losses = fills.filter(f => f.result === 'L')
    const winRs = wins.map(f => f.r)
    return {
      slot,
      fills: fills.length,
      wins: wins.length,
      losses: losses.length,
      wr: wins.length + losses.length ? wins.length / (wins.length + losses.length) : 0,
      avgWinR: winRs.length ? winRs.reduce((a, b) => a + b, 0) / winRs.length : 0,
      totalR: fills.reduce((s, f) => s + f.r, 0),
      totalPnl: fills.reduce((s, f) => s + f.pnl, 0),
      winRs,
    }
  })

  // R histogram per slot (wins only; bucket to 0.5R)
  const buckets = new Set()
  bySlot.forEach(s => s.winRs.forEach(r => buckets.add(Math.round(r * 2) / 2)))
  const rBuckets = [...buckets].sort((a, b) => a - b)
  const rHistogram = rBuckets.map(r => {
    const row = { r }
    bySlot.forEach(s => { row['E' + s.slot] = s.winRs.filter(x => Math.round(x * 2) / 2 === r).length })
    return row
  })

  // Cost-of-sink ledger: where the lift vs copied comes from
  const winners = ideas.filter(i => i.result === 'WIN')
  const losers = ideas.filter(i => i.result === 'LOSS')
  const ledger = {
    winnersLift: winners.reduce((s, i) => s + i.liftPnl, 0),
    losersLift: losers.reduce((s, i) => s + i.liftPnl, 0),
    // Split winners by whether the stagger helped or hurt
    deepWinnersLift: winners.filter(i => i.liftPnl > 0).reduce((s, i) => s + i.liftPnl, 0),
    deepWinners: winners.filter(i => i.liftPnl > 0).length,
    shallowWinnersLift: winners.filter(i => i.liftPnl < 0).reduce((s, i) => s + i.liftPnl, 0),
    shallowWinners: winners.filter(i => i.liftPnl < 0).length,
    neutralWinners: winners.filter(i => i.liftPnl === 0).length,
    losersSaved: losers.filter(i => i.liftPnl > 0).length,
    losersCost: losers.filter(i => i.liftPnl < 0).length,
  }

  // Per instrument
  const instMap = {}
  ideas.forEach(i => {
    const k = i.instrument || '—'
    if (!instMap[k]) instMap[k] = { instrument: k, ideas: 0, liftPnl: 0, liftR: 0, actualPnl: 0, copiedPnl: 0 }
    instMap[k].ideas++
    instMap[k].liftPnl += i.liftPnl
    instMap[k].liftR += i.liftR
    instMap[k].actualPnl += i.actualPnl
    instMap[k].copiedPnl += i.copiedPnl
  })
  const byInstrument = Object.values(instMap).sort((a, b) => b.liftPnl - a.liftPnl)

  return {
    n,
    ideas,
    rescuesFound,
    riskPerEntry,
    totals,
    curve,
    maxDd: { actual: ddA.maxDd, copied: ddC.maxDd, single: ddS.maxDd },
    rolling,
    funnel,
    byDepth,
    bySlot,
    rHistogram,
    ledger,
    byInstrument,
    usedLaterEntries: ideas.some(i => i.depth > 1),
  }
}
