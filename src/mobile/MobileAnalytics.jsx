import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart, BarChart, Bar, Cell } from 'recharts'
import { Shield, Info } from 'lucide-react'
import { calcStats, calcPooledHealth, formatCurrency } from '../lib/store'

const PERIODS = [
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'all', label: 'All' },
]

function Section({ title, children }) {
  return (
    <div className="mb-5">
      <div
        className="text-[10px] font-semibold uppercase tracking-wider mb-2 px-1"
        style={{ color: 'var(--text-muted)' }}
      >
        {title}
      </div>
      {children}
    </div>
  )
}

function Row({ label, value, color, bar }) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-xs truncate" style={{ color: 'var(--text-dim)' }}>
            {label}
          </span>
          <span
            className="text-xs font-bold font-mono flex-shrink-0 ml-2"
            style={{ color: color || 'var(--text)' }}
          >
            {value}
          </span>
        </div>
        {bar != null && (
          <div className="h-1 rounded-full mt-1 overflow-hidden" style={{ background: 'var(--surface)' }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max(0, Math.min(100, bar))}%`, background: color || 'var(--blue)' }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default function MobileAnalytics({ state }) {
  const [period, setPeriod] = useState('all')
  const [showPooledInfo, setShowPooledInfo] = useState(false)
  const [showMaxDdInfo, setShowMaxDdInfo] = useState(false)
  const stats = useMemo(() => calcStats(state.trades || [], period), [state.trades, period])

  // Pooled Risk Sink Health — all-time snapshot of the combined account system.
  // Not period-filtered: MLL/DD are about the system as a whole, not a window.
  const pooled = useMemo(
    () => calcPooledHealth(state.trades || [], state.accounts || [], state.settings),
    [state.trades, state.accounts, state.settings]
  )

  // R-multiple histogram on the period-filtered trades
  const rBuckets = useMemo(() => {
    const bins = [
      { label: '≤−2', min: -Infinity, max: -1.5, count: 0, isLoss: true },
      { label: '−1', min: -1.5, max: -0.5, count: 0, isLoss: true },
      { label: '0', min: -0.5, max: 0.5, count: 0, isLoss: false },
      { label: '+1', min: 0.5, max: 1.5, count: 0, isLoss: false },
      { label: '+2', min: 1.5, max: 2.5, count: 0, isLoss: false },
      { label: '+3', min: 2.5, max: 3.5, count: 0, isLoss: false },
      { label: '+4', min: 3.5, max: 4.5, count: 0, isLoss: false },
      { label: '+5', min: 4.5, max: 5.5, count: 0, isLoss: false },
      { label: '≥+6', min: 5.5, max: Infinity, count: 0, isLoss: false },
    ]
    let filtered = state.trades || []
    const now = new Date()
    if (period === 'week') {
      const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7)
      filtered = filtered.filter((t) => new Date(t.date + 'T00:00:00') >= weekAgo)
    } else if (period === 'month') {
      filtered = filtered.filter((t) => {
        const d = new Date(t.date + 'T00:00:00')
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      })
    }
    let hasAny = false
    filtered.forEach((t) => {
      const entries = t.entries || []
      const anyTriggered = entries.some((e) => e.triggered)
      if (!anyTriggered) return
      hasAny = true
      const r = entries.reduce((s, e) => {
        if (!e.triggered) return s
        if (e.result === 'W') return s + (e.r || 0)
        if (e.result === 'L') return s - 1
        return s
      }, 0)
      for (const b of bins) if (r > b.min && r <= b.max) { b.count++; break }
    })
    return { bins, hasAny }
  }, [state.trades, period])

  const equityData = stats.equityCurve.map((d) => ({
    date: d.date.slice(5),
    value: d.cumulative,
  }))

  const isProfit = stats.totalPnl >= 0

  return (
    <div className="px-4 pt-4 pb-28">
      {/* Period pills */}
      <div className="flex gap-1.5 mb-4">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            className="flex-1 py-2 rounded-xl text-xs font-semibold border-0 cursor-pointer"
            style={{
              background: period === p.id ? 'var(--blue)' : 'var(--card)',
              color: period === p.id ? '#fff' : 'var(--text-dim)',
              border: `1px solid ${period === p.id ? 'transparent' : 'var(--border)'}`,
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Equity curve */}
      <div
        className="rounded-2xl p-4 border mb-4"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-end justify-between mb-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Net P&L
            </div>
            <div
              className="text-2xl font-bold font-mono"
              style={{ color: isProfit ? 'var(--green)' : 'var(--red)' }}
            >
              {formatCurrency(stats.totalPnl)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase" style={{ color: 'var(--text-muted)' }}>
              Net R
            </div>
            <div
              className="text-sm font-bold font-mono"
              style={{ color: stats.totalR >= 0 ? 'var(--green)' : 'var(--red)' }}
            >
              {stats.totalR >= 0 ? '+' : ''}
              {stats.totalR.toFixed(1)}R
            </div>
          </div>
        </div>
        <div style={{ width: '100%', height: 140 }}>
          {equityData.length === 0 ? (
            <div
              className="h-full flex items-center justify-center text-xs"
              style={{ color: 'var(--text-muted)' }}
            >
              No data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={equityData}>
                <defs>
                  <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={isProfit ? 'var(--green)' : 'var(--red)'} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={isProfit ? 'var(--green)' : 'var(--red)'} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" hide />
                <YAxis hide />
                <Tooltip
                  contentStyle={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                  formatter={(v) => [formatCurrency(v), 'Cum P&L']}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={isProfit ? 'var(--green)' : 'var(--red)'}
                  strokeWidth={2}
                  fill="url(#eqGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Pooled Risk Sink Health — all accounts treated as one system */}
      <div
        className="rounded-2xl p-4 border mb-4"
        style={{
          background:
            pooled.combinedPnl > 0
              ? 'linear-gradient(135deg, color-mix(in srgb, var(--green) 15%, var(--card)), var(--card))'
              : 'var(--card)',
          borderColor: pooled.combinedPnl > 0 ? 'color-mix(in srgb, var(--green) 30%, var(--border))' : 'var(--border)',
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-start gap-1.5">
            <div>
              <div className="flex items-center gap-1.5">
                <Shield size={12} style={{ color: 'var(--blue)' }} />
                <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Pooled Health
                </div>
              </div>
              <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                All {pooled.perAccount.length} accounts as one system
              </div>
            </div>
            <button
              onClick={() => setShowPooledInfo(!showPooledInfo)}
              className="p-1 rounded-full border-0 cursor-pointer"
              style={{
                background: showPooledInfo ? 'var(--blue)' : 'var(--surface)',
                color: showPooledInfo ? '#fff' : 'var(--text-muted)',
              }}
            >
              <Info size={10} />
            </button>
          </div>
          <div className="text-right">
            <div
              className="text-2xl font-bold font-mono"
              style={{ color: pooled.combinedPnl >= 0 ? 'var(--green)' : 'var(--red)' }}
            >
              {formatCurrency(pooled.combinedPnl)}
            </div>
            <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              combined P&L
            </div>
          </div>
        </div>

        {showPooledInfo && (
          <div
            className="mb-3 p-2.5 rounded-xl text-[10px]"
            style={{ background: 'var(--surface)', color: 'var(--text-dim)' }}
          >
            <div className="font-semibold mb-1.5" style={{ color: 'var(--text)' }}>
              How this is calculated
            </div>
            <div className="mb-1.5">
              <span className="font-semibold">Combined P&L</span> = sum of each account's current P&L.
            </div>
            <div className="font-mono p-1.5 rounded mb-1.5" style={{ background: 'var(--card)' }}>
              {(pooled.perAccount || []).map((a) => (
                <div key={a.id} className="flex justify-between">
                  <span className="opacity-70 truncate mr-2">{a.name}</span>
                  <span style={{ color: a.totalPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {formatCurrency(a.totalPnl)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between pt-1 mt-1 border-t" style={{ borderColor: 'var(--border)' }}>
                <span className="font-semibold">Combined</span>
                <span style={{ color: pooled.combinedPnl >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
                  {formatCurrency(pooled.combinedPnl)}
                </span>
              </div>
            </div>
            <div className="mb-1.5">
              <span className="font-semibold">Pooled MLL Headroom</span> = sum of each account's distance-to-bust (capped at ${(pooled.pooledMll / (pooled.perAccount.length || 1)).toLocaleString()} per account).
            </div>
            <div className="font-mono p-1.5 rounded mb-1.5" style={{ background: 'var(--card)' }}>
              {(pooled.perAccount || []).map((a) => (
                <div key={a.id} className="flex justify-between">
                  <span className="opacity-70 truncate mr-2">{a.name}</span>
                  <span style={{ color: 'var(--text)' }}>
                    {formatCurrency(Math.max(0, (a.mllInitial || 0) - (a.mllUsed || 0)))}
                  </span>
                </div>
              ))}
              <div className="flex justify-between pt-1 mt-1 border-t" style={{ borderColor: 'var(--border)' }}>
                <span className="font-semibold">Total</span>
                <span style={{ color: 'var(--text)', fontWeight: 700 }}>
                  {formatCurrency(pooled.pooledHeadroom)} / ${pooled.pooledMll.toLocaleString()}
                </span>
              </div>
            </div>
            <div className="opacity-70">
              Each account uses a <span className="font-semibold">trailing MLL</span>: floor = min(0, peak − $2k). Once peak ≥ +$2k, floor locks at $0.
            </div>
          </div>
        )}

        {/* Pooled MLL headroom bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-[10px] mb-1.5">
            <span style={{ color: 'var(--text-muted)' }}>Pooled MLL headroom</span>
            <span className="font-mono" style={{ color: 'var(--text)' }}>
              {formatCurrency(pooled.pooledHeadroom)}{' '}
              <span style={{ color: 'var(--text-muted)' }}>
                of ${pooled.pooledMll.toLocaleString()}
              </span>
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.max(0, Math.min(100, pooled.pooledHeadroomPct))}%`,
                background:
                  pooled.pooledHeadroomPct > 66
                    ? 'var(--green)'
                    : pooled.pooledHeadroomPct > 33
                      ? 'var(--orange)'
                      : 'var(--red)',
              }}
            />
          </div>
        </div>

        {/* Per-account divergence strip */}
        <div className="grid grid-cols-3 gap-1.5 mt-3">
          {pooled.perAccount.map((a) => {
            const isWorst = pooled.worst && pooled.worst.id === a.id && a.mllUsed > 0
            return (
              <div
                key={a.id}
                className="rounded-lg p-2 border"
                style={{
                  background: 'var(--surface)',
                  borderColor: isWorst ? 'var(--orange)' : 'var(--border)',
                }}
              >
                <div className="text-[9px] truncate" style={{ color: 'var(--text-muted)' }}>
                  {a.name}
                </div>
                <div
                  className="text-[13px] font-bold font-mono leading-tight"
                  style={{ color: a.totalPnl >= 0 ? 'var(--green)' : 'var(--red)' }}
                >
                  {formatCurrency(a.totalPnl)}
                </div>
                <div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                  MLL {Math.round(a.mllUsedPct)}%
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Max Combined Drawdown */}
      <div
        className="rounded-2xl p-4 border mb-4"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-start gap-1.5">
            <div>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Max Combined Drawdown
              </div>
              <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Deepest peak-to-trough the system ate
              </div>
            </div>
            <button
              onClick={() => setShowMaxDdInfo(!showMaxDdInfo)}
              className="p-1 rounded-full border-0 cursor-pointer"
              style={{
                background: showMaxDdInfo ? 'var(--blue)' : 'var(--surface)',
                color: showMaxDdInfo ? '#fff' : 'var(--text-muted)',
              }}
            >
              <Info size={10} />
            </button>
          </div>
          <div className="text-right">
            <div
              className="text-xl font-bold font-mono"
              style={{
                color:
                  pooled.maxDdPctOfPool < 33
                    ? 'var(--green)'
                    : pooled.maxDdPctOfPool < 66
                      ? 'var(--orange)'
                      : 'var(--red)',
              }}
            >
              -${Math.round(pooled.maxDd).toLocaleString()}
            </div>
            <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {Math.round(pooled.maxDdPctOfPool)}% of pool
            </div>
          </div>
        </div>
        {showMaxDdInfo && (
          <div
            className="mb-3 p-2.5 rounded-xl text-[10px]"
            style={{ background: 'var(--surface)', color: 'var(--text-dim)' }}
          >
            <div className="font-semibold mb-1.5" style={{ color: 'var(--text)' }}>
              How this is calculated
            </div>
            <div className="mb-1.5">
              Deepest peak-to-trough drop of the combined equity curve (all {(pooled.perAccount || []).length} accounts summed chronologically).
            </div>
            {pooled.maxDd > 0 ? (
              <div className="font-mono p-1.5 rounded mb-1.5" style={{ background: 'var(--card)' }}>
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
                  {' '}= <span style={{ color: 'var(--orange)' }}>{Math.round(pooled.maxDdPctOfPool)}%</span> of ${pooled.pooledMll.toLocaleString()}
                </div>
              </div>
            ) : (
              <div className="opacity-60 italic mb-1.5">No drawdown yet — combined curve hasn't dropped below its peak.</div>
            )}
            <div className="opacity-70">
              System-wide metric: a $500 drop on one account offset by a $500 gain on another contributes $0 to the combined drawdown.
            </div>
          </div>
        )}
        <div className="h-2 rounded-full overflow-hidden mb-1" style={{ background: 'var(--surface)' }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.max(0, Math.min(100, pooled.maxDdPctOfPool))}%`,
              background:
                pooled.maxDdPctOfPool < 33
                  ? 'var(--green)'
                  : pooled.maxDdPctOfPool < 66
                    ? 'var(--orange)'
                    : 'var(--red)',
            }}
          />
        </div>
        <div className="flex items-center justify-between text-[9px]" style={{ color: 'var(--text-muted)' }}>
          <span>Safe</span>
          <span>Danger</span>
          <span>Blown</span>
        </div>
        {pooled.maxDdAt && (
          <div className="text-[10px] mt-2 pt-2 border-t" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
            Trough on <span className="font-mono">{pooled.maxDdAt}</span>
          </div>
        )}
      </div>

      {/* R-Multiple Distribution */}
      <div
        className="rounded-2xl p-4 border mb-4"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <div className="text-[10px] uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
          R-Multiple Distribution
        </div>
        {!rBuckets.hasAny ? (
          <div className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>
            No completed ideas yet
          </div>
        ) : (
          <div style={{ width: '100%', height: 140 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rBuckets.bins} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
                  axisLine={{ stroke: 'var(--border)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                  cursor={{ fill: 'var(--border)', opacity: 0.3 }}
                  formatter={(v) => [`${v} ${v === 1 ? 'idea' : 'ideas'}`, '']}
                />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {rBuckets.bins.map((b, i) => (
                    <Cell key={i} fill={b.isLoss ? 'var(--red)' : 'var(--green)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Key stats grid */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div
          className="rounded-xl p-3 border"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <div className="text-[9px] uppercase" style={{ color: 'var(--text-muted)' }}>
            Idea WR
          </div>
          <div className="text-lg font-bold font-mono" style={{ color: 'var(--text)' }}>
            {(stats.ideaWR * 100).toFixed(0)}%
          </div>
          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {stats.ideaWins}W {stats.ideaLosses}L
          </div>
        </div>
        <div
          className="rounded-xl p-3 border"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <div className="text-[9px] uppercase" style={{ color: 'var(--text-muted)' }}>
            Entry WR
          </div>
          <div className="text-lg font-bold font-mono" style={{ color: 'var(--text)' }}>
            {(stats.entryWR * 100).toFixed(0)}%
          </div>
          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {stats.entryWins}/{stats.totalEntries}
          </div>
        </div>
        <div
          className="rounded-xl p-3 border"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <div className="text-[9px] uppercase" style={{ color: 'var(--text-muted)' }}>
            Best Streak
          </div>
          <div className="text-lg font-bold font-mono" style={{ color: 'var(--green)' }}>
            {stats.bestWinStreak}W
          </div>
        </div>
        <div
          className="rounded-xl p-3 border"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <div className="text-[9px] uppercase" style={{ color: 'var(--text-muted)' }}>
            Current
          </div>
          <div
            className="text-lg font-bold font-mono"
            style={{
              color: stats.currentStreak > 0 ? 'var(--green)' : stats.currentStreak < 0 ? 'var(--red)' : 'var(--text)',
            }}
          >
            {stats.currentStreak > 0
              ? `+${stats.currentStreak}W`
              : stats.currentStreak < 0
              ? `${stats.currentStreak}L`
              : '—'}
          </div>
        </div>
      </div>

      {/* By entry slot */}
      <div
        className="rounded-2xl p-4 border mb-4"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <Section title="By Account (E1/E2/E3)">
          {stats.byEntry.map((e) => (
            <Row
              key={e.slot}
              label={`E${e.slot} · ${e.trades} trades`}
              value={formatCurrency(e.totalPnl)}
              color={e.totalPnl >= 0 ? 'var(--green)' : 'var(--red)'}
              bar={e.wr * 100}
            />
          ))}
        </Section>
      </div>

      {/* By session */}
      <div
        className="rounded-2xl p-4 border mb-4"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <Section title="By Session">
          {stats.bySession.filter((s) => s.ideas > 0).length === 0 ? (
            <div className="text-xs text-center py-2" style={{ color: 'var(--text-muted)' }}>
              No data
            </div>
          ) : (
            stats.bySession
              .filter((s) => s.ideas > 0)
              .map((s) => (
                <Row
                  key={s.session}
                  label={`${s.session} · ${(s.wr * 100).toFixed(0)}% WR`}
                  value={formatCurrency(s.pnl)}
                  color={s.pnl >= 0 ? 'var(--green)' : 'var(--red)'}
                  bar={s.wr * 100}
                />
              ))
          )}
        </Section>
      </div>

      {/* By setup */}
      <div
        className="rounded-2xl p-4 border"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <Section title="By Setup">
          {stats.bySetup.length === 0 ? (
            <div className="text-xs text-center py-2" style={{ color: 'var(--text-muted)' }}>
              No setup data
            </div>
          ) : (
            stats.bySetup.map((s) => (
              <Row
                key={s.setup}
                label={`${s.setup} · ${s.trades}t`}
                value={formatCurrency(s.pnl)}
                color={s.pnl >= 0 ? 'var(--green)' : 'var(--red)'}
              />
            ))
          )}
        </Section>
      </div>
    </div>
  )
}
