import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, Target, Zap, DollarSign, Award, Info, X, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  calcStats,
  calcRiskScore,
  getIdeaResult,
  getNetR,
  getNetPnl,
  formatPnl,
  getAccountStats,
  getActiveManualAccounts,
  ENTRY_LABELS,
  ENTRY_COLORS,
} from '../lib/store';
import { User, Bot } from 'lucide-react';

// CountUp Hook with easeOutCubic
const useCountUp = (target, duration = 1200) => {
  const [value, setValue] = useState(0);
  const animationRef = useRef(null);

  useEffect(() => {
    let startTime = null;
    let startValue = 0;

    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    const animate = (currentTime) => {
      if (startTime === null) {
        startTime = currentTime;
        startValue = 0;
      }

      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = easeOutCubic(progress);
      const currentValue = startValue + (target - startValue) * easeProgress;

      setValue(Math.round(currentValue * 100) / 100);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [target, duration]);

  return value;
};

// Stat Card Component
const StatCard = ({
  icon: Icon,
  label,
  value,
  prefix = '',
  suffix = '',
  subtitle = null,
  subtitleColor = null,
  change = null,
  isAnimated = true,
  gradient = false,
  gradientClass = '',
  isHighlight = false,
  valueColor = null,
  fullHeight = false,
}) => {
  const displayValue = isAnimated ? value : Math.round(value * 100) / 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-[14px] p-5 border transition-transform hover:translate-y-[-2px]"
      style={{
        background: 'var(--card)',
        borderColor: 'var(--border)',
        ...(fullHeight ? { height: '100%' } : {}),
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold tracking-wide opacity-60" style={{ letterSpacing: '0.02em' }}>
          {label}
        </span>
        <Icon
          size={16}
          style={{ color: gradient ? 'var(--blue)' : 'var(--text-dim)', opacity: 0.5 }}
        />
      </div>

      <div className="flex items-baseline gap-1 mb-1">
        <div
          className="text-[28px] font-extrabold font-mono tracking-tight"
          style={{ color: valueColor || (gradient ? undefined : 'var(--green)'), lineHeight: 1.1 }}
        >
          {prefix}{displayValue}{suffix}
        </div>
      </div>

      {subtitle && (
        <p className="text-xs font-medium mt-1" style={{ color: subtitleColor || 'var(--text-dim)', opacity: 0.7 }}>
          {subtitle}
        </p>
      )}

      {change && (
        <p className="text-xs opacity-60">
          {change}
        </p>
      )}
    </motion.div>
  );
};

// Risk Sink Score Card
const RiskScoreCard = ({ score, breakdown }) => {
  const [showInfo, setShowInfo] = useState(false);

  // Bands mirror calcRiskScore's labels in store.js — color, grade word, and
  // the info tooltip all describe the same thresholds.
  const getScoreColor = (s) => {
    if (s >= 65) return 'var(--green)';
    if (s >= 35) return 'var(--orange)';
    return 'var(--red)';
  };

  const getScoreGrade = (s) => {
    if (s >= 80) return 'Elite';
    if (s >= 65) return 'Strong';
    if (s >= 50) return 'Developing';
    if (s >= 35) return 'Needs Work';
    return 'Critical';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="rounded-[14px] p-5 border relative"
      style={{
        background: 'var(--card)',
        borderColor: 'var(--border)',
      }}
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
          Risk Sink Score
        </h3>
        <button
          onClick={() => setShowInfo(!showInfo)}
          className="p-1 rounded-md transition-colors"
          style={{ color: 'var(--text)', opacity: 0.4 }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
          onMouseLeave={e => e.currentTarget.style.opacity = '0.4'}
          title="How Risk Sink Score works"
        >
          {showInfo ? <X size={14} /> : <Info size={14} />}
        </button>
      </div>

      {showInfo && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mb-5 rounded-lg p-3 text-xs leading-relaxed"
          style={{ background: 'var(--surface)', color: 'var(--text)', opacity: 0.85 }}
        >
          <p className="font-semibold mb-2">How the score is calculated:</p>
          <div className="space-y-1.5" style={{ opacity: 0.8 }}>
            <p><span className="font-mono font-semibold">25%</span> — Idea Win Rate: % of trade ideas that are net profitable</p>
            <p><span className="font-mono font-semibold">20%</span> — Entry Discipline: how well entries follow the plan (triggered vs. not)</p>
            <p><span className="font-mono font-semibold">20%</span> — MLL Management: staying within max loss limits per account</p>
            <p><span className="font-mono font-semibold">20%</span> — Consistency: even distribution of R across trades (low variance)</p>
            <p><span className="font-mono font-semibold">15%</span> — Emotion Quality: absence of revenge trades, FOMO entries, and tilt</p>
          </div>
          <p className="mt-2" style={{ opacity: 0.6 }}>Score ranges: 80+ Elite · 65+ Strong · 50+ Developing · 35+ Needs Work · &lt;35 Critical</p>
        </motion.div>
      )}

      <div className="flex flex-col gap-5">
        {/* Score Circle */}
        <div className="flex items-center gap-4">
          <div
            className="relative w-20 h-20 rounded-full flex items-center justify-center flex-shrink-0"
            style={{
              background: `radial-gradient(circle, ${getScoreColor(score)}20 0%, transparent 70%)`,
            }}
          >
            <div
              className="text-3xl font-bold font-mono"
              style={{ color: getScoreColor(score) }}
            >
              {Math.round(score)}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: getScoreColor(score) }}>
              {getScoreGrade(score)}
            </p>
            <p className="text-xs opacity-50 mt-0.5">Overall Grade</p>
          </div>
        </div>

        {/* Grade Breakdown */}
        <div className="flex flex-col gap-3">
          {Object.entries(breakdown || {}).map(([key, percentage]) => (
            <div key={key}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-medium capitalize opacity-70">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </span>
                <span className="text-xs font-mono opacity-60">
                  {Math.round(percentage)}%
                </span>
              </div>
              <div
                className="h-1.5 rounded-full overflow-hidden"
                style={{ background: 'var(--border)' }}
              >
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  className="h-full rounded-full"
                  style={{ background: 'var(--green)' }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

// Equity Curve Chart
const EquityCurveChart = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="rounded-[14px] p-5 border h-80 flex items-center justify-center"
        style={{
          background: 'var(--card)',
          borderColor: 'var(--border)',
        }}
      >
        <p className="text-sm opacity-50">No data yet</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="rounded-[14px] p-5 border"
      style={{
        background: 'var(--card)',
        borderColor: 'var(--border)',
      }}
    >
      <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text)' }}>
        Equity Curve
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--green)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--green)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12 }}
            stroke="var(--text-dim)"
          />
          <YAxis
            tick={{ fontSize: 12 }}
            stroke="var(--text-dim)"
            tickFormatter={(v) => `$${v >= 1000 ? (v/1000).toFixed(1) + 'k' : v}`}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
            }}
            labelStyle={{ color: 'var(--text)' }}
          />
          <Area
            type="monotone"
            dataKey="cumulative"
            stroke="var(--green)"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorEquity)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  );
};

// Entry Performance Bars
const EntryPerformance = ({ entries }) => {
  const entryKeys = ['E1', 'E2', 'E3'];
  const colors = ['#10b981', '#f59e0b', '#06b6d4']; // green, orange, teal
  const maxBarHeight = 180; // px

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="rounded-[14px] p-5 border"
      style={{
        background: 'var(--card)',
        borderColor: 'var(--border)',
      }}
    >
      <h3 className="text-xs font-semibold tracking-wide mb-6 opacity-60" style={{ color: 'var(--text)', textTransform: 'uppercase' }}>
        Entry Win Rate
      </h3>

      <div className="flex items-end justify-around gap-4" style={{ height: maxBarHeight + 60 }}>
        {entryKeys.map((key, idx) => {
          const entryData = entries[key] || { wins: 0, total: 0 };
          const winRate = entryData.total > 0
            ? (entryData.wins / entryData.total) * 100
            : 0;
          const barHeight = entryData.total > 0
            ? Math.max(8, (winRate / 100) * maxBarHeight)
            : 0;

          return (
            <div key={key} className="flex-1 flex flex-col items-center">
              <div
                className="text-sm font-mono font-extrabold mb-2"
                style={{ color: colors[idx] }}
              >
                {Math.round(winRate)}%
              </div>
              <div className="w-full flex items-end" style={{ height: maxBarHeight }}>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: barHeight }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  className="w-full rounded-lg"
                  style={{ background: colors[idx], opacity: 0.75 }}
                />
              </div>
              <div className="text-xs font-semibold mt-3" style={{ color: 'var(--text)', opacity: 0.7 }}>
                {key}
              </div>
              <div className="text-[11px] font-mono" style={{ color: 'var(--text-dim)', opacity: 0.5 }}>
                {entryData.wins}/{entryData.total}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

// Account Health Card
const AccountHealthCard = ({ account, stats }) => {
  const s = stats || {};
  const ptProgress = s.ptPercent || 0;
  const mllRemaining = s.mllLeft || 0;
  const mllMax = (s.mllLeft || 0) + (s.mllUsed || 0) || 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="rounded-[14px] p-5 border"
      style={{
        background: 'var(--card)',
        borderColor: 'var(--border)',
      }}
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h4 className="font-semibold" style={{ color: 'var(--text)' }}>
            {account.name}
          </h4>
          <p className="text-xs opacity-60 mt-1">
            {account.slot || 'Slot'}
          </p>
        </div>
        <div
          className="text-xs font-semibold px-2 py-1 rounded"
          style={{
            background: 'var(--green)20',
            color: 'var(--green)',
          }}
        >
          Active
        </div>
      </div>

      <div className="space-y-4">
        {/* PT Progress Ring */}
        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="32"
                cy="32"
                r="28"
                fill="none"
                stroke="var(--border)"
                strokeWidth="3"
              />
              <motion.circle
                cx="32"
                cy="32"
                r="28"
                fill="none"
                stroke="var(--green)"
                strokeWidth="3"
                strokeDasharray={`${28 * 2 * Math.PI} ${28 * 2 * Math.PI}`}
                strokeDashoffset={`${28 * 2 * Math.PI * (1 - ptProgress / 100)}`}
                strokeLinecap="round"
                initial={{ strokeDashoffset: 28 * 2 * Math.PI }}
                animate={{ strokeDashoffset: 28 * 2 * Math.PI * (1 - ptProgress / 100) }}
                transition={{ duration: 1.5, ease: 'easeOut' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold font-mono">
                {Math.round(ptProgress)}%
              </span>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium opacity-70">PT Progress</p>
            <p className="text-sm font-mono font-bold text-[var(--green)]">
              ${Math.round(s.ptProgress || 0)}
            </p>
          </div>
        </div>

        {/* MLL Remaining Bar */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-medium opacity-70">MLL Remaining</span>
            <span className="text-xs font-mono font-bold text-[var(--red)]">
              ${Math.round(mllRemaining)}
            </span>
          </div>
          <div
            className="h-2 rounded-full overflow-hidden"
            style={{ background: 'var(--border)' }}
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{
                width: `${Math.min(100, (mllRemaining / mllMax) * 100)}%`,
              }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="h-full rounded-full"
              style={{ background: 'var(--red)' }}
            />
          </div>
        </div>

        {/* Balance */}
        <div className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
          <p className="text-xs opacity-60">Balance</p>
          <p className="text-lg font-mono font-bold text-[var(--text)]">
            ${Math.round(s.totalPnl || 0)}
          </p>
        </div>
      </div>
    </motion.div>
  );
};

// Mini Calendar Component
const MINI_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const MiniCalendar = ({ trades, botTrades }) => {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  // Build daily PnL map (all trades, since 2-week view can span months).
  // Includes bot fills so a day's total matches the Calendar page.
  const dailyPnl = useMemo(() => {
    const map = {};
    (trades || []).forEach(t => {
      if (!map[t.date]) map[t.date] = { pnl: 0, count: 0, entries: [] };
      map[t.date].pnl += getNetPnl(t);
      map[t.date].count++;
      t.entries.forEach(e => {
        if (e.triggered && e.result) map[t.date].entries.push(e);
      });
    });
    (botTrades || []).forEach(bt => {
      const d = new Date(bt.exit_ts);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!map[key]) map[key] = { pnl: 0, count: 0, entries: [] };
      map[key].pnl += (Number(bt.pnl) || 0) - (Number(bt.fees) || 0);
      map[key].count++;
    });
    return map;
  }, [trades, botTrades]);

  // Build 2-week grid: previous week + current week (Mon-Sun)
  const twoWeeks = useMemo(() => {
    const todayDate = new Date(year, month, now.getDate());
    const dow = (todayDate.getDay() + 6) % 7; // Mon=0
    const currentWeekStart = new Date(todayDate);
    currentWeekStart.setDate(currentWeekStart.getDate() - dow);
    const prevWeekStart = new Date(currentWeekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);

    const rows = [];
    for (const weekStart of [prevWeekStart, currentWeekStart]) {
      const row = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(weekStart);
        date.setDate(date.getDate() + d);
        row.push({
          day: date.getDate(),
          month: date.getMonth(),
          year: date.getFullYear(),
          dateStr: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
          inMonth: date.getMonth() === month,
        });
      }
      rows.push(row);
    }
    return rows;
  }, [year, month, now.getDate()]);

  const today = now.getDate();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const monthLabel = new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const shortPnl = (v) => {
    const abs = Math.abs(v);
    const str = abs >= 1000 ? `$${(abs / 1000).toFixed(1)}k` : `$${Math.round(abs)}`;
    return v >= 0 ? `+${str}` : `-${str}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="rounded-[14px] p-5 border"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-xs font-semibold tracking-wide opacity-60" style={{ textTransform: 'uppercase' }}>
          {monthLabel}
        </h3>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {MINI_DAYS.map(d => (
          <div key={d} className="text-center text-[11px] font-semibold opacity-40">{d}</div>
        ))}
      </div>

      {/* 2-week grid */}
      <div className="flex flex-col gap-2">
        {twoWeeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-2">
            {week.map((cell, di) => {
              const data = dailyPnl[cell.dateStr];
              const isTodayCell = isCurrentMonth && cell.day === today && cell.month === month;
              const hasTrades = !!data;
              const isWin = hasTrades && data.pnl > 0;
              const isLoss = hasTrades && data.pnl < 0;
              const dimmed = !cell.inMonth;

              return (
                <div
                  key={di}
                  className="rounded-xl flex flex-col items-center justify-center"
                  style={{
                    aspectRatio: '1',
                    background: isWin ? 'var(--green-dim)' : isLoss ? 'var(--red-dim)' : dimmed ? 'var(--surface)' : 'transparent',
                    border: isTodayCell ? '2px solid var(--blue)' : '1px solid transparent',
                    opacity: dimmed && !hasTrades ? 0.5 : 1,
                  }}
                >
                  <span
                    className="text-base font-bold leading-none"
                    style={{
                      color: isTodayCell ? 'var(--blue)' : hasTrades ? 'var(--text)' : 'var(--text-dim)',
                      opacity: hasTrades || isTodayCell ? 1 : 0.4,
                    }}
                  >
                    {cell.day}
                  </span>

                  {isTodayCell && !hasTrades && (
                    <span className="text-[10px] font-medium mt-0.5" style={{ color: 'var(--blue)', opacity: 0.7 }}>today</span>
                  )}

                  {hasTrades && (
                    <span
                      className="text-[11px] font-bold font-mono leading-none mt-1"
                      style={{ color: isWin ? 'var(--green)' : 'var(--red)' }}
                    >
                      {shortPnl(data.pnl)}
                    </span>
                  )}

                  {hasTrades && (
                    <div className="flex gap-[3px] mt-1.5 items-center">
                      {data.entries.slice(0, 3).map((e, j) => {
                        if (!e.triggered) {
                          return (
                            <div key={j} className="rounded-full" style={{
                              width: 6, height: 6,
                              border: '1px solid var(--text-muted)', background: 'transparent',
                            }} />
                          )
                        }
                        return (
                          <div key={j} className="rounded-full" style={{
                            width: 6, height: 6,
                            background: e.result === 'W' ? 'var(--green)' : e.result === 'L' ? 'var(--red)' : 'var(--text-dim)',
                          }} />
                        )
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend — position-fixed: slot1=Lucid, slot2=Tradeify, slot3=Topstep */}
      <div className="flex gap-4 mt-4 justify-center items-center flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: 'var(--green)' }} />
          <span className="text-[11px] opacity-50 font-medium">Win</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: 'var(--red)' }} />
          <span className="text-[11px] opacity-50 font-medium">Loss</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ border: '1px solid var(--text-muted)', background: 'transparent' }} />
          <span className="text-[11px] opacity-50 font-medium">Not triggered</span>
        </div>
      </div>
    </motion.div>
  );
};

// Recent Trades List
const RecentTradesList = ({ trades, onEditTrade }) => {
  if (!trades || trades.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="rounded-[14px] p-5 border"
        style={{
          background: 'var(--card)',
          borderColor: 'var(--border)',
        }}
      >
        <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text)' }}>
          Recent Trades
        </h3>
        <p className="text-sm opacity-50">No trades yet</p>
      </motion.div>
    );
  }

  const recentTrades = [...trades]
    .sort((a, b) => new Date(b.date + 'T00:00:00') - new Date(a.date + 'T00:00:00'))
    .slice(0, 5);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className="rounded-[14px] p-5 border overflow-hidden"
      style={{
        background: 'var(--card)',
        borderColor: 'var(--border)',
      }}
    >
      <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text)' }}>
        Recent Trades
      </h3>

      <div className="space-y-3">
        {recentTrades.map((trade, idx) => {
          const ideaResult = getIdeaResult(trade);
          const netR = getNetR(trade);
          const netPnl = formatPnl(getNetPnl(trade));
          const date = new Date(trade.date + 'T00:00:00').toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          });

          return (
            <motion.div
              key={trade.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: idx * 0.05 }}
              onClick={() => onEditTrade(trade)}
              className="flex items-center gap-4 p-3 rounded-lg cursor-pointer transition-colors hover:opacity-80"
              style={{ background: 'var(--card)20' }}
            >
              {/* Date */}
              <div className="flex-shrink-0 w-12">
                <span className="text-xs font-medium opacity-70">{date}</span>
              </div>

              {/* Instrument & Setup */}
              <div className="flex-grow min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                  {trade.instrument}
                </p>
                <p className="text-xs opacity-60">{trade.setup}</p>
              </div>

              {/* Entry Dots — position-fixed E1/E2/E3, green=win, red=loss, hollow=skipped */}
              <div className="flex gap-1 flex-shrink-0 items-center" title="E1 · E2 · E3 (Lucid · Tradeify · Topstep)">
                {(trade.entries || []).map((entry, i) => {
                  if (!entry.triggered) {
                    return (
                      <div key={i} className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ border: '1.5px solid var(--text-muted)', background: 'transparent' }} />
                    );
                  }
                  const bg = entry.result === 'W' ? 'var(--green)' : entry.result === 'L' ? 'var(--red)' : 'var(--text-dim)'
                  return (
                    <div key={i} className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: bg }} />
                  );
                })}
              </div>

              {/* Idea Result */}
              {ideaResult && (
                <div
                  className="text-xs font-semibold px-2 py-1 rounded flex-shrink-0"
                  style={{
                    background: ideaResult === 'WIN' ? 'var(--green-dim)' : 'var(--red-dim)',
                    color: ideaResult === 'WIN' ? 'var(--green)' : 'var(--red)',
                  }}
                >
                  {ideaResult}
                </div>
              )}

              {/* Net R & P&L */}
              <div className="flex gap-4 flex-shrink-0 text-right">
                <div>
                  <p className="text-xs opacity-60">R</p>
                  <p className="text-sm font-mono font-bold text-[var(--green)]">
                    {netR}R
                  </p>
                </div>
                <div>
                  <p className="text-xs opacity-60">P&L</p>
                  <p
                    className="text-sm font-mono font-bold"
                    style={{
                      color: getNetPnl(trade) >= 0 ? 'var(--green)' : 'var(--red)',
                    }}
                  >
                    {netPnl}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};

// Combined P&L summary across manual + bot. Shows today and the active period
// so the user gets a single "how did everything go" view at the top of the dash.
const CombinedSummary = ({ trades, botTrades, period }) => {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // Period window for "period total"
  const periodStart = useMemo(() => {
    const d = new Date();
    if (period === 'Week') d.setDate(d.getDate() - 7);
    else if (period === 'Month') { d.setDate(1); }
    else d.setFullYear(d.getFullYear() - 100);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [period]);

  const localDateOf = (ts) => {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  let manualToday = 0, manualPeriod = 0, botToday = 0, botPeriod = 0;
  (trades || []).forEach(t => {
    const pnl = getNetPnl(t);
    if (t.date === todayStr) manualToday += pnl;
    if (new Date(t.date + 'T00:00:00') >= periodStart) manualPeriod += pnl;
  });
  (botTrades || []).forEach(bt => {
    const net = (Number(bt.pnl) || 0) - (Number(bt.fees) || 0);
    const exitDate = localDateOf(bt.exit_ts);
    if (exitDate === todayStr) botToday += net;
    if (new Date(bt.exit_ts) >= periodStart) botPeriod += net;
  });

  const todayTotal = manualToday + botToday;
  const periodTotal = manualPeriod + botPeriod;

  const Row = ({ label, manual, bot, total }) => (
    <div className="flex items-center justify-between py-2">
      <div className="text-xs font-semibold opacity-60 uppercase tracking-wide">{label}</div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-xs">
          <User size={11} style={{ color: 'var(--blue)' }} />
          <span className="opacity-60">Manual</span>
          <span className="font-mono font-bold" style={{ color: manual >= 0 ? 'var(--green)' : 'var(--red)' }}>{formatPnl(manual)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <Bot size={11} style={{ color: '#a855f7' }} />
          <span className="opacity-60">Bot</span>
          <span className="font-mono font-bold" style={{ color: bot >= 0 ? 'var(--green)' : 'var(--red)' }}>{formatPnl(bot)}</span>
        </div>
        <div className="text-sm font-bold font-mono pl-3 border-l" style={{ borderColor: 'var(--border)', color: total >= 0 ? 'var(--green)' : 'var(--red)', minWidth: 90, textAlign: 'right' }}>
          {formatPnl(total)}
        </div>
      </div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-[14px] p-5 border"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
    >
      <Row label="Today" manual={manualToday} bot={botToday} total={todayTotal} />
      <div className="border-t" style={{ borderColor: 'var(--border)' }} />
      <Row label={period} manual={manualPeriod} bot={botPeriod} total={periodTotal} />
    </motion.div>
  );
};

// Main Dashboard Component
export default function Dashboard({ state, openEditTrade }) {
  const [period, setPeriod] = useState('Month');

  // Calculate stats
  const periodMap = { 'Week': 'week', 'Month': 'month', 'All Time': 'all' };
  const stats = calcStats(state.trades || [], periodMap[period] || 'month');
  const riskScore = calcRiskScore(state.trades || [], state.accounts || [], state.settings);

  // Entry performance from stats.byEntry. `total` is decisive entries (W+L,
  // break-evens excluded) so the WR here matches byEntry.wr and Analytics.
  const decisive = (e) => (e?.wins || 0) + (e?.losses || 0);
  const entryPerformance = {
    E1: { wins: (stats.byEntry?.[0]?.wins || 0), total: decisive(stats.byEntry?.[0]) },
    E2: { wins: (stats.byEntry?.[1]?.wins || 0), total: decisive(stats.byEntry?.[1]) },
    E3: { wins: (stats.byEntry?.[2]?.wins || 0), total: decisive(stats.byEntry?.[2]) },
  };

  // Active manual accounts only for the risk-sink stats panels below (bot
  // accounts have their own card grid; archived accounts live on the Accounts page).
  const manualAccounts = useMemo(() => getActiveManualAccounts(state.accounts || []), [state.accounts]);
  const accountStats = manualAccounts.map((account) =>
    getAccountStats(account, state.trades || [], state.settings)
  );

  // This week's idea WR vs the selected period's average. Hidden when the
  // period IS the week (comparing a number to itself said nothing).
  const weekStats = calcStats(state.trades || [], 'week');
  const weekWrPct = (weekStats.ideaWR || 0) * 100;
  const periodWrPct = (stats.ideaWR || 0) * 100;
  const wrDiff = period === 'Week' ? 0 : weekWrPct - periodWrPct;
  const wrDiffLabel = period === 'All Time' ? 'vs all-time avg' : 'vs month avg';

  // Period label for subtitles
  const periodLabel = period === 'Week' ? 'this week' : period === 'Month' ? new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'all time';

  // Count up animations
  const ideaWr = useCountUp((stats.ideaWR || 0) * 100, 1200);
  const entryWr = useCountUp((stats.entryWR || 0) * 100, 1200);
  const totalRVal = useCountUp(stats.totalR || 0, 1200);
  const netPnlValue = useCountUp(Math.abs(stats.totalPnl || 0), 1200);

  return (
    <div className="space-y-6 pb-12">
      {/* Header Row */}
      <div className="flex items-center justify-between">
        <h1 className="text-[26px] font-extrabold tracking-tight" style={{ color: 'var(--text)' }}>
          Dashboard
        </h1>

        {/* Period Tabs */}
        <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--surface)' }}>
          {['Week', 'Month', 'All Time'].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="px-4 py-1.5 rounded-md text-sm font-semibold transition-all"
              style={{
                background: period === p ? 'var(--card)' : 'transparent',
                color: period === p ? 'var(--text)' : 'var(--text-dim)',
                boxShadow: period === p ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Combined daily/period roll-up — manual + bot side-by-side */}
      <CombinedSummary trades={state.trades} botTrades={state.botTrades} period={period} />

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-4 gap-4" style={{ alignItems: 'stretch' }}>
        <div className="relative h-full">
          <StatCard
            icon={TrendingUp}
            label="Idea Win Rate"
            value={ideaWr}
            suffix="%"
            valueColor="var(--green)"
            subtitle={wrDiff !== 0 ? `this week ${wrDiff > 0 ? '↑' : '↓'} ${Math.abs(wrDiff).toFixed(1)}% ${wrDiffLabel}` : undefined}
            subtitleColor={wrDiff >= 0 ? 'var(--green)' : 'var(--red)'}
            fullHeight
          />
          <motion.div
            className="absolute inset-0 rounded-[14px] pointer-events-none"
            animate={{
              boxShadow: [
                '0 0 0 0 rgba(16, 185, 129, 0.4)',
                '0 0 0 8px rgba(16, 185, 129, 0)',
              ],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatDelay: 1,
            }}
          />
        </div>

        <StatCard
          icon={Target}
          label="Entry Win Rate"
          value={entryWr}
          suffix="%"
          valueColor="var(--blue)"
          subtitle={`across ${stats.totalEntries || 0} entries`}
        />

        <StatCard
          icon={Zap}
          label="Total R"
          value={totalRVal}
          prefix={stats.totalR >= 0 ? '+' : ''}
          suffix="R"
          valueColor={stats.totalR >= 0 ? 'var(--green)' : 'var(--red)'}
          subtitle={`${stats.totalTrades || 0} ideas`}
        />

        <StatCard
          icon={DollarSign}
          label="Net P&L"
          value={netPnlValue}
          prefix={stats.totalPnl >= 0 ? '+$' : '-$'}
          valueColor={stats.totalPnl >= 0 ? 'var(--green)' : 'var(--red)'}
          subtitle={periodLabel}
        />
      </div>

      {/* Row 2: Risk Score (1/3) + Equity Curve (2/3) */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 2fr' }}>
        <RiskScoreCard score={riskScore.score || 0} breakdown={riskScore.grades || {}} />
        <EquityCurveChart data={stats.equityCurve} />
      </div>

      {/* Row 3: Entry Performance + Account Health */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 2fr' }}>
        <EntryPerformance entries={entryPerformance} />
        <div>
          <h2 className="text-xs font-semibold tracking-wide opacity-60 mb-3" style={{ textTransform: 'uppercase' }}>Account Rotation</h2>
          <div className="grid grid-cols-3 gap-4">
            {manualAccounts.map((account, idx) => (
              <AccountHealthCard
                key={account.id}
                account={account}
                stats={accountStats[idx]}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Row 4: Mini Calendar (full width) */}
      <MiniCalendar trades={state.trades} botTrades={state.botTrades} />

      {/* Row 5: Recent Trades (full width) */}
      <RecentTradesList trades={state.trades} onEditTrade={openEditTrade} />
    </div>
  );
}
