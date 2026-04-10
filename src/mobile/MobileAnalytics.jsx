import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts'
import { calcStats, formatCurrency } from '../lib/store'

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
  const stats = useMemo(() => calcStats(state.trades || [], period), [state.trades, period])

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
