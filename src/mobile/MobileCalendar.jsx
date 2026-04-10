import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { getCalendarDays, getIdeaResult, getNetPnl, getNetR, formatCurrency } from '../lib/store'

// ═══════════════════════════════════════════════════
// MOBILE CALENDAR — Compact month grid tuned for phones
//   • 7×6 grid with uniform square-ish tiles (~44–52px wide)
//   • Each tile: day number top-left · tiny ±P&L (k-scaled) · 3 entry dots
//   • Background tint: green for +day, red for −day
//   • Tap tile → bottom sheet with that day's trades
// ═══════════════════════════════════════════════════

const DAYS_OF_WEEK = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

// Abbreviate P&L for tight mobile tiles: +1.2k / -250 / +80
function tinyPnl(n) {
  if (n === 0) return ''
  const abs = Math.abs(n)
  if (abs >= 1000) {
    return (n >= 0 ? '+' : '-') + (abs / 1000).toFixed(1) + 'k'
  }
  return (n >= 0 ? '+' : '-') + Math.round(abs)
}

function TinyDot({ entry }) {
  if (!entry) return <div style={{ width: 4, height: 4 }} />
  if (!entry.triggered) {
    return (
      <div
        className="rounded-full"
        style={{
          width: 4,
          height: 4,
          border: '1px solid var(--text-muted)',
          background: 'transparent',
        }}
      />
    )
  }
  const bg =
    entry.result === 'W'
      ? 'var(--green)'
      : entry.result === 'L'
      ? 'var(--red)'
      : 'var(--text-dim)'
  return <div className="rounded-full" style={{ width: 4, height: 4, background: bg }} />
}

export default function MobileCalendar({ state, openViewTrade }) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const monthLabel = currentDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  // Group trades by date
  const tradesByDate = useMemo(() => {
    const map = {}
    ;(state.trades || []).forEach((t) => {
      if (!map[t.date]) map[t.date] = []
      map[t.date].push(t)
    })
    return map
  }, [state.trades])

  // Build day cells
  const days = useMemo(() => getCalendarDays(year, month), [year, month])

  const cells = days.map((d, i) => {
    // Figure out actual date for this cell
    let date
    if (d.inMonth) {
      date = new Date(year, month, d.day)
    } else if (i < 7) {
      // Previous month
      date = new Date(year, month - 1, d.day)
    } else {
      // Next month
      date = new Date(year, month + 1, d.day)
    }
    const dateStr = date.toISOString().slice(0, 10)
    const trades = tradesByDate[dateStr] || []
    const pnl = trades.reduce((s, t) => s + getNetPnl(t), 0)
    // Merge entries across trades — show status of E1/E2/E3 for the day as a whole
    const dayEntries = [1, 2, 3].map((slot) => {
      // Find any triggered entry for this slot across all trades that day
      for (const t of trades) {
        const e = (t.entries || []).find((en) => en.slot === slot && en.triggered)
        if (e) return e
      }
      return { slot, triggered: false }
    })

    const today = new Date().toISOString().slice(0, 10)
    const isToday = dateStr === today

    return {
      key: `${dateStr}-${i}`,
      dateStr,
      day: d.day,
      inMonth: d.inMonth,
      trades,
      pnl,
      dayEntries,
      isToday,
    }
  })

  // Month totals
  const monthStats = useMemo(() => {
    const inMonthCells = cells.filter((c) => c.inMonth)
    let pnl = 0
    let trades = 0
    let wins = 0
    let losses = 0
    inMonthCells.forEach((c) => {
      pnl += c.pnl
      trades += c.trades.length
      c.trades.forEach((t) => {
        const r = getIdeaResult(t)
        if (r === 'WIN') wins++
        if (r === 'LOSS') losses++
      })
    })
    return { pnl, trades, wins, losses }
  }, [cells])

  const selectedCell = selectedDate ? cells.find((c) => c.dateStr === selectedDate) : null

  return (
    <div className="px-4 pt-4 pb-28">
      {/* Month header */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() =>
            setCurrentDate(new Date(year, month - 1, 1))
          }
          className="p-2 rounded-lg cursor-pointer border-0"
          style={{ background: 'var(--card)', color: 'var(--text)' }}
        >
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <div className="text-base font-semibold" style={{ color: 'var(--text)' }}>
            {monthLabel}
          </div>
          <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {monthStats.trades} trades · {monthStats.wins}W {monthStats.losses}L
          </div>
        </div>
        <button
          onClick={() =>
            setCurrentDate(new Date(year, month + 1, 1))
          }
          className="p-2 rounded-lg cursor-pointer border-0"
          style={{ background: 'var(--card)', color: 'var(--text)' }}
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Month P&L strip */}
      <div
        className="rounded-xl p-3 mb-3 flex items-center justify-between"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
        }}
      >
        <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Net P&L
        </div>
        <div
          className="text-lg font-bold font-mono"
          style={{ color: monthStats.pnl >= 0 ? 'var(--green)' : 'var(--red)' }}
        >
          {formatCurrency(monthStats.pnl)}
        </div>
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 gap-[4px] mb-1">
        {DAYS_OF_WEEK.map((d, i) => (
          <div
            key={i}
            className="text-center text-[10px] font-semibold uppercase"
            style={{ color: 'var(--text-muted)' }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-[4px]">
        {cells.map((c) => {
          const hasTrades = c.trades.length > 0
          const isWin = c.pnl > 0
          const isLoss = c.pnl < 0
          const isSelected = selectedDate === c.dateStr

          // Tile background tint
          let bg = 'var(--card)'
          let borderColor = 'var(--border)'
          if (isWin) {
            bg = 'color-mix(in srgb, var(--green) 14%, var(--card))'
            borderColor = 'color-mix(in srgb, var(--green) 30%, var(--border))'
          } else if (isLoss) {
            bg = 'color-mix(in srgb, var(--red) 14%, var(--card))'
            borderColor = 'color-mix(in srgb, var(--red) 30%, var(--border))'
          }
          if (c.isToday) {
            borderColor = 'var(--blue)'
          }
          if (isSelected) {
            borderColor = 'var(--text)'
          }

          return (
            <button
              key={c.key}
              onClick={() => setSelectedDate(c.dateStr)}
              disabled={!hasTrades && !c.inMonth}
              className="rounded-lg cursor-pointer transition-all border active:scale-95"
              style={{
                background: bg,
                borderColor,
                borderWidth: c.isToday || isSelected ? 1.5 : 1,
                aspectRatio: '1 / 1.15',
                padding: '3px 3px 4px',
                opacity: c.inMonth ? 1 : 0.35,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                alignItems: 'stretch',
              }}
            >
              {/* Day number */}
              <div
                className="text-[10px] font-bold text-left leading-none"
                style={{
                  color: c.isToday
                    ? 'var(--blue)'
                    : c.inMonth
                    ? 'var(--text)'
                    : 'var(--text-muted)',
                }}
              >
                {c.day}
              </div>

              {/* P&L + dots */}
              {hasTrades && (
                <div className="flex flex-col items-center gap-[2px]">
                  <div
                    className="text-[9px] font-bold font-mono leading-none"
                    style={{
                      color: isWin ? 'var(--green)' : isLoss ? 'var(--red)' : 'var(--text-muted)',
                    }}
                  >
                    {tinyPnl(c.pnl)}
                  </div>
                  <div className="flex gap-[2px]">
                    {c.dayEntries.map((e, j) => (
                      <TinyDot key={j} entry={e} />
                    ))}
                  </div>
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-3 mt-4 justify-center items-center flex-wrap">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full" style={{ background: 'var(--green)' }} />
          <span className="text-[10px] opacity-60">Win</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full" style={{ background: 'var(--red)' }} />
          <span className="text-[10px] opacity-60">Loss</span>
        </div>
        <div className="flex items-center gap-1">
          <div
            className="w-2 h-2 rounded-full"
            style={{ border: '1px solid var(--text-muted)', background: 'transparent' }}
          />
          <span className="text-[10px] opacity-60">Skipped</span>
        </div>
      </div>

      {/* Bottom Sheet for selected day */}
      <AnimatePresence>
        {selectedCell && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              style={{ background: 'rgba(0,0,0,0.55)' }}
              onClick={() => setSelectedDate(null)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed left-0 right-0 bottom-0 z-50 rounded-t-3xl overflow-hidden"
              style={{
                background: 'var(--surface)',
                borderTop: '1px solid var(--border)',
                maxHeight: '75vh',
                paddingBottom: 'env(safe-area-inset-bottom)',
              }}
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-2 pb-1">
                <div
                  className="w-10 h-1 rounded-full"
                  style={{ background: 'var(--text-muted)', opacity: 0.4 }}
                />
              </div>

              <div className="px-5 pt-2 pb-4 flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    {new Date(selectedCell.dateStr + 'T00:00:00').toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                  <div
                    className="text-xl font-bold font-mono mt-0.5"
                    style={{
                      color:
                        selectedCell.pnl > 0
                          ? 'var(--green)'
                          : selectedCell.pnl < 0
                          ? 'var(--red)'
                          : 'var(--text)',
                    }}
                  >
                    {selectedCell.pnl === 0 && selectedCell.trades.length === 0
                      ? 'No trades'
                      : formatCurrency(selectedCell.pnl)}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDate(null)}
                  className="p-2 rounded-lg border-0 cursor-pointer"
                  style={{ background: 'var(--card)', color: 'var(--text)' }}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="overflow-y-auto px-5 pb-6" style={{ maxHeight: 'calc(75vh - 110px)' }}>
                {selectedCell.trades.length === 0 ? (
                  <div className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>
                    No trades on this day
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedCell.trades.map((trade) => {
                      const result = getIdeaResult(trade)
                      const pnl = getNetPnl(trade)
                      const r = getNetR(trade)
                      return (
                        <button
                          key={trade.id}
                          onClick={() => {
                            openViewTrade(trade)
                            setSelectedDate(null)
                          }}
                          className="w-full p-3 rounded-xl border text-left cursor-pointer active:scale-[0.98] transition-transform"
                          style={{
                            background: 'var(--card)',
                            borderColor: 'var(--border)',
                          }}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
                                  {trade.instrument}
                                </span>
                                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                  · {trade.session}
                                </span>
                                {result && (
                                  <span
                                    className="ml-auto text-[9px] font-bold px-1.5 py-[2px] rounded"
                                    style={{
                                      background:
                                        result === 'WIN' ? 'var(--green-dim)' : 'var(--red-dim)',
                                      color: result === 'WIN' ? 'var(--green)' : 'var(--red)',
                                    }}
                                  >
                                    {result}
                                  </span>
                                )}
                              </div>
                              {trade.setup && (
                                <div className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
                                  {trade.setup}
                                </div>
                              )}
                            </div>
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
                            </div>
                            <div className="text-right">
                              <div
                                className="text-sm font-bold font-mono"
                                style={{ color: pnl >= 0 ? 'var(--green)' : 'var(--red)' }}
                              >
                                {formatCurrency(pnl)}
                              </div>
                              <div
                                className="text-[10px] font-semibold"
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
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
