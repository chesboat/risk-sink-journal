import { useState } from 'react'
import { motion } from 'framer-motion'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from 'recharts'
import { TrendingUp, Zap, Target, Smile, Shield, Info } from 'lucide-react'
import { calcStats, calcPooledHealth, SESSIONS, SETUPS, EMOTIONS } from '../lib/store'

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
  const stats = calcStats(state.trades, 'all')

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
    // R distribution histogram
    const rBuckets = { '-3': 0, '-2': 0, '-1': 0, '0': 0, '1': 0, '2': 0, '3': 0, '4': 0, '5+': 0 }
    state.trades.forEach(t => {
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

    // Profit factor: sum of winning days / absolute value of losing days
    const winningDays = stats.equityCurve.filter(d => d.daily > 0).reduce((s, d) => s + d.daily, 0)
    const losingDays = Math.abs(stats.equityCurve.filter(d => d.daily < 0).reduce((s, d) => s + d.daily, 0))
    const profitFactor = losingDays > 0 ? (winningDays / losingDays).toFixed(2) : (winningDays > 0 ? '∞' : '0')

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
            <div className="text-xs text-white opacity-50">{stats.entryWins}W / {stats.totalEntries - stats.entryWins}L · {stats.totalEntries} entries</div>
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
              <div className="text-xs text-white opacity-50">All {pooled.perAccount.length} accounts treated as one system</div>
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
                Sum of each account's <span className="font-semibold">distance-to-bust</span> (current P&L minus its trailing MLL floor, capped at ${pooled.pooledMll / pooled.perAccount.length} per account). This is the total dollar drawdown the system can absorb before ANY single account busts — losses on one account don't rescue another's floor.
              </div>
              <div className="font-mono opacity-60 mb-3">
                {pooled.perAccount.map((a, i) => (
                  <span key={a.id}>
                    {a.name} ${Math.round(Math.max(0, Math.min(pooled.pooledMll / pooled.perAccount.length, a.mllDistance))).toLocaleString()}
                    {i < pooled.perAccount.length - 1 ? '  +  ' : '  =  '}
                  </span>
                ))}
                <span className="font-semibold">${Math.round(pooled.pooledHeadroom).toLocaleString()}</span>
                <span className="opacity-50"> of ${pooled.pooledMll.toLocaleString()}</span>
              </div>

              <div className="font-semibold mb-2">Trailing MLL (per account)</div>
              <div className="opacity-70">
                Each account's floor = min($0, peak P&L − ${(pooled.pooledMll / pooled.perAccount.length).toLocaleString()}). The floor trails $-for-$ with profit and locks at $0 once peak hits +${(pooled.pooledMll / pooled.perAccount.length).toLocaleString()}. Account busts the moment current P&L drops below its floor.
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
          {pooled.maxDdAt && (
            <div className="text-xs text-white opacity-60 mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
              Trough reached on <span className="font-mono">{pooled.maxDdAt}</span>
            </div>
          )}
        </motion.div>

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

    const chartData = sessionData.map(s => ({
      name: s.session.split(' ')[0], // Just the first word for chart
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
    const results = state.trades
      .filter(t => {
        const triggered = t.entries.filter(e => e.triggered)
        return triggered.length > 0 && triggered.some(e => e.result)
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(t => {
        const triggered = t.entries.filter(e => e.triggered)
        if (triggered.some(e => e.result === 'W')) return 'WIN'
        if (triggered.every(e => e.result === 'L')) return 'LOSS'
        return null
      })
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
                    background: result === 'WIN' ? COLORS.green : COLORS.red,
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

    // Find best emotion
    const bestEmotion = emotionData.length > 0
      ? emotionData.reduce((prev, current) => (prev.wr > current.wr ? prev : current))
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
  // RENDER
  // ════════════════════════════════════════════════════════════════════════
  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'entry', label: 'By Entry' },
    { id: 'session', label: 'By Session' },
    { id: 'setup', label: 'By Setup' },
    { id: 'streaks', label: 'Streaks' },
    { id: 'emotions', label: 'Emotions' },
  ]

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Analytics</h1>
        <p className="text-sm text-white opacity-60">Deep dive into your trading performance</p>
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
  const { fill, x, y, width, height, payload } = props
  if (!payload) return null

  const barColor = payload.pnl >= 0 ? '#30d158' : '#ff453a'
  const barHeight = Math.abs((payload.pnl / (payload.pnl > 0 ? 5000 : 5000)) * height) || 0
  const barY = payload.pnl >= 0 ? y + height - barHeight : y + height - barHeight

  return (
    <rect
      x={x}
      y={barY}
      width={width}
      height={barHeight}
      fill={barColor}
      rx={4}
      ry={4}
    />
  )
}
