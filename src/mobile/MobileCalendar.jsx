import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { getIdeaResult, getNetPnl, getNetR, formatCurrency } from '../lib/store'

// ═══════════════════════════════════════════════════
// MOBILE CALENDAR — Weekday-only grid tuned for phones
//   • 5 day cols (M–F) + 1 weekly-total col
//   • Each day tile: day number top-left · tiny ±P&L (k-scaled) · entry dots
//   • Padding cells from adjacent months (e.g. May 1 in the April grid) are
//     shown faded, and roll into the weekly column for that row — same
//     behavior as the desktop calendar.
//   • Background tint: green for +day, red for −day
//   • Tap tile → bottom sheet with that day's trades
// ═══════════════════════════════════════════════════

const DAYS_OF_WEEK = ['M', 'T', 'W', 'T', 'F']

// Local date string helper (avoids UTC shift from toISOString)
const toDateStr = (y, m, d) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

// Build a Mon-first grid of weeks. Each cell carries its real
// { year, monthIdx, day }, including padding cells from adjacent months.
// Only Mon–Fri are returned per row; Sat/Sun are dropped.
function buildMobileGrid(year, month) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDayOfWeek = (firstDay.getDay() + 6) % 7 // Mon=0
  const daysInMonth = lastDay.getDate()

  const prevMonthYear = month === 0 ? year - 1 : year
  const prevMonthIdx = month === 0 ? 11 : month - 1
  const prevMonthLast = new Date(year, month, 0).getDate()

  const nextMonthYear = month === 11 ? year + 1 : year
  const nextMonthIdx = month === 11 ? 0 : month + 1

  const days = []
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    days.push({ day: prevMonthLast - i, inMonth: false, year: prevMonthYear, monthIdx: prevMonthIdx })
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({ day: i, inMonth: true, year, monthIdx: month })
  }
  const remaining = Math.ceil(days.length / 7) * 7 - days.length
  for (let i = 1; i <= remaining; i++) {
    days.push({ day: i, inMonth: false, year: nextMonthYear, monthIdx: nextMonthIdx })
  }

  // Group into Mon-first weeks of 7, drop Sat/Sun (last 2 cells per week).
  // Skip any week whose visible Mon–Fri cells contain zero in-month days
  // (happens for months that start on Sat/Sun — without this, the first row
  // would be entirely faded prev-month days, which is just visual noise).
  const weeks = []
  for (let i = 0; i < days.length; i += 7) {
    const weekdays = days.slice(i, i + 5)
    if (weekdays.some((d) => d.inMonth)) weeks.push(weekdays)
  }
  return weeks
}

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
  const [accountFilter, setAccountFilter] = useState(null) // null = all, or slot number

  const accounts = state.accounts || []

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const monthLabel = currentDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  // Filtered PnL/R helpers
  const filteredPnl = (trade) => {
    return trade.entries.reduce((sum, e) => {
      if (!e.triggered) return sum
      if (accountFilter != null && e.slot !== accountFilter) return sum
      return sum + (e.pnl || 0)
    }, 0)
  }
  const filteredR = (trade) => {
    return trade.entries.reduce((sum, e) => {
      if (!e.triggered) return sum
      if (accountFilter != null && e.slot !== accountFilter) return sum
      if (e.result === 'W') return sum + (e.r || 0)
      if (e.result === 'L') return sum - 1
      return sum
    }, 0)
  }
  const tradeMatchesFilter = (trade) => {
    if (accountFilter == null) return true
    return trade.entries.some((e) => e.triggered && e.slot === accountFilter)
  }

  // Group trades by date
  const tradesByDate = useMemo(() => {
    const map = {}
    ;(state.trades || []).forEach((t) => {
      if (!map[t.date]) map[t.date] = []
      map[t.date].push(t)
    })
    return map
  }, [state.trades])

  // Build weeks of weekday cells (each cell carries its own date)
  const weeks = useMemo(() => buildMobileGrid(year, month), [year, month])

  const todayStr = useMemo(() => {
    const t = new Date()
    return toDateStr(t.getFullYear(), t.getMonth(), t.getDate())
  }, [])

  // Hydrate each cell with its trades, PnL, dots, and today flag.
  // Padding cells (from prev/next month) are included so faded tiles still
  // show their PnL and roll into weekly totals.
  const weekCells = useMemo(() => {
    return weeks.map((week) =>
      week.map((d, i) => {
        const dateStr = toDateStr(d.year, d.monthIdx, d.day)
        const allTrades = tradesByDate[dateStr] || []
        const trades = allTrades.filter(tradeMatchesFilter)
        const pnl = trades.reduce((s, t) => s + filteredPnl(t), 0)

        const slotsToShow = accountFilter != null ? [accountFilter] : [1, 2, 3]
        const dayEntries = slotsToShow.map((slot) => {
          for (const t of allTrades) {
            const e = (t.entries || []).find((en) => en.slot === slot && en.triggered)
            if (e) return e
          }
          return { slot, triggered: false }
        })

        return {
          key: `${dateStr}-${i}`,
          dateStr,
          day: d.day,
          inMonth: d.inMonth,
          trades,
          pnl,
          dayEntries,
          isToday: dateStr === todayStr,
        }
      })
    )
  }, [weeks, tradesByDate, accountFilter, todayStr])

  // Weekly totals — include padding-day trades, mirrors desktop calendar.
  const weeklyStats = useMemo(() => {
    return weekCells.map((week, wi) => {
      let pnl = 0
      let tradeDays = 0
      week.forEach((c) => {
        if (c.trades.length === 0) return
        tradeDays++
        pnl += c.pnl
      })
      return { pnl, tradeDays, weekNum: wi + 1 }
    })
  }, [weekCells])

  // Month totals — in-month days only, so the top "Net P&L" stays April-only.
  const monthStats = useMemo(() => {
    let pnl = 0
    let trades = 0
    let wins = 0
    let losses = 0
    weekCells.flat().forEach((c) => {
      if (!c.inMonth) return
      pnl += c.pnl
      trades += c.trades.length
      c.trades.forEach((t) => {
        const r = getIdeaResult(t)
        if (r === 'WIN') wins++
        if (r === 'LOSS') losses++
      })
    })
    return { pnl, trades, wins, losses }
  }, [weekCells])

  const allCells = useMemo(() => weekCells.flat(), [weekCells])
  const selectedCell = selectedDate ? allCells.find((c) => c.dateStr === selectedDate) : null

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

      {/* Account filter */}
      {accounts.length > 0 && (
        <div className="flex gap-1 rounded-xl p-1 mb-3 overflow-x-auto" style={{ background: 'var(--surface)' }}>
          <button
            onClick={() => setAccountFilter(null)}
            className="px-2.5 py-1 rounded-lg text-[10px] font-medium border-0 cursor-pointer whitespace-nowrap"
            style={{
              background: accountFilter == null ? 'var(--blue)' : 'transparent',
              color: accountFilter == null ? '#fff' : 'var(--text-muted)',
            }}
          >
            All
          </button>
          {accounts.map((a) => (
            <button
              key={a.id}
              onClick={() => setAccountFilter(a.slot)}
              className="px-2.5 py-1 rounded-lg text-[10px] font-medium border-0 cursor-pointer whitespace-nowrap"
              style={{
                background: accountFilter === a.slot ? 'var(--blue)' : 'transparent',
                color: accountFilter === a.slot ? '#fff' : 'var(--text-muted)',
              }}
            >
              {a.name}
            </button>
          ))}
        </div>
      )}

      {/* Day-of-week header (M–F + weekly column) */}
      <div className="grid gap-[3px] mb-1" style={{ gridTemplateColumns: 'repeat(6, minmax(0, 1fr))' }}>
        {DAYS_OF_WEEK.map((d, i) => (
          <div
            key={i}
            className="text-center text-[10px] font-semibold uppercase"
            style={{ color: 'var(--text-muted)' }}
          >
            {d}
          </div>
        ))}
        <div
          className="text-center text-[10px] font-semibold uppercase"
          style={{ color: 'var(--text-muted)' }}
        >
          WK
        </div>
      </div>

      {/* Grid — one row per week, last column is the weekly total */}
      <div className="flex flex-col gap-[3px]">
        {weekCells.map((week, wi) => {
          const ws = weeklyStats[wi]
          return (
            <div
              key={wi}
              className="grid gap-[3px]"
              style={{ gridTemplateColumns: 'repeat(6, minmax(0, 1fr))' }}
            >
              {week.map((c) => {
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

              {/* Weekly total cell */}
              <div
                className="rounded-lg border flex flex-col justify-center items-center"
                style={{
                  background: 'var(--surface)',
                  borderColor: 'var(--border)',
                  aspectRatio: '1 / 1.15',
                  padding: '3px 4px 4px',
                  minWidth: 0,
                  overflow: 'hidden',
                }}
              >
                <div
                  className="text-[8px] font-semibold uppercase tracking-wider leading-none mb-0.5"
                  style={{ color: 'var(--text-muted)' }}
                >
                  W{ws.weekNum}
                </div>
                <div
                  className="text-[10px] font-bold font-mono leading-tight"
                  style={{
                    color:
                      ws.pnl > 0
                        ? 'var(--green)'
                        : ws.pnl < 0
                        ? 'var(--red)'
                        : 'var(--text-muted)',
                  }}
                >
                  {ws.tradeDays === 0 ? '—' : ws.pnl === 0 ? '$0' : tinyPnl(ws.pnl)}
                </div>
                {ws.tradeDays > 0 && (
                  <div className="text-[8px] font-medium leading-none mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {ws.tradeDays}d
                  </div>
                )}
              </div>
            </div>
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
                      const pnl = filteredPnl(trade)
                      const r = filteredR(trade)
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
