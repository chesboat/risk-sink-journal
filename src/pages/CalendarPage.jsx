import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getCalendarDays, getIdeaResult, getNetPnl, formatPnl, ENTRY_COLORS, formatDate } from '../lib/store'

const WEEKDAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export default function CalendarPage({ state, openEditTrade }) {
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth())
  const [selectedDate, setSelectedDate] = useState(null)

  // Group trades by date
  const tradesByDate = useMemo(() => {
    const map = {}
    state.trades.forEach(trade => {
      if (!map[trade.date]) map[trade.date] = []
      map[trade.date].push(trade)
    })
    return map
  }, [state.trades])

  // Get calendar days for current month
  const days = useMemo(() => getCalendarDays(year, month), [year, month])

  // Calculate monthly P&L stats
  const monthlyStats = useMemo(() => {
    const monthDays = days.filter(d => d.inMonth)
    let totalPnl = 0
    let winDays = 0
    let lossDays = 0
    let tradeDays = 0

    monthDays.forEach(dayObj => {
      const dateStr = new Date(year, month, dayObj.day).toISOString().slice(0, 10)
      const dayTrades = tradesByDate[dateStr]
      if (!dayTrades || dayTrades.length === 0) return

      tradeDays++
      let dayPnl = 0
      let hasWin = false
      let hasLoss = false

      dayTrades.forEach(trade => {
        dayPnl += getNetPnl(trade)
        const result = getIdeaResult(trade)
        if (result === 'WIN') hasWin = true
        if (result === 'LOSS') hasLoss = true
      })

      totalPnl += dayPnl
      if (hasWin && !hasLoss) winDays++
      if (hasLoss) lossDays++
    })

    return { totalPnl, tradeDays, winDays, lossDays }
  }, [days, month, year, tradesByDate])

  // Navigate months
  const prevMonth = () => {
    if (month === 0) {
      setMonth(11)
      setYear(year - 1)
    } else {
      setMonth(month - 1)
    }
  }

  const nextMonth = () => {
    if (month === 11) {
      setMonth(0)
      setYear(year + 1)
    } else {
      setMonth(month + 1)
    }
  }

  // Get trades for selected date
  const selectedDayTrades = useMemo(() => {
    if (!selectedDate) return []
    return tradesByDate[selectedDate] || []
  }, [selectedDate, tradesByDate])

  const isToday = (dayObj) => {
    if (!dayObj.inMonth) return false
    const today = new Date()
    return (
      dayObj.day === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear()
    )
  }

  const getDayData = (dayObj) => {
    if (!dayObj.inMonth) return { pnl: 0, dayPnl: 0, isWin: false, isLoss: false, entries: [] }

    const dateStr = new Date(year, month, dayObj.day).toISOString().slice(0, 10)
    const dayTrades = tradesByDate[dateStr]

    if (!dayTrades || dayTrades.length === 0) {
      return { pnl: 0, dayPnl: 0, isWin: false, isLoss: false, entries: [] }
    }

    let dayPnl = 0
    let hasWin = false
    let hasLoss = false
    const entries = []

    dayTrades.forEach(trade => {
      dayPnl += getNetPnl(trade)
      const result = getIdeaResult(trade)
      if (result === 'WIN') hasWin = true
      if (result === 'LOSS') hasLoss = true

      // Collect entry slot results (use first triggered entry for each slot)
      trade.entries.forEach(entry => {
        if (entry.triggered && entry.result) {
          entries.push({
            slot: entry.slot,
            result: entry.result,
            pnl: entry.pnl
          })
        }
      })
    })

    return {
      pnl: dayPnl,
      dayPnl,
      isWin: hasWin && !hasLoss,
      isLoss: hasLoss,
      entries: entries.slice(0, 6) // Limit to 6 dots for space
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold mb-1">Trading Calendar</h1>
        <p className="text-sm" style={{ color: 'var(--text-dim)' }}>
          Visual view of your daily trading performance
        </p>
      </div>

      {/* Month Navigation & Stats */}
      <div className="flex items-center justify-between p-4 rounded-2xl" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3">
          <button
            onClick={prevMonth}
            className="p-2 rounded-lg cursor-pointer transition-colors border-0 flex items-center justify-center"
            style={{
              background: 'var(--surface)',
              color: 'var(--text-dim)',
              width: 36,
              height: 36
            }}
          >
            <ChevronLeft size={18} />
          </button>
          <h2 className="text-lg font-semibold min-w-[140px] text-center">
            {MONTH_NAMES[month]} {year}
          </h2>
          <button
            onClick={nextMonth}
            className="p-2 rounded-lg cursor-pointer transition-colors border-0 flex items-center justify-center"
            style={{
              background: 'var(--surface)',
              color: 'var(--text-dim)',
              width: 36,
              height: 36
            }}
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* P&L Summary */}
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-xs" style={{ color: 'var(--text-dim)' }}>P&L</div>
            <div
              className="text-lg font-bold"
              style={{ color: monthlyStats.totalPnl >= 0 ? 'var(--green)' : 'var(--red)' }}
            >
              {formatPnl(monthlyStats.totalPnl)}
            </div>
          </div>
          <div className="w-px h-8" style={{ background: 'var(--border)' }} />
          <div className="text-right">
            <div className="text-xs" style={{ color: 'var(--text-dim)' }}>Trade Days</div>
            <div className="text-lg font-bold">{monthlyStats.tradeDays}</div>
          </div>
          <div className="w-px h-8" style={{ background: 'var(--border)' }} />
          <div className="text-right">
            <div className="text-xs" style={{ color: 'var(--text-dim)' }}>W/L</div>
            <div className="text-lg font-bold">
              <span style={{ color: 'var(--green)' }}>{monthlyStats.winDays}</span>
              <span style={{ color: 'var(--text-dim)' }}> / </span>
              <span style={{ color: 'var(--red)' }}>{monthlyStats.lossDays}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="p-4 rounded-2xl" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 gap-3 mb-3">
          {WEEKDAY_HEADERS.map(day => (
            <div
              key={day}
              className="py-2 text-center text-xs font-semibold"
              style={{ color: 'var(--text-dim)' }}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7 gap-3">
          {days.map((dayObj, idx) => {
            const data = getDayData(dayObj)
            const dateStr = new Date(year, month, dayObj.day).toISOString().slice(0, 10)
            const today = isToday(dayObj)
            const hasClickableTrades = dayObj.inMonth && tradesByDate[dateStr] && tradesByDate[dateStr].length > 0

            return (
              <motion.button
                key={idx}
                onClick={() => {
                  if (hasClickableTrades) {
                    setSelectedDate(dateStr)
                  }
                }}
                className="relative rounded-[10px] aspect-square flex flex-col items-center justify-center transition-all border-0 cursor-pointer"
                style={{
                  background: dayObj.inMonth
                    ? data.isWin
                      ? 'var(--green-dim)'
                      : data.isLoss
                        ? 'var(--red-dim)'
                        : 'var(--surface)'
                    : 'transparent',
                  border: today ? '2px solid var(--blue)' : `1px solid var(--border)`,
                  opacity: dayObj.inMonth ? 1 : 0.25,
                  boxShadow: today ? '0 0 12px rgba(10, 132, 255, 0.3)' : 'none',
                }}
                whileHover={dayObj.inMonth ? { scale: 1.04 } : {}}
                whileTap={dayObj.inMonth ? { scale: 0.96 } : {}}
              >
                {/* Day Number */}
                <span
                  className="text-sm font-semibold mb-1"
                  style={{ color: dayObj.inMonth ? 'var(--text)' : 'var(--text-muted)' }}
                >
                  {dayObj.day}
                </span>

                {/* P&L if exists */}
                {dayObj.inMonth && data.dayPnl !== 0 && (
                  <span
                    className="text-xs font-bold mb-1"
                    style={{
                      color: data.dayPnl >= 0 ? 'var(--green)' : 'var(--red)'
                    }}
                  >
                    {formatPnl(data.dayPnl)}
                  </span>
                )}

                {/* Entry Dots */}
                {dayObj.inMonth && data.entries.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap justify-center max-w-full">
                    {data.entries.map((entry, entryIdx) => (
                      <div
                        key={entryIdx}
                        className="w-2 h-2 rounded-full"
                        style={{
                          background: entry.result === 'W'
                            ? ENTRY_COLORS[entry.slot]
                            : entry.result === 'L'
                              ? 'var(--red)'
                              : 'var(--text-muted)',
                          opacity: entry.result === 'W' ? 1 : 0.6
                        }}
                      />
                    ))}
                  </div>
                )}
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* Day Detail Panel */}
      <AnimatePresence>
        {selectedDate && selectedDayTrades.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="mt-4 p-4 rounded-2xl"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            {/* Panel Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">
                {formatDate(selectedDate)} — {selectedDayTrades.length} trade{selectedDayTrades.length !== 1 ? 's' : ''}
              </h3>
              <button
                onClick={() => setSelectedDate(null)}
                className="text-sm px-3 py-1.5 rounded-lg cursor-pointer border-0 transition-colors"
                style={{
                  background: 'var(--surface)',
                  color: 'var(--text-dim)'
                }}
              >
                Close
              </button>
            </div>

            {/* Trades List */}
            <div className="space-y-3">
              {selectedDayTrades.map((trade, idx) => {
                const ideaResult = getIdeaResult(trade)
                const tradePnl = getNetPnl(trade)
                const triggeredEntries = trade.entries.filter(e => e.triggered && e.result)

                return (
                  <motion.button
                    key={trade.id}
                    onClick={() => {
                      openEditTrade(trade)
                      setSelectedDate(null)
                    }}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="w-full p-3 rounded-xl text-left cursor-pointer transition-all border-0"
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)'
                    }}
                    whileHover={{ x: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="text-sm font-semibold">
                          {trade.instrument} · {trade.setup || 'No setup'}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--text-dim)' }}>
                          {trade.session}
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className="text-sm font-bold"
                          style={{
                            color: tradePnl >= 0 ? 'var(--green)' : 'var(--red)'
                          }}
                        >
                          {formatPnl(tradePnl)}
                        </div>
                        {ideaResult && (
                          <div
                            className="text-xs font-semibold"
                            style={{
                              color: ideaResult === 'WIN' ? 'var(--green)' : ideaResult === 'LOSS' ? 'var(--red)' : 'var(--text-dim)'
                            }}
                          >
                            {ideaResult}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Entry Results */}
                    <div className="flex gap-2 flex-wrap">
                      {triggeredEntries.map((entry, entryIdx) => (
                        <div
                          key={entryIdx}
                          className="px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1"
                          style={{
                            background: 'var(--card)',
                            color: entry.result === 'W'
                              ? ENTRY_COLORS[entry.slot]
                              : entry.result === 'L'
                                ? 'var(--red)'
                                : 'var(--text-dim)',
                            border: `1px solid ${entry.result === 'W'
                              ? ENTRY_COLORS[entry.slot]
                              : entry.result === 'L'
                                ? 'var(--red)'
                                : 'var(--border)'
                            }`
                          }}
                        >
                          <span>E{entry.slot}</span>
                          <span>{entry.result}</span>
                          {entry.pnl !== 0 && (
                            <span>{formatPnl(entry.pnl)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </motion.button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty State */}
      {selectedDate && selectedDayTrades.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="text-center py-8"
          style={{ color: 'var(--text-dim)' }}
        >
          <p className="text-sm">No trades on {formatDate(selectedDate)}</p>
          <button
            onClick={() => setSelectedDate(null)}
            className="mt-2 text-xs px-3 py-1.5 rounded-lg cursor-pointer border-0 transition-colors"
            style={{
              background: 'var(--surface)',
              color: 'var(--text-dim)'
            }}
          >
            Close
          </button>
        </motion.div>
      )}
    </div>
  )
}
