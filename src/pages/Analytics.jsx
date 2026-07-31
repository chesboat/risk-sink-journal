import { useState } from 'react'
import { motion } from 'framer-motion'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, AreaChart, Area, ReferenceLine, ComposedChart } from 'recharts'
import { TrendingUp, Zap, Target, Smile, Shield, Info } from 'lucide-react'
import {
  calcStats,
  calcPooledHealth,
  calcTagStats,
  getIdeaResult,
  getAccountStats,
  getActiveManualAccounts,
  getArchivedManualAccounts,
  getStrategyAt,
  SESSIONS,
  SETUPS,
  EMOTIONS,
} from '../lib/store'

const COLORS = {
  green: '#30d158',
  red: '#ff453a',
  blue: '#0a84ff',
  orange: '#ff9f0a',
  teal: '#64d2ff',
}

const tabTransition = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.2, ease: 'easeOut' },
}

export default function Analytics({ state }) {
  const [activeTab, setActiveTab] = useState('overview')
  const [showPooledInfo, setShowPooledInfo] = useState(false)
  const [showMaxDdInfo, setShowMaxDdInfo] = useState(false)
  const [curveView, setCurveView] = useState('combined')

  // ── Date range ── every tab computes from rangedTrades so you can isolate
  // a single eval period. Pooled health stays all-time: trailing floors and
  // peaks are account state, not period stats.
  const [range, setRange] = useState('all') // 'week' | 'month' | 'all' | 'custom'
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const inRange = (t) => {
    if (range === 'week') {
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      return new Date(t.date + 'T00:00:00') >= weekAgo
    }
    if (range === 'month') {
      const now = new Date()
      const d = new Date(t.date + 'T00:00:00')
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }
    if (range === 'custom') {
      return (!customStart || t.date >= customStart) && (!customEnd || t.date <= customEnd)
    }
    return true
  }
  const rangedTrades = (state.trades || []).filter(inRange)
  const stats = calcStats(rangedTrades, 'all')

  // Format percentage
  const pct = (n) => {
    if (isNaN(n) || !isFinite(n)) return '0%'
    return `${Math.round(n * 100)}%`
  }

  // Format currency
  const fmt = (n) => {
    if (n >= 0) return `+$${Math.round(n)}`
    return `-$${Math.round(Math.abs(n))}`
  }

  // ════════════════════════════════════════════════════════════════════════
  // TAB 1: OVERVIEW
  // ════════════════════════════════════════════════════════════════════════
  const OverviewTab = () => {
    // R distribution histogram — only ideas that were actually traded to a
    // result. Untriggered / still-open ideas used to land in the '0' bucket
    // and masquerade as break-evens.
    const rBuckets = { '-3': 0, '-2': 0, '-1': 0, '0': 0, '1': 0, '2': 0, '3': 0, '4': 0, '5+': 0 }
    rangedTrades.filter(t => t.entries.some(e => e.triggered && e.result)).forEach(t => {
      const r = Math.round(t.entries.reduce((s, e) => {
        if (!e.triggered) return s
        if (e.result === 'W') return s + (e.r || 0)
        if (e.result === 'L') return s - 1
        return s
      }, 0))
      if (r <= -3) rBuckets['-3']++
      else if (r === -2) rBuckets['-2']++
      else if (r === -1) rBuckets['-1']++
      else if (r === 0) rBuckets['0']++
      else if (r === 1) rBuckets['1']++
      else if (r === 2) rBuckets['2']++
      else if (r === 3) rBuckets['3']++
      else if (r === 4) rBuckets['4']++
      else if (r >= 5) rBuckets['5+']++
    })
    const rChartData = Object.entries(rBuckets).map(([r, count]) => ({ r, count }))

    // Pooled Risk Sink Health — treats all 3 accounts as one system
    const pooled = calcPooledHealth(state.trades, state.accounts, state.settings)

    // Daily PnL chart
    const dailyChartData = stats.equityCurve.map(d => ({
      date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      pnl: d.daily,
    }))

    // Profit factor (standard definition): gross winning entry P&L divided by
    // gross losing entry P&L. The old version divided winning DAYS by losing
    // DAYS, which is a different (and unlabeled) statistic.
    const triggeredEntries = rangedTrades.flatMap(t => (t.entries || []).filter(e => e.triggered))
    const grossWin = triggeredEntries.reduce((s, e) => s + Math.max(0, e.pnl || 0), 0)
    const grossLoss = Math.abs(triggeredEntries.reduce((s, e) => s + Math.min(0, e.pnl || 0), 0))
    const profitFactor = grossLoss > 0 ? (grossWin / grossLoss).toFixed(2) : (grossWin > 0 ? '∞' : '0')

    return (
      <div className="space-y-6">
        {/* WR Comparison */}
        <div className="grid grid-cols-2 gap-4">
          <motion.div
            className="rounded-2xl p-6 border"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            {...tabTransition}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="text-sm font-medium text-white opacity-70 mb-1">Idea Win Rate</div>
                <div className="text-3xl font-bold text-white">{pct(stats.ideaWR)}</div>
              </div>
              <TrendingUp size={24} className="opacity-50" style={{ color: COLORS.green }} />
            </div>
            <div className="text-xs text-white opacity-50">{stats.ideaWins}W / {stats.ideaLosses}L · {stats.totalTrades} ideas</div>
          </motion.div>

          <motion.div
            className="rounded-2xl p-6 border"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            {...tabTransition}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="text-sm font-medium text-white opacity-70 mb-1">Entry Win Rate</div>
                <div className="text-3xl font-bold text-white">{pct(stats.entryWR)}</div>
              </div>
              <Zap size={24} className="opacity-50" style={{ color: COLORS.orange }} />
            </div>
            <div className="text-xs text-white opacity-50">{stats.entryWins}W / {stats.entryLosses}L{stats.entryBEs > 0 ? ` / ${stats.entryBEs}BE` : ''} · {stats.totalEntries} entries</div>
          </motion.div>
        </div>

        {/* Pooled Risk Sink Health */}
        <motion.div
          className="rounded-2xl p-6 border"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          {...tabTransition}
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Shield size={16} style={{ color: COLORS.blue }} />
                <h3 className="text-sm font-semibold text-white">Pooled Risk Sink Health</h3>
                <button
                  onClick={() => setShowPooledInfo(v => !v)}
                  className="opacity-50 hover:opacity-100 transition-opacity"
                  title="How is this calculated?"
                >
                  <Info size={14} className="text-white" />
                </button>
              </div>
              <div className="text-xs text-white opacity-50">
                All {pooled.perAccount.length} accounts treated as one system
                {range !== 'all' && <span className="opacity-70"> · always all-time (ignores date filter)</span>}
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold" style={{ color: pooled.combinedPnl >= 0 ? COLORS.green : COLORS.red }}>
                {fmt(pooled.combinedPnl)}
              </div>
              <div className="text-xs text-white opacity-50 mt-1">Combined P&L</div>
            </div>
          </div>

          {showPooledInfo && (
            <div
              className="rounded-xl p-4 mb-4 border text-xs text-white leading-relaxed"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <div className="font-semibold mb-2">Combined P&L</div>
              <div className="opacity-70 mb-1">Sum of each account's current P&L (startingPnl + triggered entry P&L).</div>
              <div className="font-mono opacity-60 mb-3">
                {pooled.perAccount.map((a, i) => (
                  <span key={a.id}>
                    {a.name} {fmt(a.totalPnl)}
                    {i < pooled.perAccount.length - 1 ? '  +  ' : '  =  '}
                  </span>
                ))}
                <span className="font-semibold">{fmt(pooled.combinedPnl)}</span>
              </div>

              <div className="font-semibold mb-2">Pooled MLL Headroom</div>
              <div className="opacity-70 mb-1">
                Sum of each account's <span className="font-semibold">distance-to-bust</span> (current P&L minus its trailing MLL floor, capped at ${pooled.perAccountMll} per account). This is the total dollar drawdown the system can absorb before ANY single account busts — losses on one account don't rescue another's floor.
              </div>
              <div className="font-mono opacity-60 mb-3">
                {pooled.perAccount.map((a, i) => (
                  <span key={a.id}>
                    {a.name} ${Math.round(Math.max(0, Math.min(pooled.perAccountMll, a.mllDistance))).toLocaleString()}
                    {i < pooled.perAccount.length - 1 ? '  +  ' : '  =  '}
                  </span>
                ))}
                <span className="font-semibold">${Math.round(pooled.pooledHeadroom).toLocaleString()}</span>
                <span className="opacity-50"> of ${pooled.pooledMll.toLocaleString()}</span>
              </div>

              <div className="font-semibold mb-2">Trailing MLL (per account)</div>
              <div className="opacity-70 mb-2">
                Each account's floor = min($0, peak P&L − ${pooled.perAccountMll.toLocaleString()}). The floor trails $-for-$ with profit and locks at $0 once peak hits +${pooled.perAccountMll.toLocaleString()}. Account busts the moment current P&L drops below its floor.
              </div>
              <div className="font-mono text-[11px] opacity-70 grid grid-cols-1 gap-0.5">
                {pooled.perAccount.map((a) => (
                  <div key={a.id} className="flex justify-between gap-4">
                    <span className="truncate">{a.name}</span>
                    <span>
                      Current <span style={{ color: a.totalPnl >= 0 ? COLORS.green : COLORS.red }}>{fmt(a.totalPnl)}</span>
                      {' · '}Peak <span style={{ color: COLORS.green }}>${Math.round(a.peak).toLocaleString()}</span>
                      {' · '}Floor <span style={{ color: COLORS.red }}>${Math.round(a.trailingFloor).toLocaleString()}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pooled MLL headroom bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-white opacity-60">Pooled MLL Headroom</span>
              <span className="font-mono text-white">
                {fmt(pooled.pooledHeadroom)} <span className="opacity-50">of ${pooled.pooledMll.toLocaleString()}</span>
              </span>
            </div>
            <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--surface)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.max(0, Math.min(100, pooled.pooledHeadroomPct))}%`,
                  background: pooled.pooledHeadroomPct > 66
                    ? COLORS.green
                    : pooled.pooledHeadroomPct > 33
                      ? COLORS.orange
                      : COLORS.red,
                }}
              />
            </div>
          </div>

          {/* Per-account divergence strip */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {pooled.perAccount.map((a) => {
              const isWorst = pooled.worst && pooled.worst.id === a.id && a.mllUsed > 0
              return (
                <div
                  key={a.id}
                  className="rounded-xl p-3 border"
                  style={{
                    background: 'var(--surface)',
                    borderColor: isWorst ? COLORS.orange : 'var(--border)',
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-[11px] text-white opacity-60 truncate">{a.name}</div>
                    {isWorst && <div className="text-[9px] font-semibold" style={{ color: COLORS.orange }}>WORST</div>}
                  </div>
                  <div className="text-lg font-bold font-mono mb-1" style={{ color: a.totalPnl >= 0 ? COLORS.green : COLORS.red }}>
                    {fmt(a.totalPnl)}
                  </div>
                  <div className="text-[10px] text-white opacity-50 font-mono">
                    Peak ${Math.round(a.peak).toLocaleString()} · Floor ${Math.round(a.trailingFloor).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-white opacity-50">
                    MLL used: {Math.round(a.mllUsedPct)}%
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex items-center justify-between text-xs text-white opacity-60 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
            <div>
              <span className="opacity-50">Best to payout: </span>
              <span className="font-semibold">{pooled.best ? `${pooled.best.name} (${Math.round(pooled.best.ptPct)}%)` : '—'}</span>
            </div>
            <div>
              <span className="opacity-50">Pooled payout target: </span>
              <span className="font-semibold">${pooled.pooledPt.toLocaleString()}</span>
            </div>
          </div>
        </motion.div>

        {/* Max Combined Drawdown */}
        <motion.div
          className="rounded-2xl p-6 border"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          {...tabTransition}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-2">
              <div>
                <h3 className="text-sm font-semibold text-white mb-1">Max Combined Drawdown</h3>
                <div className="text-xs text-white opacity-50">Deepest peak-to-trough the system has eaten</div>
              </div>
              <button
                onClick={() => setShowMaxDdInfo(!showMaxDdInfo)}
                className="p-1 rounded-full border-0 cursor-pointer transition-colors"
                style={{
                  background: showMaxDdInfo ? 'var(--blue)' : 'var(--surface)',
                  color: showMaxDdInfo ? '#fff' : 'var(--text-muted)',
                }}
                title="How is this calculated?"
              >
                <Info size={12} />
              </button>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold" style={{ color: pooled.maxDdPctOfPool < 33 ? COLORS.green : pooled.maxDdPctOfPool < 66 ? COLORS.orange : COLORS.red }}>
                -${Math.round(pooled.maxDd).toLocaleString()}
              </div>
              <div className="text-xs text-white opacity-50 mt-1">
                {Math.round(pooled.maxDdPctOfPool)}% of ${pooled.pooledMll.toLocaleString()} pool
              </div>
            </div>
          </div>

          {showMaxDdInfo && (
            <div
              className="mb-4 p-3 rounded-xl text-xs"
              style={{ background: 'var(--surface)', color: 'var(--text-dim)' }}
            >
              <div className="font-semibold mb-2" style={{ color: 'var(--text)' }}>
                How this is calculated
              </div>
              <div className="mb-2">
                The deepest peak-to-trough dollar drop of the combined equity curve (all {(pooled.perAccount || []).length} accounts summed chronologically).
              </div>
              {pooled.maxDd > 0 ? (
                <div className="font-mono text-[11px] mb-2 p-2 rounded" style={{ background: 'var(--card)' }}>
                  <div>
                    Peak: <span style={{ color: 'var(--green)' }}>${Math.round(pooled.maxDdPeak).toLocaleString()}</span>
                    {pooled.maxDdPeakAt && <span className="opacity-60"> on {pooled.maxDdPeakAt}</span>}
                  </div>
                  <div>
                    Trough: <span style={{ color: 'var(--red)' }}>${Math.round(pooled.maxDdPeak - pooled.maxDd).toLocaleString()}</span>
                    {pooled.maxDdAt && <span className="opacity-60"> on {pooled.maxDdAt}</span>}
                  </div>
                  <div className="mt-1 pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
                    Drop: <span style={{ color: 'var(--red)', fontWeight: 700 }}>-${Math.round(pooled.maxDd).toLocaleString()}</span>
                    {' '}= <span style={{ color: 'var(--orange)' }}>{Math.round(pooled.maxDdPctOfPool)}%</span> of ${pooled.pooledMll.toLocaleString()} pool
                  </div>
                </div>
              ) : (
                <div className="opacity-60 italic">No drawdown recorded yet — combined curve has not dropped below its peak.</div>
              )}
              <div className="opacity-70">
                This is a <span className="font-semibold">system-wide</span> metric: a $500 drop on one account offset by a $500 gain on another contributes $0 to the combined drawdown. Individual account busts are tracked separately via trailing MLL.
              </div>
            </div>
          )}

          <div className="h-3 rounded-full overflow-hidden mb-2" style={{ background: 'var(--surface)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.max(0, Math.min(100, pooled.maxDdPctOfPool))}%`,
                background: pooled.maxDdPctOfPool < 33 ? COLORS.green : pooled.maxDdPctOfPool < 66 ? COLORS.orange : COLORS.red,
              }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-white opacity-50">
            <span>Safe</span>
            <span>Danger</span>
            <span>Blown</span>
          </div>
          {(pooled.maxDdAt || pooled.maxDdDays > 0) && (
            <div className="text-xs text-white opacity-60 mt-3 pt-3 border-t flex flex-wrap gap-x-4 gap-y-1" style={{ borderColor: 'var(--border)' }}>
              {pooled.maxDdAt && <span>Trough on <span className="font-mono">{pooled.maxDdAt}</span></span>}
              {pooled.maxDdDays > 0 && <span>Longest underwater: <span className="font-mono">{pooled.maxDdDays}d</span></span>}
              {pooled.currentUnderwaterDays > 0 && (
                <span style={{ color: COLORS.orange }}>Currently underwater: <span className="font-mono">{pooled.currentUnderwaterDays}d</span></span>
              )}
            </div>
          )}
        </motion.div>

        {/* Equity Curve + Trailing Floor */}
        {(() => {
          const curveOptions = [
            { id: 'combined', label: 'Combined' },
            ...(pooled.accountCurves || []).map((c) => ({ id: c.id, label: c.name })),
          ]
          const selected = curveView === 'combined'
            ? {
                label: 'Combined',
                points: (pooled.curve || []).map((p, i) => ({
                  date: p.date || `T${i}`,
                  pnl: p.combined,
                  floor: p.floor,
                })),
                currentPnl: pooled.combinedPnl,
                peak: pooled.currentCombinedPeak,
                peakAt: pooled.currentCombinedPeakAt,
                floor: (pooled.curve && pooled.curve.length > 0)
                  ? pooled.curve[pooled.curve.length - 1].floor
                  : 0,
                mllInitial: pooled.pooledMll,
              }
            : (() => {
                const src = (pooled.accountCurves || []).find((c) => c.id === curveView)
                if (!src) return null
                const last = src.points[src.points.length - 1] || { pnl: 0, peak: 0, floor: 0 }
                const peakPoint = src.points.reduce((acc, p) => (p.peak > acc.peak ? p : acc), src.points[0] || { peak: 0 })
                const acct = (pooled.perAccount || []).find((a) => a.id === curveView)
                return {
                  label: src.name,
                  points: src.points.map((p, i) => ({
                    date: p.date || `T${i}`,
                    pnl: p.pnl,
                    floor: p.floor,
                  })),
                  currentPnl: last.pnl,
                  peak: last.peak,
                  peakAt: peakPoint.date,
                  floor: last.floor,
                  mllInitial: (pooled.pooledMll / (pooled.perAccount.length || 1)),
                  mllDistance: acct ? acct.mllDistance : 0,
                  mllUsedPct: acct ? acct.mllUsedPct : 0,
                }
              })()
          if (!selected) return null
          const distanceToBust = curveView === 'combined'
            ? pooled.pooledHeadroom
            : selected.mllDistance
          const mllPctLeft = curveView === 'combined'
            ? pooled.pooledHeadroomPct
            : Math.max(0, 100 - (selected.mllUsedPct || 0))
          return (
            <motion.div
              className="rounded-2xl p-6 border"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
              {...tabTransition}
            >
              <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
                <div>
                  <h3 className="text-sm font-semibold text-white mb-1">
                    Equity Curve + Trailing Floor
                  </h3>
                  <div className="text-xs text-white opacity-50">
                    P&amp;L over time with the trailing MLL floor overlaid. Bust happens when the curve crosses the floor.
                  </div>
                </div>
                <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: 'var(--surface)' }}>
                  {curveOptions.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setCurveView(opt.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border-0 cursor-pointer transition-colors"
                      style={{
                        background: curveView === opt.id ? COLORS.blue : 'transparent',
                        color: curveView === opt.id ? '#fff' : 'var(--text-muted)',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="rounded-lg p-3" style={{ background: 'var(--surface)' }}>
                  <div className="text-[10px] uppercase tracking-wider text-white opacity-50">Current</div>
                  <div className="text-lg font-bold font-mono" style={{ color: selected.currentPnl >= 0 ? COLORS.green : COLORS.red }}>
                    {fmt(selected.currentPnl)}
                  </div>
                </div>
                <div className="rounded-lg p-3" style={{ background: 'var(--surface)' }}>
                  <div className="text-[10px] uppercase tracking-wider text-white opacity-50">Peak</div>
                  <div className="text-lg font-bold font-mono" style={{ color: COLORS.green }}>
                    ${Math.round(selected.peak || 0).toLocaleString()}
                  </div>
                  {selected.peakAt && (
                    <div className="text-[10px] text-white opacity-40 font-mono">{selected.peakAt}</div>
                  )}
                </div>
                <div className="rounded-lg p-3" style={{ background: 'var(--surface)' }}>
                  <div className="text-[10px] uppercase tracking-wider text-white opacity-50">Floor</div>
                  <div className="text-lg font-bold font-mono" style={{ color: COLORS.red }}>
                    ${Math.round(selected.floor || 0).toLocaleString()}
                  </div>
                </div>
                <div className="rounded-lg p-3" style={{ background: 'var(--surface)' }}>
                  <div className="text-[10px] uppercase tracking-wider text-white opacity-50">To Bust</div>
                  <div className="text-lg font-bold font-mono" style={{ color: mllPctLeft > 66 ? COLORS.green : mllPctLeft > 33 ? COLORS.orange : COLORS.red }}>
                    ${Math.round(distanceToBust || 0).toLocaleString()}
                  </div>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={selected.points} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                  <defs>
                    <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COLORS.blue} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={COLORS.blue} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" stroke="var(--text-muted)" style={{ fontSize: '11px' }} />
                  <YAxis stroke="var(--text-muted)" style={{ fontSize: '11px' }} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
                  <Tooltip
                    contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)' }}
                    formatter={(value, name) => [fmt(value), name === 'pnl' ? 'P&L' : 'Floor']}
                  />
                  <ReferenceLine y={0} stroke="var(--text-muted)" strokeDasharray="2 2" />
                  <Area
                    type="monotone"
                    dataKey="pnl"
                    stroke={COLORS.blue}
                    strokeWidth={2}
                    fill="url(#pnlGrad)"
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="floor"
                    stroke={COLORS.red}
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 text-[11px] text-white opacity-60 mt-2">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-0.5" style={{ background: COLORS.blue }} />
                  P&amp;L
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-0.5 border-t border-dashed" style={{ borderColor: COLORS.red, borderTopWidth: '2px' }} />
                  Trailing floor (bust line)
                </span>
              </div>
            </motion.div>
          )
        })()}

        {/* R Distribution */}
        <motion.div
          className="rounded-2xl p-6 border"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          {...tabTransition}
        >
          <h3 className="text-sm font-semibold text-white mb-4">R Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={rChartData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
              <XAxis dataKey="r" stroke="var(--text-muted)" style={{ fontSize: '12px' }} />
              <YAxis stroke="var(--text-muted)" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)' }}
                cursor={{ fill: 'rgba(10,132,255,0.1)' }}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {rChartData.map((entry, i) => {
                  const isLoss = entry.r.startsWith('-')
                  const isZero = entry.r === '0'
                  return <Cell key={i} fill={isLoss ? COLORS.red : isZero ? '#8e8e93' : COLORS.green} />
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Daily P&L & Profit Factor */}
        <div className="grid grid-cols-3 gap-4">
          <motion.div
            className="rounded-2xl p-6 border col-span-2"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            {...tabTransition}
          >
            <h3 className="text-sm font-semibold text-white mb-4">Daily P&L</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dailyChartData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                <XAxis dataKey="date" stroke="var(--text-muted)" style={{ fontSize: '11px' }} />
                <YAxis stroke="var(--text-muted)" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)' }}
                  formatter={(value) => fmt(value)}
                  cursor={{ fill: 'rgba(10,132,255,0.1)' }}
                />
                <Bar
                  dataKey="pnl"
                  fill={COLORS.blue}
                  radius={[4, 4, 0, 0]}
                  shape={<CustomBar />}
                />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div
            className="rounded-2xl p-6 border flex flex-col justify-center"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            {...tabTransition}
          >
            <div className="text-xs font-medium text-white opacity-60 mb-2">Profit Factor</div>
            <div className="text-4xl font-bold text-white mb-4">{profitFactor}</div>
            <div className="text-xs text-white opacity-50">Total R: {Math.round(stats.totalR)}</div>
            <div className="text-xs text-white opacity-50 mt-1">Total P&L: {fmt(stats.totalPnl)}</div>
            <div className="border-t mt-3 pt-3 space-y-1" style={{ borderColor: 'var(--border)' }}>
              <div className="text-xs text-white opacity-50">
                Expectancy: <span className="font-semibold" style={{ color: stats.expectancyPnl >= 0 ? COLORS.green : COLORS.red }}>{fmt(stats.expectancyPnl)}</span> / idea
              </div>
              <div className="text-xs text-white opacity-50">
                Avg win {fmt(stats.avgWinPnl)} · avg loss {fmt(-stats.avgLossPnl)}
              </div>
              <div className="text-xs text-white opacity-50">
                Payoff ratio: {stats.payoffRatio === Infinity ? '∞' : (stats.payoffRatio || 0).toFixed(2)}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════
  // TAB 2: BY ENTRY
  // ════════════════════════════════════════════════════════════════════════
  const ByEntryTab = () => {
    const entryColors = ['#30d158', '#ff9f0a', '#64d2ff']
    const entryLabels = ['E1 · 3R', 'E2 · 4R', 'E3 · 5R']

    const chartData = stats.byEntry.map((e, i) => ({
      name: entryLabels[i],
      wr: Math.round(e.wr * 100),
      r: e.totalR,
      pnl: e.totalPnl,
      trades: e.trades,
    }))

    return (
      <div className="space-y-6">
        {/* Entry Cards */}
        <div className="grid grid-cols-3 gap-4">
          {stats.byEntry.map((entry, i) => {
            const avgRPerWin = entry.wins > 0 ? (entry.totalR / entry.wins).toFixed(2) : '0'
            return (
              <motion.div
                key={i}
                className="rounded-2xl p-6 border"
                style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
                {...tabTransition}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-white">{entryLabels[i]}</h3>
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ background: entryColors[i] }}
                  />
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-white opacity-60">Win Rate</div>
                    <div className="text-2xl font-bold text-white">{pct(entry.wr)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-white opacity-60">Trades</div>
                    <div className="text-lg font-semibold text-white">{entry.trades}</div>
                  </div>
                  <div>
                    <div className="text-xs text-white opacity-60">Total R</div>
                    <div className="text-lg font-semibold text-white">{Math.round(entry.totalR)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-white opacity-60">Total P&L</div>
                    <div className="text-lg font-semibold" style={{ color: entry.totalPnl >= 0 ? COLORS.green : COLORS.red }}>
                      {fmt(entry.totalPnl)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-white opacity-60">Avg R/Win</div>
                    <div className="text-lg font-semibold text-white">{avgRPerWin}R</div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Comparison Chart */}
        <motion.div
          className="rounded-2xl p-6 border"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          {...tabTransition}
        >
          <h3 className="text-sm font-semibold text-white mb-4">Comparison</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 80 }}>
              <XAxis dataKey="name" stroke="var(--text-muted)" style={{ fontSize: '12px' }} />
              <YAxis yAxisId="left" stroke="var(--text-muted)" style={{ fontSize: '12px' }} />
              <YAxis yAxisId="right" orientation="right" stroke="var(--text-muted)" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)' }}
              />
              <Bar yAxisId="left" dataKey="wr" fill={COLORS.blue} radius={[6, 6, 0, 0]} />
              <Bar yAxisId="right" dataKey="trades" fill={COLORS.orange} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════
  // TAB 3: BY SESSION
  // ════════════════════════════════════════════════════════════════════════
  const BySessionTab = () => {
    const sessionData = stats.bySession.map(s => ({
      ...s,
      wrPercent: Math.round(s.wr * 100),
    }))

    // Short labels must stay distinct — splitting on the first word collapsed
    // "New York AM" and "New York PM" into two identical "New" bars.
    const SESSION_SHORT = { 'New York AM': 'NY AM', 'New York PM': 'NY PM' }
    const chartData = sessionData.map(s => ({
      name: SESSION_SHORT[s.session] || s.session,
      wr: Math.round(s.wr * 100),
      ideas: s.ideas,
    }))

    return (
      <div className="space-y-6">
        {/* Session Cards/Table */}
        <motion.div className="space-y-2" {...tabTransition}>
          {sessionData.length === 0 ? (
            <div className="rounded-2xl p-8 border text-center" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
              <div className="text-sm text-white opacity-50">No session data yet</div>
            </div>
          ) : (
            sessionData.map((session, i) => (
              <div
                key={i}
                className="rounded-xl p-4 border flex items-center justify-between"
                style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
              >
                <div className="flex-1">
                  <div className="text-sm font-medium text-white mb-1">{session.session}</div>
                  <div className="text-xs text-white opacity-50">{session.ideas} completed</div>
                </div>
                <div className="flex gap-6">
                  <div className="text-right">
                    <div className="text-xs text-white opacity-60">Win Rate</div>
                    <div className="text-lg font-semibold text-white">{pct(session.wr)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-white opacity-60">P&L</div>
                    <div
                      className="text-lg font-semibold"
                      style={{ color: session.pnl >= 0 ? COLORS.green : COLORS.red }}
                    >
                      {fmt(session.pnl)}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </motion.div>

        {/* Session Comparison Chart */}
        {sessionData.length > 0 && (
          <motion.div
            className="rounded-2xl p-6 border"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            {...tabTransition}
          >
            <h3 className="text-sm font-semibold text-white mb-4">Session Performance</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 60 }}>
                <XAxis dataKey="name" stroke="var(--text-muted)" style={{ fontSize: '12px' }} />
                <YAxis stroke="var(--text-muted)" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)' }}
                />
                <Bar dataKey="wr" fill={COLORS.blue} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        )}
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════
  // TAB 4: BY SETUP
  // ════════════════════════════════════════════════════════════════════════
  const BySetupTab = () => {
    const setupData = stats.bySetup.filter(s => s.trades > 0)

    return (
      <div className="space-y-6">
        {setupData.length === 0 ? (
          <div className="rounded-2xl p-8 border text-center" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="text-sm text-white opacity-50">No setup data yet</div>
          </div>
        ) : (
          <>
            {/* Setup Cards */}
            <motion.div className="grid gap-3" {...tabTransition}>
              {setupData.map((setup, i) => {
                const wr = setup.trades > 0 ? setup.wins / setup.trades : 0
                return (
                  <div
                    key={i}
                    className="rounded-xl p-4 border flex items-center justify-between"
                    style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
                  >
                    <div className="flex-1">
                      <div className="text-sm font-medium text-white mb-1">{setup.setup}</div>
                      <div className="text-xs text-white opacity-50">{setup.trades} trades</div>
                    </div>
                    <div className="flex gap-6">
                      <div className="text-right">
                        <div className="text-xs text-white opacity-60">Win Rate</div>
                        <div className="text-lg font-semibold text-white">{pct(wr)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-white opacity-60">Total R</div>
                        <div className="text-lg font-semibold text-white">{Math.round(setup.totalR)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-white opacity-60">P&L</div>
                        <div
                          className="text-lg font-semibold"
                          style={{ color: setup.pnl >= 0 ? COLORS.green : COLORS.red }}
                        >
                          {fmt(setup.pnl)}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </motion.div>

            {/* Setup P&L Chart (sorted descending) */}
            <motion.div
              className="rounded-2xl p-6 border"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
              {...tabTransition}
            >
              <h3 className="text-sm font-semibold text-white mb-4">P&L by Setup</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={setupData} margin={{ top: 20, right: 20, left: 0, bottom: 80 }}>
                  <XAxis dataKey="setup" stroke="var(--text-muted)" style={{ fontSize: '11px' }} angle={-45} textAnchor="end" height={100} />
                  <YAxis stroke="var(--text-muted)" style={{ fontSize: '12px' }} />
                  <Tooltip
                    contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)' }}
                    formatter={(value) => fmt(value)}
                  />
                  <Bar
                    dataKey="pnl"
                    fill={COLORS.blue}
                    radius={[6, 6, 0, 0]}
                    shape={<CustomBar />}
                  />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
          </>
        )}
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════
  // TAB 5: STREAKS
  // ════════════════════════════════════════════════════════════════════════
  const StreaksTab = () => {
    const results = rangedTrades
      .filter(t => {
        const triggered = t.entries.filter(e => e.triggered)
        return triggered.length > 0 && triggered.some(e => e.result)
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(t => getIdeaResult(t))
      .filter(r => r !== null)

    const currentColor = stats.currentStreak > 0 ? COLORS.green : stats.currentStreak < 0 ? COLORS.red : '#888'
    const currentLabel = stats.currentStreak > 0 ? `Win Streak` : stats.currentStreak < 0 ? 'Loss Streak' : 'No Streak'

    return (
      <div className="space-y-6">
        {/* Streak Cards */}
        <div className="grid grid-cols-3 gap-4">
          <motion.div
            className="rounded-2xl p-6 border"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            {...tabTransition}
          >
            <div className="text-xs font-medium text-white opacity-60 mb-2">{currentLabel}</div>
            <div className="text-4xl font-bold text-white mb-2" style={{ color: currentColor }}>
              {Math.abs(stats.currentStreak)}
            </div>
            <div className="text-xs text-white opacity-50">Current</div>
          </motion.div>

          <motion.div
            className="rounded-2xl p-6 border"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            {...tabTransition}
          >
            <div className="text-xs font-medium text-white opacity-60 mb-2">Best Win Streak</div>
            <div className="text-4xl font-bold text-white mb-2" style={{ color: COLORS.green }}>
              {stats.bestWinStreak}
            </div>
            <div className="text-xs text-white opacity-50">All-time</div>
          </motion.div>

          <motion.div
            className="rounded-2xl p-6 border"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            {...tabTransition}
          >
            <div className="text-xs font-medium text-white opacity-60 mb-2">Worst Loss Streak</div>
            <div className="text-4xl font-bold text-white mb-2" style={{ color: COLORS.red }}>
              {stats.worstLossStreak}
            </div>
            <div className="text-xs text-white opacity-50">All-time</div>
          </motion.div>
        </div>

        {/* Timeline Visualization */}
        <motion.div
          className="rounded-2xl p-6 border"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          {...tabTransition}
        >
          <h3 className="text-sm font-semibold text-white mb-4">Trade Timeline</h3>
          {results.length === 0 ? (
            <div className="text-xs text-white opacity-50 py-8 text-center">No completed trades yet</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {results.map((result, i) => (
                <motion.div
                  key={i}
                  className="w-4 h-4 rounded-full"
                  style={{
                    background: result === 'WIN' ? COLORS.green : result === 'LOSS' ? COLORS.red : '#8e8e93',
                  }}
                  whileHover={{ scale: 1.3 }}
                  title={`Trade ${i + 1}: ${result}`}
                />
              ))}
            </div>
          )}
        </motion.div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════
  // TAB 6: EMOTIONS
  // ════════════════════════════════════════════════════════════════════════
  const EmotionsTab = () => {
    const emotionData = stats.byEmotion

    // Find best emotion — require a minimum sample so one lucky "Revenge"
    // trade can't be crowned the optimal state over 40 calm trades.
    const MIN_EMOTION_SAMPLE = 3
    const qualified = emotionData.filter(e => e.trades >= MIN_EMOTION_SAMPLE)
    const bestEmotion = qualified.length > 0
      ? qualified.reduce((prev, current) => (prev.wr > current.wr ? prev : current))
      : null

    const chartData = emotionData.map(e => ({
      emotion: e.emotion,
      wr: Math.round(e.wr * 100),
    }))

    return (
      <div className="space-y-6">
        {emotionData.length === 0 ? (
          <div className="rounded-2xl p-8 border text-center" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="text-sm text-white opacity-50">No emotion data yet</div>
          </div>
        ) : (
          <>
            {/* Emotion Table */}
            <motion.div className="space-y-2" {...tabTransition}>
              {emotionData.map((emotion, i) => (
                <div
                  key={i}
                  className="rounded-xl p-4 border flex items-center justify-between"
                  style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
                >
                  <div className="flex-1">
                    <div className="text-sm font-medium text-white mb-1">{emotion.emotion}</div>
                    <div className="text-xs text-white opacity-50">{emotion.trades} trades</div>
                  </div>
                  <div className="flex gap-6">
                    <div className="text-right">
                      <div className="text-xs text-white opacity-60">Win Rate</div>
                      <div className="text-lg font-semibold text-white">{pct(emotion.wr)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-white opacity-60">Avg P&L</div>
                      <div
                        className="text-lg font-semibold"
                        style={{ color: emotion.pnl / emotion.trades >= 0 ? COLORS.green : COLORS.red }}
                      >
                        {fmt(emotion.pnl / emotion.trades)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>

            {/* WR by Emotion Chart */}
            <motion.div
              className="rounded-2xl p-6 border"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
              {...tabTransition}
            >
              <h3 className="text-sm font-semibold text-white mb-4">Win Rate by Emotion</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 80 }}>
                  <XAxis dataKey="emotion" stroke="var(--text-muted)" style={{ fontSize: '11px' }} angle={-45} textAnchor="end" height={100} />
                  <YAxis stroke="var(--text-muted)" style={{ fontSize: '12px' }} />
                  <Tooltip
                    contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)' }}
                  />
                  <Bar dataKey="wr" fill={COLORS.blue} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Insight Card */}
            {bestEmotion && (
              <motion.div
                className="rounded-2xl p-6 border flex items-start gap-4"
                style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
                {...tabTransition}
              >
                <Smile size={24} className="flex-shrink-0 mt-1" style={{ color: COLORS.teal }} />
                <div>
                  <div className="text-sm font-semibold text-white mb-1">Optimal State</div>
                  <div className="text-sm text-white opacity-70">
                    You trade best when <span className="font-semibold text-white">{bestEmotion.emotion}</span> —{' '}
                    <span className="text-white opacity-90">{pct(bestEmotion.wr)}</span> win rate with {bestEmotion.trades} trades.
                  </div>
                </div>
              </motion.div>
            )}
          </>
        )}
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════
  // TAB 7: TAGS
  // ════════════════════════════════════════════════════════════════════════
  const TagsTab = () => {
    const tagStats = calcTagStats(rangedTrades)

    if (tagStats.length === 0) {
      return (
        <div className="rounded-2xl p-8 border text-center" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="text-sm text-white opacity-50">No tagged trades in this period yet</div>
          <div className="text-xs text-white opacity-40 mt-1">Tag mistakes, confirmations, and conditions when logging trades to see which ones make or cost you money.</div>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        {tagStats.map(cat => (
          <motion.div
            key={cat.key}
            className="rounded-2xl p-6 border"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            {...tabTransition}
          >
            <div className="flex items-baseline justify-between mb-4">
              <h3 className="text-sm font-semibold" style={{ color: cat.color }}>{cat.label}</h3>
              {cat.key === 'mistakes' && (
                <span className="text-[11px] text-white opacity-40">ranked by damage</span>
              )}
            </div>
            <div className="space-y-2">
              {cat.tags.map(t => (
                <div
                  key={t.tag}
                  className="rounded-xl p-3 flex items-center justify-between gap-4"
                  style={{ background: 'var(--surface)' }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{t.tag}</div>
                    <div className="text-[11px] text-white opacity-50">{t.ideas} idea{t.ideas === 1 ? '' : 's'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-white opacity-50">WR</div>
                    <div className="text-sm font-semibold text-white">{pct(t.wr)}</div>
                  </div>
                  <div className="text-right w-20">
                    <div className="text-[11px] text-white opacity-50">Net P&L</div>
                    <div className="text-sm font-semibold" style={{ color: t.pnl >= 0 ? COLORS.green : COLORS.red }}>
                      {fmt(t.pnl)}
                    </div>
                  </div>
                  <div className="text-right w-20">
                    <div className="text-[11px] text-white opacity-50">Avg / idea</div>
                    <div className="text-sm font-mono" style={{ color: t.avgPnl >= 0 ? COLORS.green : COLORS.red }}>
                      {fmt(t.avgPnl)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {cat.key === 'mistakes' && cat.tags.some(t => t.pnl < 0) && (
              <div className="text-xs text-white opacity-60 mt-4 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                Ideas tagged <span className="font-semibold">{cat.tags[0].tag}</span> have cost you{' '}
                <span className="font-semibold" style={{ color: COLORS.red }}>{fmt(cat.tags[0].pnl)}</span> — the single most expensive habit in this period.
              </div>
            )}
          </motion.div>
        ))}
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════
  // TAB 8: ACCOUNTS — active vs archived eras, side by side
  // ════════════════════════════════════════════════════════════════════════
  const AccountsTab = () => {
    const active = getActiveManualAccounts(state.accounts || [])
    const archived = getArchivedManualAccounts(state.accounts || [])
    const all = [...active, ...archived]

    if (all.length === 0) {
      return (
        <div className="rounded-2xl p-8 border text-center" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="text-sm text-white opacity-50">No manual accounts yet</div>
        </div>
      )
    }

    return (
      <motion.div
        className="rounded-2xl border overflow-hidden"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        {...tabTransition}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--surface)' }}>
              {['Account', 'Entries', 'Win Rate', 'PF', 'Exp / entry', 'Journal P&L', 'Total P&L', 'Max DD', 'PT', 'MLL Used'].map((h, i) => (
                <th key={h} className={`px-3 py-3 text-xs font-semibold text-white opacity-60 ${i === 0 ? 'text-left' : 'text-right'}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {all.map(a => {
              const s = getAccountStats(a, rangedTrades, state.settings)
              return (
                <tr key={a.id} style={{ borderTop: '1px solid var(--border)', opacity: a.archived ? 0.65 : 1 }}>
                  <td className="px-4 py-3">
                    <div className="text-white font-medium">
                      {a.name}
                      {a.archived && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded uppercase font-semibold" style={{ background: 'var(--surface)', color: 'var(--text-dim)' }}>
                          archived
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-white opacity-40">
                      E{Number(String(a.slot).replace(/^E/i, '')) || '?'}
                      {a.activeFrom ? ` · from ${a.activeFrom}` : ''}
                      {a.archivedAt ? ` · to ${a.archivedAt.slice(0, 10)}` : ''}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right text-white">{s.totalEntries}</td>
                  <td className="px-3 py-3 text-right text-white">{pct(s.slotWR)}</td>
                  <td className="px-3 py-3 text-right font-mono" style={{ color: s.profitFactor >= 1 ? COLORS.green : s.totalEntries > 0 ? COLORS.red : 'var(--text-dim)' }}>
                    {s.totalEntries === 0 ? '—' : s.profitFactor === Infinity ? '∞' : s.profitFactor.toFixed(2)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono" style={{ color: s.expectancyPerEntry >= 0 ? COLORS.green : COLORS.red }}>
                    {s.totalEntries === 0 ? '—' : fmt(s.expectancyPerEntry)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono" style={{ color: s.journalPnl >= 0 ? COLORS.green : COLORS.red }}>
                    {fmt(s.journalPnl)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono font-semibold" style={{ color: s.totalPnl >= 0 ? COLORS.green : COLORS.red }}>
                    {fmt(s.totalPnl)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono" style={{ color: s.maxDrawdown > 0 ? COLORS.red : 'var(--text-dim)' }}>
                    {s.maxDrawdown > 0 ? `-$${Math.round(s.maxDrawdown)}` : '—'}
                  </td>
                  <td className="px-3 py-3 text-right text-white">{Math.round(s.ptPercent || 0)}%</td>
                  <td className="px-3 py-3 text-right" style={{ color: s.mllPercent > 50 ? COLORS.green : s.mllPercent > 25 ? COLORS.orange : COLORS.red }}>
                    {Math.round(100 - (s.mllPercent || 0))}%
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="px-4 py-2.5 text-[11px] text-white opacity-40 leading-relaxed" style={{ background: 'var(--surface)' }}>
          Each account only counts trades from its own era (archived accounts keep their history).
          Journal P&L, PF, expectancy, and Max DD respect the date filter; Total P&L adds the account's starting P&L.
          <br />
          Remember these accounts aren't independent: E2 only fires after E1 stops out, and E3 after E2 —
          so E2/E3's PF and win rate measure what <span className="font-semibold">re-entries</span> earn, not standalone account skill.
        </div>
      </motion.div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════
  // TAB 9: STRATEGIES — bot performance resolved from the assignment timeline
  // ════════════════════════════════════════════════════════════════════════
  const StrategiesTab = () => {
    const localDateStr = (ts) => {
      const d = new Date(ts)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
    const bts = (state.botTrades || []).filter(bt => inRange({ date: localDateStr(bt.exit_ts) }))
    const assignments = state.strategyAssignments || []

    if (bts.length === 0) {
      return (
        <div className="rounded-2xl p-8 border text-center" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="text-sm text-white opacity-50">No bot trades in this period</div>
          <div className="text-xs text-white opacity-40 mt-1">
            Import broker CSVs on the Import Bot page — each trade is attributed to whichever
            strategy was assigned to its account at exit time.
          </div>
        </div>
      )
    }

    const net = (t) => (Number(t.pnl) || 0) - (Number(t.fees) || 0)
    const byStrategy = {}
    bts.forEach(bt => {
      const a = getStrategyAt(assignments, bt.account_id, bt.exit_ts)
      const name = a?.strategyName || 'Unassigned'
      if (!byStrategy[name]) byStrategy[name] = []
      byStrategy[name].push(bt)
    })
    const rows = Object.entries(byStrategy).map(([name, trades]) => {
      const sorted = [...trades].sort((x, y) => new Date(x.exit_ts) - new Date(y.exit_ts))
      const wins = sorted.filter(t => net(t) > 0).length
      const total = sorted.reduce((s, t) => s + net(t), 0)
      let cum = 0
      const curve = sorted.map((t, i) => ({ i, y: (cum += net(t)) }))
      return { name, count: sorted.length, wins, wr: wins / sorted.length, total, avg: total / sorted.length, curve }
    }).sort((a, b) => b.total - a.total)

    return (
      <div className="space-y-3">
        {rows.map(r => (
          <motion.div
            key={r.name}
            className="rounded-2xl p-4 border flex items-center gap-4"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            {...tabTransition}
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white truncate">{r.name}</div>
              <div className="text-[11px] text-white opacity-50">{r.count} trade{r.count === 1 ? '' : 's'}</div>
            </div>
            <div className="w-32 h-9">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={r.curve} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                  <Line type="monotone" dataKey="y" dot={false} strokeWidth={1.5}
                    stroke={r.total >= 0 ? COLORS.green : COLORS.red} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="text-right w-16">
              <div className="text-[11px] text-white opacity-50">WR</div>
              <div className="text-sm font-semibold text-white">{pct(r.wr)}</div>
            </div>
            <div className="text-right w-20">
              <div className="text-[11px] text-white opacity-50">Avg / trade</div>
              <div className="text-sm font-mono" style={{ color: r.avg >= 0 ? COLORS.green : COLORS.red }}>{fmt(r.avg)}</div>
            </div>
            <div className="text-right w-24">
              <div className="text-[11px] text-white opacity-50">Net P&L</div>
              <div className="text-base font-bold font-mono" style={{ color: r.total >= 0 ? COLORS.green : COLORS.red }}>{fmt(r.total)}</div>
            </div>
          </motion.div>
        ))}
        <div className="text-[11px] text-white opacity-40 px-1">
          Win rate counts trades with positive net P&L (after fees). Strategy attribution follows
          the assignment timeline — switching a bot's strategy only affects trades after the switch.
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════
  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'entry', label: 'By Entry' },
    { id: 'session', label: 'By Session' },
    { id: 'setup', label: 'By Setup' },
    { id: 'tags', label: 'Tags' },
    { id: 'accounts', label: 'Accounts' },
    { id: 'strategies', label: 'Strategies' },
    { id: 'streaks', label: 'Streaks' },
    { id: 'emotions', label: 'Emotions' },
  ]

  const rangeChips = [
    { id: 'week', label: 'Week' },
    { id: 'month', label: 'Month' },
    { id: 'all', label: 'All Time' },
    { id: 'custom', label: 'Custom' },
  ]

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Analytics</h1>
          <p className="text-sm text-white opacity-60">Deep dive into your trading performance</p>
        </div>

        {/* Date range */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--surface)' }}>
            {rangeChips.map(chip => (
              <button
                key={chip.id}
                onClick={() => setRange(chip.id)}
                className="px-3 py-1.5 rounded-md text-xs font-semibold transition-all border-0 cursor-pointer"
                style={{
                  background: range === chip.id ? 'var(--card)' : 'transparent',
                  color: range === chip.id ? 'var(--text)' : 'var(--text-dim)',
                }}
              >
                {chip.label}
              </button>
            ))}
          </div>
          {range === 'custom' && (
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-2 py-1.5 rounded-lg text-xs border"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
              />
              <span className="text-xs opacity-50">→</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-2 py-1.5 rounded-lg text-xs border"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 border-b" style={{ borderColor: 'var(--border)' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="px-4 py-3 text-sm font-medium transition-all relative"
            style={{
              color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-muted)',
            }}
          >
            {tab.label}
            {activeTab === tab.id && (
              <motion.div
                className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{ background: 'var(--accent)' }}
                layoutId="activeTab"
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <motion.div key={activeTab} {...tabTransition}>
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'entry' && <ByEntryTab />}
        {activeTab === 'session' && <BySessionTab />}
        {activeTab === 'setup' && <BySetupTab />}
        {activeTab === 'tags' && <TagsTab />}
        {activeTab === 'accounts' && <AccountsTab />}
        {activeTab === 'strategies' && <StrategiesTab />}
        {activeTab === 'streaks' && <StreaksTab />}
        {activeTab === 'emotions' && <EmotionsTab />}
      </motion.div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
// CUSTOM BAR SHAPE FOR P&L COLORING
// ════════════════════════════════════════════════════════════════════════
function CustomBar(props) {
  // Recharts already computed the correct geometry against the axis scale
  // (for negative values the bar hangs below the zero line); this shape only
  // overrides the fill so gains are green and losses red. The previous
  // version recomputed height against a hardcoded $5k scale and anchored
  // losses upward like gains, which drew both charts wrong.
  const { x, y, width, height, payload } = props
  if (!payload || !width || !height) return null

  return (
    <rect
      x={x}
      y={height < 0 ? y + height : y}
      width={width}
      height={Math.abs(height)}
      fill={payload.pnl >= 0 ? '#30d158' : '#ff453a'}
      rx={4}
      ry={4}
    />
  )
}
