import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, FileText, Bot, User, Filter, X } from 'lucide-react'
import {
  getIdeaResult,
  getNetPnl,
  getNetR,
  formatPnl,
  ENTRY_COLORS,
  formatDate,
  getManualAccounts,
  getBotAccounts,
  getStrategyAt,
  getAllStrategyNames,
  tradeInAccountWindow,
} from '../lib/store'

const WEEKDAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

// Local date string helper (avoids UTC shift from toISOString)
const toDateStr = (y, m, d) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

// Generate calendar grid starting on Sunday
// Each cell carries its real { year, monthIdx, day } so padding cells from the
// previous/next month can still resolve to a trade date.
function buildCalendarGrid(year, month) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDayOfWeek = firstDay.getDay() // Sun=0
  const daysInMonth = lastDay.getDate()

  const prevMonthYear = month === 0 ? year - 1 : year
  const prevMonthIdx = month === 0 ? 11 : month - 1
  const prevMonthLast = new Date(year, month, 0).getDate()

  const nextMonthYear = month === 11 ? year + 1 : year
  const nextMonthIdx = month === 11 ? 0 : month + 1

  const days = []
  // Previous month padding
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    days.push({ day: prevMonthLast - i, inMonth: false, year: prevMonthYear, monthIdx: prevMonthIdx })
  }
  // Current month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({ day: i, inMonth: true, year, monthIdx: month })
  }
  // Next month padding to fill remaining rows
  const remaining = Math.ceil(days.length / 7) * 7 - days.length
  for (let i = 1; i <= remaining; i++) {
    days.push({ day: i, inMonth: false, year: nextMonthYear, monthIdx: nextMonthIdx })
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

  // ── Filters ──
  // source: 'all' | 'manual' | 'bot'
  // accountId: account.id from state.accounts, or null for all accounts
  // strategy: strategy name string, or null for all strategies
  // instrument: symbol, or null for all
  const [source, setSource] = useState('all')
  const [accountId, setAccountId] = useState(null)
  const [strategy, setStrategy] = useState(null)
  const [instrument, setInstrument] = useState(null)

  const allAccounts = state.accounts || []
  // All manual accounts (archived included, sorted last) so history stays filterable
  const manualAccounts = useMemo(
    () => getManualAccounts(allAccounts).sort((a, b) => (a.archived ? 1 : 0) - (b.archived ? 1 : 0)),
    [allAccounts]
  )
  const botAccounts = useMemo(() => getBotAccounts(allAccounts), [allAccounts])
  const assignments = state.strategyAssignments || []
  const strategyNames = useMemo(() => getAllStrategyNames(assignments), [assignments])

  // When source flips, clear filters that no longer apply
  const setSourceSafe = (next) => {
    setSource(next)
    if (next === 'manual') { setStrategy(null) }
    // If the selected account is the wrong kind for the new source, clear it
    if (accountId != null) {
      const acct = allAccounts.find(a => String(a.id) === String(accountId))
      const acctKind = acct?.kind || 'manual'
      if ((next === 'manual' && acctKind !== 'manual') || (next === 'bot' && acctKind !== 'bot')) {
        setAccountId(null)
      }
    }
  }

  // ── Manual-trade filtering ──
  // A manual trade contributes if at least one entry matches the active filters.
  // Entry-level filtering lets us also compute partial-account PnL correctly.
  // Manual accounts are generational: an account owns an entry when the slots
  // match AND the trade date falls in the account's active window. IDs are
  // compared as strings because legacy accounts have numeric ids while the
  // <select> yields strings.
  const selectedManualAccount = accountId != null
    ? manualAccounts.find(a => String(a.id) === String(accountId)) || null
    : null
  const manualEntryMatches = (trade, e) => {
    if (!e.triggered) return false
    if (accountId != null) {
      if (!selectedManualAccount) return false
      if (e.slot !== selectedManualAccount.slot) return false
      if (!tradeInAccountWindow(selectedManualAccount, trade)) return false
    }
    if (instrument && trade.instrument !== instrument) return false
    return true
  }
  const manualTradeMatches = (trade) => {
    if (source === 'bot') return false
    if (instrument && trade.instrument !== instrument) return false
    if (accountId != null) {
      if (!selectedManualAccount) return false
      if (!tradeInAccountWindow(selectedManualAccount, trade)) return false
      return trade.entries.some(e => e.triggered && e.slot === selectedManualAccount.slot)
    }
    return trade.entries.some(e => e.triggered)
  }
  const manualPnl = (trade) => trade.entries.reduce(
    (sum, e) => manualEntryMatches(trade, e) ? sum + (e.pnl || 0) : sum, 0
  )
  const manualR = (trade) => trade.entries.reduce((sum, e) => {
    if (!manualEntryMatches(trade, e)) return sum
    if (e.result === 'W') return sum + (e.r || 0)
    if (e.result === 'L') return sum - 1
    return sum
  }, 0)

  // ── Bot-trade filtering ──
  const botTradeMatches = (bt) => {
    if (source === 'manual') return false
    if (accountId != null && bt.account_id !== accountId) return false
    if (instrument && bt.symbol !== instrument) return false
    if (strategy) {
      const a = getStrategyAt(assignments, bt.account_id, bt.exit_ts)
      if (!a || a.strategyName !== strategy) return false
    }
    return true
  }
  const botPnlNet = (bt) => (Number(bt.pnl) || 0) - (Number(bt.fees) || 0)

  // ── Group by date ──
  // Manual trades are keyed by trade.date (a YYYY-MM-DD string).
  // Bot trades are keyed by the local date of exit_ts.
  const localDateStrFromTs = (ts) => {
    const d = new Date(ts)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const tradesByDate = useMemo(() => {
    const map = {}
    ;(state.trades || []).forEach(trade => {
      if (!map[trade.date]) map[trade.date] = []
      map[trade.date].push(trade)
    })
    return map
  }, [state.trades])
  const botTradesByDate = useMemo(() => {
    const map = {}
    ;(state.botTrades || []).forEach(bt => {
      const k = localDateStrFromTs(bt.exit_ts)
      if (!map[k]) map[k] = []
      map[k].push(bt)
    })
    return map
  }, [state.botTrades])

  // Distinct instruments across manual + bot for the filter dropdown
  const allInstruments = useMemo(() => {
    const set = new Set()
    ;(state.trades || []).forEach(t => { if (t.instrument) set.add(t.instrument) })
    ;(state.botTrades || []).forEach(bt => { if (bt.symbol) set.add(bt.symbol) })
    return Array.from(set).sort()
  }, [state.trades, state.botTrades])

  // Build calendar grid
  const weeks = useMemo(() => buildCalendarGrid(year, month), [year, month])

  // Get day stats. Aggregates manual + bot fills under the active filters and
  // tracks per-source totals for the day-detail panel.
  const getDayStats = (dayObj) => {
    const dateStr = toDateStr(dayObj.year, dayObj.monthIdx, dayObj.day)
    const manualDay = (tradesByDate[dateStr] || []).filter(manualTradeMatches)
    const botDay = (botTradesByDate[dateStr] || []).filter(botTradeMatches)
    if (manualDay.length === 0 && botDay.length === 0) return null

    let manualPnlSum = 0
    let manualRSum = 0
    manualDay.forEach(t => { manualPnlSum += manualPnl(t); manualRSum += manualR(t) })
    const botPnlSum = botDay.reduce((s, bt) => s + botPnlNet(bt), 0)

    const pnl = manualPnlSum + botPnlSum
    return {
      pnl,
      manualPnl: manualPnlSum,
      botPnl: botPnlSum,
      totalR: manualRSum, // R only applies to manual trades
      manualCount: manualDay.length,
      botCount: botDay.length,
      tradeCount: manualDay.length + botDay.length,
      isWin: pnl > 0,
      isLoss: pnl < 0,
      dateStr,
    }
  }

  const weeklyStats = useMemo(() => {
    return weeks.map((week, wi) => {
      let pnl = 0
      let tradeDays = 0
      week.forEach(dayObj => {
        const s = getDayStats(dayObj)
        if (!s) return
        tradeDays++
        pnl += s.pnl
      })
      return { pnl, tradeDays, weekNum: wi + 1 }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weeks, source, accountId, strategy, instrument, tradesByDate, botTradesByDate])

  const monthlyStats = useMemo(() => {
    let totalPnl = 0
    let tradeDays = 0
    weeks.flat().forEach(dayObj => {
      if (!dayObj.inMonth) return
      const s = getDayStats(dayObj)
      if (!s) return
      tradeDays++
      totalPnl += s.pnl
    })
    return { totalPnl, tradeDays }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weeks, year, month, source, accountId, strategy, instrument, tradesByDate, botTradesByDate])

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
    const today = new Date()
    return dayObj.day === today.getDate() &&
      dayObj.monthIdx === today.getMonth() &&
      dayObj.year === today.getFullYear()
  }

  // Selected day trades (respects current filters)
  const selectedDayTrades = useMemo(() => {
    if (!selectedDate) return []
    return (tradesByDate[selectedDate] || []).filter(manualTradeMatches)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, tradesByDate, source, accountId, instrument])
  const selectedDayBotTrades = useMemo(() => {
    if (!selectedDate) return []
    return (botTradesByDate[selectedDate] || []).filter(botTradeMatches)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, botTradesByDate, source, accountId, instrument, strategy])

  // Eligible accounts for the account-filter dropdown based on the source filter
  const eligibleAccounts = source === 'manual' ? manualAccounts
    : source === 'bot' ? botAccounts
    : allAccounts

  const hasAnyFilter = source !== 'all' || accountId != null || strategy != null || instrument != null
  const clearFilters = () => { setSource('all'); setAccountId(null); setStrategy(null); setInstrument(null) }

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
          <span className="text-sm" style={{ color: 'var(--text-dim)' }}>Monthly:</span>
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

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'var(--surface)' }}>
        <Filter size={14} style={{ color: 'var(--text-dim)' }} />

        {/* Source */}
        <div className="flex items-center gap-1 rounded-lg p-0.5" style={{ background: 'var(--card)' }}>
          {[
            { v: 'all', label: 'Both', icon: null },
            { v: 'manual', label: 'Manual', icon: User },
            { v: 'bot', label: 'Bot', icon: Bot },
          ].map(({ v, label, icon: Icon }) => (
            <button
              key={v}
              onClick={() => setSourceSafe(v)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border-0 cursor-pointer"
              style={{
                background: source === v ? 'var(--accent)' : 'transparent',
                color: source === v ? '#fff' : 'var(--text-dim)',
              }}
            >
              {Icon && <Icon size={11} />}
              {label}
            </button>
          ))}
        </div>

        {/* Account */}
        <select
          value={accountId || ''}
          onChange={(e) => setAccountId(e.target.value || null)}
          className="px-2.5 py-1 rounded-md text-xs border-0 cursor-pointer"
          style={{ background: 'var(--card)', color: 'var(--text)' }}
        >
          <option value="">All accounts</option>
          {eligibleAccounts.map(a => (
            <option key={a.id} value={a.id}>{a.name}{a.kind === 'bot' ? ' (bot)' : ''}{a.archived ? ' (archived)' : ''}</option>
          ))}
        </select>

        {/* Strategy (bot-only) */}
        {source !== 'manual' && strategyNames.length > 0 && (
          <select
            value={strategy || ''}
            onChange={(e) => setStrategy(e.target.value || null)}
            className="px-2.5 py-1 rounded-md text-xs border-0 cursor-pointer"
            style={{ background: 'var(--card)', color: 'var(--text)' }}
          >
            <option value="">All strategies</option>
            {strategyNames.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}

        {/* Instrument */}
        {allInstruments.length > 0 && (
          <select
            value={instrument || ''}
            onChange={(e) => setInstrument(e.target.value || null)}
            className="px-2.5 py-1 rounded-md text-xs border-0 cursor-pointer"
            style={{ background: 'var(--card)', color: 'var(--text)' }}
          >
            <option value="">All instruments</option>
            {allInstruments.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        )}

        {hasAnyFilter && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs border-0 cursor-pointer"
            style={{ background: 'transparent', color: 'var(--text-dim)' }}
          >
            <X size={11} /> Clear
          </button>
        )}
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
                const dateStr = toDateStr(dayObj.year, dayObj.monthIdx, dayObj.day)

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
                        {stats.manualCount > 0 && (
                          <div className="text-[11px] font-medium" style={{ color: stats.totalR >= 0 ? 'var(--green)' : 'var(--red)', opacity: 0.6 }}>
                            {stats.totalR >= 0 ? '+' : ''}{stats.totalR.toFixed(2)}R
                          </div>
                        )}
                        {/* Source dots */}
                        <div className="flex gap-1 mt-1">
                          {stats.manualCount > 0 && (
                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--blue)' }} title={`${stats.manualCount} manual`} />
                          )}
                          {stats.botCount > 0 && (
                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#a855f7' }} title={`${stats.botCount} bot`} />
                          )}
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
        {selectedDate && (selectedDayTrades.length + selectedDayBotTrades.length) > 0 && (
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
                {formatDate(selectedDate)}
                {' — '}
                {selectedDayTrades.length > 0 && (
                  <span>{selectedDayTrades.length} manual</span>
                )}
                {selectedDayTrades.length > 0 && selectedDayBotTrades.length > 0 && <span> · </span>}
                {selectedDayBotTrades.length > 0 && (
                  <span>{selectedDayBotTrades.length} bot</span>
                )}
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

              {/* Bot trades for this day */}
              {selectedDayBotTrades.map((bt, idx) => {
                const net = botPnlNet(bt)
                const assignAt = getStrategyAt(assignments, bt.account_id, bt.exit_ts)
                const acct = allAccounts.find(a => a.id === bt.account_id)
                const exitTime = new Date(bt.exit_ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                return (
                  <motion.div
                    key={bt.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="w-full p-4 rounded-xl text-left border-0"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide" style={{ background: '#a855f7', color: 'white' }}>
                            <Bot size={9} /> Bot
                          </div>
                          <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                            {bt.symbol} · {bt.side?.toUpperCase()} {bt.qty}
                          </div>
                        </div>
                        <div className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>
                          {acct?.name || bt.account_id}
                          {assignAt && <> · <span style={{ color: '#a855f7' }}>{assignAt.strategyName}</span></>}
                          {' · '}
                          exit {exitTime}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold" style={{ color: net >= 0 ? 'var(--green)' : 'var(--red)' }}>
                          {formatPnl(net)}
                        </div>
                        {bt.fees > 0 && (
                          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                            fees ${Number(bt.fees).toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
