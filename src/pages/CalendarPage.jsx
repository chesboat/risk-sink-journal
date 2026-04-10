import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react'
import { getIdeaResult, getNetPnl, getNetR, formatPnl, ENTRY_COLORS, formatDate } from '../lib/store'

const WEEKDAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

// Local date string helper (avoids UTC shift from toISOString)
const toDateStr = (y, m, d) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

// Generate calendar grid starting on Sunday
function buildCalendarGrid(year, month) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDayOfWeek = firstDay.getDay() // Sun=0
  const daysInMonth = lastDay.getDate()

  const days = []
  // Previous month padding
  const prevMonthLast = new Date(year, month, 0).getDate()
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    days.push({ day: prevMonthLast - i, inMonth: false })
  }
  // Current month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({ day: i, inMonth: true })
  }
  // Next month padding to fill remaining rows
  const remaining = Math.ceil(days.length / 7) * 7 - days.length
  for (let i = 1; i <= remaining; i++) {
    days.push({ day: i, inMonth: false })
  }

  // Split into weeks (rows of 7)
  const weeks = []
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7))
  }
  return weeks
}

export default function CalendarPage({ state, openEditTrade }) {
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth())
  const [selectedDate, setSelectedDate] = useState(null)

  // Group trades by date
  const tradesByDate = useMemo(() => {
    const map = {}
    ;(state.trades || []).forEach(trade => {
      if (!map[trade.date]) map[trade.date] = []
      map[trade.date].push(trade)
    })
    return map
  }, [state.trades])

  // Build calendar grid
  const weeks = useMemo(() => buildCalendarGrid(year, month), [year, month])

  // Get day stats
  const getDayStats = (dayObj) => {
    if (!dayObj.inMonth) return null
    const dateStr = toDateStr(year, month, dayObj.day)
    const dayTrades = tradesByDate[dateStr]
    if (!dayTrades || dayTrades.length === 0) return null

    let pnl = 0
    let totalR = 0
    let hasWin = false
    let hasLoss = false

    dayTrades.forEach(trade => {
      pnl += getNetPnl(trade)
      totalR += getNetR(trade)
      const result = getIdeaResult(trade)
      if (result === 'WIN') hasWin = true
      if (result === 'LOSS') hasLoss = true
    })

    return {
      pnl,
      totalR,
      tradeCount: dayTrades.length,
      isWin: pnl > 0,
      isLoss: pnl < 0,
      dateStr,
    }
  }

  // Weekly totals
  const weeklyStats = useMemo(() => {
    return weeks.map((week, wi) => {
      let pnl = 0
      let tradeDays = 0

      week.forEach(dayObj => {
        if (!dayObj.inMonth) return
        const dateStr = toDateStr(year, month, dayObj.day)
        const dayTrades = tradesByDate[dateStr]
        if (!dayTrades || dayTrades.length === 0) return
        tradeDays++
        dayTrades.forEach(trade => { pnl += getNetPnl(trade) })
      })

      return { pnl, tradeDays, weekNum: wi + 1 }
    })
  }, [weeks, year, month, tradesByDate])

  // Monthly totals
  const monthlyStats = useMemo(() => {
    let totalPnl = 0
    let tradeDays = 0

    weeks.flat().forEach(dayObj => {
      if (!dayObj.inMonth) return
      const dateStr = toDateStr(year, month, dayObj.day)
      const dayTrades = tradesByDate[dateStr]
      if (!dayTrades || dayTrades.length === 0) return
      tradeDays++
      dayTrades.forEach(trade => { totalPnl += getNetPnl(trade) })
    })

    return { totalPnl, tradeDays }
  }, [weeks, year, month, tradesByDate])

  // Navigate months
  const goToday = () => {
    setYear(new Date().getFullYear())
    setMonth(new Date().getMonth())
  }
  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1) }
    else setMonth(month - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1) }
    else setMonth(month + 1)
  }

  const isToday = (dayObj) => {
    if (!dayObj.inMonth) return false
    const today = new Date()
    return dayObj.day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
  }

  // Selected day trades
  const selectedDayTrades = useMemo(() => {
    if (!selectedDate) return []
    return tradesByDate[selectedDate] || []
  }, [selectedDate, tradesByDate])

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={prevMonth}
            className="p-2 rounded-lg cursor-pointer transition-colors border-0 flex items-center justify-center"
            style={{ background: 'var(--surface)', color: 'var(--text-dim)', width: 36, height: 36 }}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={goToday}
            className="px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer border-0 uppercase tracking-wider"
            style={{ background: 'var(--surface)', color: 'var(--accent)' }}
          >
            Today
          </button>
          <button
            onClick={nextMonth}
            className="p-2 rounded-lg cursor-pointer transition-colors border-0 flex items-center justify-center"
            style={{ background: 'var(--surface)', color: 'var(--text-dim)', width: 36, height: 36 }}
          >
            <ChevronRight size={18} />
          </button>
          <h2 className="text-xl font-bold ml-2" style={{ color: 'var(--text)' }}>
            {MONTH_NAMES[month]} {year}
          </h2>
        </div>

        {/* Monthly Stats Badge */}
        <div className="flex items-center gap-3">
          <span className="text-sm" style={{ color: 'var(--text-dim)' }}>Monthly stats:</span>
          <span
            className="px-3 py-1 rounded-lg text-sm font-bold"
            style={{
              background: monthlyStats.totalPnl >= 0 ? 'var(--green-dim)' : 'var(--red-dim)',
              color: monthlyStats.totalPnl >= 0 ? 'var(--green)' : 'var(--red)',
            }}
          >
            {formatPnl(monthlyStats.totalPnl)}
          </span>
          <span className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>
            {monthlyStats.tradeDays} day{monthlyStats.tradeDays !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Calendar Grid + Weekly Sidebar */}
      <div className="flex gap-0 rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        {/* Main Grid */}
        <div className="flex-1">
          {/* Weekday Headers */}
          <div className="grid grid-cols-7" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
            {WEEKDAY_HEADERS.map(day => (
              <div
                key={day}
                className="py-2.5 text-center text-xs font-semibold"
                style={{ color: 'var(--text-dim)', borderRight: '1px solid var(--border)' }}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Week Rows */}
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7" style={{ borderBottom: wi < weeks.length - 1 ? '1px solid var(--border)' : 'none' }}>
              {week.map((dayObj, di) => {
                const stats = getDayStats(dayObj)
                const today = isToday(dayObj)
                const hasTrades = !!stats
                const dateStr = dayObj.inMonth ? toDateStr(year, month, dayObj.day) : null

                return (
                  <div
                    key={di}
                    onClick={() => {
                      if (hasTrades && dateStr) setSelectedDate(dateStr)
                    }}
                    className="relative flex flex-col transition-all"
                    style={{
                      minHeight: 100,
                      borderRight: '1px solid var(--border)',
                      background: hasTrades
                        ? stats.isWin
                          ? 'rgba(48, 209, 88, 0.12)'
                          : stats.isLoss
                            ? 'rgba(255, 69, 58, 0.12)'
                            : 'var(--card)'
                        : dayObj.inMonth ? 'var(--card)' : 'var(--surface)',
                      cursor: hasTrades ? 'pointer' : 'default',
                      opacity: dayObj.inMonth ? 1 : 0.35,
                    }}
                  >
                    {/* Day number + today badge */}
                    <div className="flex items-center justify-between px-2 pt-1.5">
                      {hasTrades && (
                        <FileText size={13} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
                      )}
                      {!hasTrades && <span />}
                      <span
                        className="text-xs font-semibold"
                        style={{
                          color: today ? 'var(--accent)' : 'var(--text-dim)',
                          background: today ? 'var(--blue-dim)' : 'transparent',
                          borderRadius: today ? 999 : 0,
                          padding: today ? '1px 7px' : 0,
                        }}
                      >
                        {dayObj.day}
                      </span>
                    </div>

                    {/* Day Stats */}
                    {hasTrades && (
                      <div className="flex-1 flex flex-col items-center justify-center px-2 pb-2">
                        <div
                          className="text-lg font-bold leading-tight"
                          style={{ color: stats.pnl >= 0 ? 'var(--green)' : 'var(--red)' }}
                        >
                          {formatPnl(stats.pnl)}
                        </div>
                        <div className="text-[11px] font-medium" style={{ color: stats.pnl >= 0 ? 'var(--green)' : 'var(--red)', opacity: 0.8 }}>
                          {stats.tradeCount} trade{stats.tradeCount !== 1 ? 's' : ''}
                        </div>
                        <div className="text-[11px] font-medium" style={{ color: stats.totalR >= 0 ? 'var(--green)' : 'var(--red)', opacity: 0.6 }}>
                          {stats.totalR >= 0 ? '+' : ''}{stats.totalR.toFixed(2)}R
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* Weekly Totals Sidebar */}
        <div className="flex flex-col" style={{ width: 130, background: 'var(--surface)', borderLeft: '1px solid var(--border)' }}>
          {/* Header spacer */}
          <div className="py-2.5 text-center text-xs font-semibold" style={{ color: 'var(--text-dim)', borderBottom: '1px solid var(--border)' }}>
            Weekly
          </div>

          {/* Weekly rows */}
          {weeklyStats.map((ws, i) => (
            <div
              key={i}
              className="flex-1 flex flex-col items-center justify-center px-3"
              style={{ borderBottom: i < weeklyStats.length - 1 ? '1px solid var(--border)' : 'none', minHeight: 100 }}
            >
              <div className="text-xs font-semibold mb-1" style={{ color: 'var(--text-dim)' }}>
                Week {ws.weekNum}
              </div>
              <div
                className="text-lg font-bold"
                style={{ color: ws.pnl > 0 ? 'var(--green)' : ws.pnl < 0 ? 'var(--red)' : 'var(--text-muted)' }}
              >
                {formatPnl(ws.pnl)}
              </div>
              <div className="text-[11px] font-medium" style={{ color: 'var(--accent)' }}>
                {ws.tradeDays} day{ws.tradeDays !== 1 ? 's' : ''}
              </div>
            </div>
          ))}
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
            className="p-5 rounded-2xl"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            {/* Panel Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold" style={{ color: 'var(--text)' }}>
                {formatDate(selectedDate)} — {selectedDayTrades.length} trade{selectedDayTrades.length !== 1 ? 's' : ''}
              </h3>
              <button
                onClick={() => setSelectedDate(null)}
                className="text-sm px-3 py-1.5 rounded-lg cursor-pointer border-0 transition-colors"
                style={{ background: 'var(--surface)', color: 'var(--text-dim)' }}
              >
                Close
              </button>
            </div>

            {/* Trades List */}
            <div className="space-y-3">
              {selectedDayTrades.map((trade, idx) => {
                const ideaResult = getIdeaResult(trade)
                const tradePnl = getNetPnl(trade)
                const tradeR = getNetR(trade)
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
                    className="w-full p-4 rounded-xl text-left cursor-pointer transition-all border-0"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                    whileHover={{ x: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                          {trade.instrument} · {trade.setup || 'No setup'}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--text-dim)' }}>
                          {trade.session}
                        </div>
                        {trade.thesis && (
                          <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                            {trade.thesis.length > 60 ? trade.thesis.slice(0, 60) + '...' : trade.thesis}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold" style={{ color: tradePnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                          {formatPnl(tradePnl)}
                        </div>
                        <div className="text-xs font-medium" style={{ color: tradeR >= 0 ? 'var(--green)' : 'var(--red)' }}>
                          {tradeR >= 0 ? '+' : ''}{tradeR.toFixed(2)}R
                        </div>
                        {ideaResult && (
                          <div
                            className="text-[10px] font-bold mt-0.5 px-1.5 py-0.5 rounded inline-block"
                            style={{
                              background: ideaResult === 'WIN' ? 'var(--green-dim)' : 'var(--red-dim)',
                              color: ideaResult === 'WIN' ? 'var(--green)' : 'var(--red)',
                            }}
                          >
                            {ideaResult}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Entry Results + Tags */}
                    <div className="flex gap-2 flex-wrap">
                      {triggeredEntries.map((entry, entryIdx) => (
                        <div
                          key={entryIdx}
                          className="px-2 py-0.5 rounded-lg text-[11px] font-semibold flex items-center gap-1"
                          style={{
                            background: 'var(--card)',
                            color: entry.result === 'W' ? 'var(--green)' : entry.result === 'L' ? 'var(--red)' : 'var(--text-dim)',
                            border: `1px solid ${entry.result === 'W' ? 'var(--green)' : entry.result === 'L' ? 'var(--red)' : 'var(--border)'}`,
                          }}
                        >
                          <span>E{entry.slot}</span>
                          <span>{entry.result}</span>
                        </div>
                      ))}
                      {/* Show tags */}
                      {[...(trade.tags?.confirmations || []), ...(trade.tags?.mistakes || [])].slice(0, 3).map((tag, ti) => {
                        const isMistake = (trade.tags?.mistakes || []).includes(tag)
                        return (
                          <span key={ti} className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                            style={{
                              background: isMistake ? 'var(--red-dim)' : 'var(--green-dim)',
                              color: isMistake ? 'var(--red)' : 'var(--green)',
                            }}>
                            {tag}
                          </span>
                        )
                      })}
                    </div>
                  </motion.button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
