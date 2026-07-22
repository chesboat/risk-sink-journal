import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Target, Flame } from 'lucide-react'
import {
  calcStats,
  calcRiskScore,
  getIdeaResult,
  getNetPnl,
  getNetR,
  getAccountStats,
  getActiveManualAccounts,
  formatCurrency,
} from '../lib/store'

function StatCard({ label, value, sub, color, icon: Icon }) {
  return (
    <div
      className="rounded-2xl p-3 border"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        {Icon && <Icon size={11} style={{ color: 'var(--text-muted)' }} />}
        <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          {label}
        </span>
      </div>
      <div className="text-lg font-bold font-mono" style={{ color: color || 'var(--text)' }}>
        {value}
      </div>
      {sub && (
        <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {sub}
        </div>
      )}
    </div>
  )
}

export default function MobileDashboard({ state, openViewTrade }) {
  const stats = useMemo(() => calcStats(state.trades || [], 'all'), [state.trades])
  const weekStats = useMemo(() => calcStats(state.trades || [], 'week'), [state.trades])
  const riskScore = useMemo(
    () => calcRiskScore(state.trades || [], state.accounts || [], state.settings),
    [state.trades, state.accounts, state.settings]
  )

  // Today P&L
  const todayStr = new Date().toISOString().slice(0, 10)
  const todayTrades = (state.trades || []).filter((t) => t.date === todayStr)
  const todayPnl = todayTrades.reduce((s, t) => s + getNetPnl(t), 0)

  const recentTrades = useMemo(
    () =>
      [...(state.trades || [])]
        .sort((a, b) => new Date(b.date) - new Date(a.date) || b.createdAt - a.createdAt)
        .slice(0, 6),
    [state.trades]
  )

  const accountCards = useMemo(
    () =>
      getActiveManualAccounts(state.accounts || []).map((a) => ({
        ...a,
        stats: getAccountStats(a, state.trades || [], state.settings),
      })),
    [state.accounts, state.trades, state.settings]
  )

  return (
    <div className="px-4 pt-4 pb-28">
      {/* Hero card — Today */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="rounded-2xl p-4 mb-3 border"
        style={{
          background:
            todayPnl > 0
              ? 'linear-gradient(135deg, color-mix(in srgb, var(--green) 15%, var(--card)), var(--card))'
              : todayPnl < 0
              ? 'linear-gradient(135deg, color-mix(in srgb, var(--red) 15%, var(--card)), var(--card))'
              : 'var(--card)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
          Today
        </div>
        <div className="flex items-end justify-between">
          <div
            className="text-3xl font-bold font-mono"
            style={{
              color: todayPnl > 0 ? 'var(--green)' : todayPnl < 0 ? 'var(--red)' : 'var(--text)',
            }}
          >
            {todayTrades.length === 0 ? 'No trades' : formatCurrency(todayPnl)}
          </div>
          <div className="text-right">
            <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {todayTrades.length} {todayTrades.length === 1 ? 'trade' : 'trades'}
            </div>
          </div>
        </div>
      </motion.div>

      {/* 2x2 stat grid */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <StatCard
          label="All-Time"
          value={formatCurrency(stats.totalPnl)}
          sub={`${stats.totalR >= 0 ? '+' : ''}${stats.totalR.toFixed(1)}R`}
          color={stats.totalPnl >= 0 ? 'var(--green)' : 'var(--red)'}
          icon={stats.totalPnl >= 0 ? TrendingUp : TrendingDown}
        />
        <StatCard
          label="This Week"
          value={formatCurrency(weekStats.totalPnl)}
          sub={`${weekStats.totalTrades} ideas`}
          color={weekStats.totalPnl >= 0 ? 'var(--green)' : 'var(--red)'}
          icon={Flame}
        />
        <StatCard
          label="Idea WR"
          value={`${(stats.ideaWR * 100).toFixed(0)}%`}
          sub={`${stats.ideaWins}W ${stats.ideaLosses}L`}
          color="var(--text)"
          icon={Target}
        />
        <StatCard
          label="Risk Score"
          value={riskScore.score}
          sub={riskScore.label}
          color={
            riskScore.score >= 65
              ? 'var(--green)'
              : riskScore.score >= 35
              ? 'var(--orange)'
              : 'var(--red)'
          }
        />
      </div>

      {/* Accounts row */}
      <div className="mb-3">
        <div className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
          Accounts
        </div>
        <div className="grid grid-cols-3 gap-2">
          {accountCards.map((a) => {
            const pct = Math.max(0, Math.min(100, a.stats.mllPercent))
            const healthy = pct > 50
            const warn = pct > 25 && pct <= 50
            return (
              <div
                key={a.id}
                className="rounded-xl p-2.5 border"
                style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
              >
                <div
                  className="text-[10px] font-semibold truncate"
                  style={{ color: 'var(--text-dim)' }}
                >
                  {a.name}
                </div>
                <div
                  className="text-sm font-bold font-mono mt-0.5"
                  style={{
                    color: a.stats.totalPnl >= 0 ? 'var(--green)' : 'var(--red)',
                  }}
                >
                  {formatCurrency(a.stats.totalPnl)}
                </div>
                {/* MLL bar */}
                <div
                  className="h-1 rounded-full mt-1.5 overflow-hidden"
                  style={{ background: 'var(--surface)' }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${pct}%`,
                      background: healthy ? 'var(--green)' : warn ? 'var(--orange)' : 'var(--red)',
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Recent trades */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Recent
          </div>
          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {stats.totalTrades} total
          </div>
        </div>

        {recentTrades.length === 0 ? (
          <div
            className="rounded-2xl p-6 text-center border"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No trades yet. Tap + to log your first.
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {recentTrades.map((trade) => {
              const pnl = getNetPnl(trade)
              const r = getNetR(trade)
              const result = getIdeaResult(trade)
              const dateObj = new Date(trade.date + 'T00:00:00')
              const dateLabel = dateObj.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })
              return (
                <button
                  key={trade.id}
                  onClick={() => openViewTrade(trade)}
                  className="w-full rounded-xl p-3 border text-left cursor-pointer active:scale-[0.98] transition-transform"
                  style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
                        {trade.instrument}
                      </span>
                      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        {dateLabel} · {trade.session}
                      </span>
                    </div>
                    {result && (
                      <span
                        className="text-[9px] font-bold px-1.5 py-[2px] rounded"
                        style={{
                          background: result === 'WIN' ? 'var(--green-dim)' : 'var(--red-dim)',
                          color: result === 'WIN' ? 'var(--green)' : 'var(--red)',
                        }}
                      >
                        {result}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1 items-center">
                      {(trade.entries || []).map((e, i) => {
                        if (!e.triggered) {
                          return (
                            <div
                              key={i}
                              className="w-2 h-2 rounded-full"
                              style={{
                                border: '1px solid var(--text-muted)',
                                background: 'transparent',
                              }}
                            />
                          )
                        }
                        const bg =
                          e.result === 'W'
                            ? 'var(--green)'
                            : e.result === 'L'
                            ? 'var(--red)'
                            : 'var(--text-dim)'
                        return (
                          <div
                            key={i}
                            className="w-2 h-2 rounded-full"
                            style={{ background: bg }}
                          />
                        )
                      })}
                      {trade.setup && (
                        <span className="text-[10px] ml-1" style={{ color: 'var(--text-dim)' }}>
                          {trade.setup}
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <div
                        className="text-sm font-bold font-mono leading-none"
                        style={{ color: pnl >= 0 ? 'var(--green)' : 'var(--red)' }}
                      >
                        {formatCurrency(pnl)}
                      </div>
                      <div
                        className="text-[10px] font-semibold leading-tight"
                        style={{ color: r >= 0 ? 'var(--green)' : 'var(--red)' }}
                      >
                        {r >= 0 ? '+' : ''}
                        {r.toFixed(2)}R
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
