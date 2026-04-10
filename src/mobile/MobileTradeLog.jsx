import { useState, useMemo } from 'react'
import { Search, Filter, X } from 'lucide-react'
import { getIdeaResult, getNetPnl, getNetR, formatCurrency, SESSIONS, SETUPS } from '../lib/store'

const FILTER_TYPES = [
  { id: 'all', label: 'All' },
  { id: 'win', label: 'Wins' },
  { id: 'loss', label: 'Losses' },
  { id: 'be', label: 'BE' },
  { id: 'open', label: 'Open' },
]

export default function MobileTradeLog({ state, openViewTrade }) {
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [showMoreFilters, setShowMoreFilters] = useState(false)
  const [sessionFilter, setSessionFilter] = useState(null)
  const [setupFilter, setSetupFilter] = useState(null)

  const filtered = useMemo(() => {
    let list = [...(state.trades || [])]

    // Search
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (t) =>
          (t.thesis || '').toLowerCase().includes(q) ||
          (t.notes || '').toLowerCase().includes(q) ||
          (t.setup || '').toLowerCase().includes(q) ||
          (t.instrument || '').toLowerCase().includes(q) ||
          (t.session || '').toLowerCase().includes(q) ||
          (t.lesson || '').toLowerCase().includes(q)
      )
    }

    // Result filter
    if (filterType !== 'all') {
      list = list.filter((t) => {
        const r = getIdeaResult(t)
        if (filterType === 'win') return r === 'WIN'
        if (filterType === 'loss') return r === 'LOSS'
        if (filterType === 'be') return r === 'BE'
        if (filterType === 'open') return r === null
        return true
      })
    }

    if (sessionFilter) list = list.filter((t) => t.session === sessionFilter)
    if (setupFilter) list = list.filter((t) => t.setup === setupFilter)

    // Sort newest first
    list.sort((a, b) => new Date(b.date) - new Date(a.date) || b.createdAt - a.createdAt)
    return list
  }, [state.trades, search, filterType, sessionFilter, setupFilter])

  // Group by date
  const grouped = useMemo(() => {
    const groups = {}
    filtered.forEach((t) => {
      if (!groups[t.date]) groups[t.date] = []
      groups[t.date].push(t)
    })
    return groups
  }, [filtered])

  return (
    <div className="pt-4 pb-28">
      {/* Search bar */}
      <div className="px-4 mb-3">
        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2.5 border"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <Search size={14} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search trades..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent border-0 outline-none text-sm"
            style={{ color: 'var(--text)' }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="border-0 bg-transparent cursor-pointer p-0"
              style={{ color: 'var(--text-muted)' }}
            >
              <X size={14} />
            </button>
          )}
          <button
            onClick={() => setShowMoreFilters((v) => !v)}
            className="border-0 bg-transparent cursor-pointer p-0 ml-1"
            style={{ color: showMoreFilters ? 'var(--blue)' : 'var(--text-muted)' }}
          >
            <Filter size={14} />
          </button>
        </div>
      </div>

      {/* Result filter pills */}
      <div className="px-4 mb-2 overflow-x-auto">
        <div className="flex gap-1.5" style={{ width: 'max-content' }}>
          {FILTER_TYPES.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilterType(f.id)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold border-0 cursor-pointer whitespace-nowrap"
              style={{
                background: filterType === f.id ? 'var(--blue)' : 'var(--card)',
                color: filterType === f.id ? '#fff' : 'var(--text-dim)',
                border: `1px solid ${filterType === f.id ? 'transparent' : 'var(--border)'}`,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Expanded filters */}
      {showMoreFilters && (
        <div className="px-4 py-2 mb-2 space-y-2">
          <div>
            <div className="text-[10px] font-semibold uppercase mb-1" style={{ color: 'var(--text-muted)' }}>
              Session
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {SESSIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSessionFilter(sessionFilter === s ? null : s)}
                  className="px-2.5 py-1 rounded-full text-[11px] border-0 cursor-pointer"
                  style={{
                    background: sessionFilter === s ? 'var(--blue)' : 'var(--card)',
                    color: sessionFilter === s ? '#fff' : 'var(--text-dim)',
                    border: `1px solid ${sessionFilter === s ? 'transparent' : 'var(--border)'}`,
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase mb-1" style={{ color: 'var(--text-muted)' }}>
              Setup
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {SETUPS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSetupFilter(setupFilter === s ? null : s)}
                  className="px-2.5 py-1 rounded-full text-[11px] border-0 cursor-pointer"
                  style={{
                    background: setupFilter === s ? 'var(--blue)' : 'var(--card)',
                    color: setupFilter === s ? '#fff' : 'var(--text-dim)',
                    border: `1px solid ${setupFilter === s ? 'transparent' : 'var(--border)'}`,
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Trade list grouped by date */}
      <div className="px-4">
        {Object.keys(grouped).length === 0 ? (
          <div
            className="rounded-2xl p-8 text-center border"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No trades match your filters
            </div>
          </div>
        ) : (
          Object.entries(grouped).map(([date, trades]) => {
            const dayPnl = trades.reduce((s, t) => s + getNetPnl(t), 0)
            return (
              <div key={date} className="mb-4">
                <div className="flex items-center justify-between mb-1.5 px-1">
                  <div
                    className="text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                  <div
                    className="text-[11px] font-bold font-mono"
                    style={{ color: dayPnl >= 0 ? 'var(--green)' : 'var(--red)' }}
                  >
                    {formatCurrency(dayPnl)}
                  </div>
                </div>
                <div className="space-y-2">
                  {trades.map((trade) => {
                    const pnl = getNetPnl(trade)
                    const r = getNetR(trade)
                    const result = getIdeaResult(trade)
                    return (
                      <button
                        key={trade.id}
                        onClick={() => openViewTrade(trade)}
                        className="w-full rounded-xl p-3 border text-left cursor-pointer active:scale-[0.98] transition-transform"
                        style={{
                          background: 'var(--card)',
                          borderColor: 'var(--border)',
                        }}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
                              {trade.instrument}
                            </span>
                            <span className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                              {trade.session}{trade.setup ? ` · ${trade.setup}` : ''}
                            </span>
                          </div>
                          {result && (
                            <span
                              className="text-[9px] font-bold px-1.5 py-[2px] rounded flex-shrink-0 ml-2"
                              style={{
                                background: result === 'WIN' ? 'var(--green-dim)' : 'var(--red-dim)',
                                color: result === 'WIN' ? 'var(--green)' : 'var(--red)',
                              }}
                            >
                              {result}
                            </span>
                          )}
                        </div>
                        {trade.thesis && (
                          <div
                            className="text-[11px] mb-1.5 line-clamp-1"
                            style={{ color: 'var(--text-dim)' }}
                          >
                            {trade.thesis}
                          </div>
                        )}
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
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
