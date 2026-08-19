import React, { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ResponsiveContainer, ComposedChart, LineChart, AreaChart, BarChart,
  Line, Area, Bar, Cell, XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid,
} from 'recharts'
import { Layers, Info, X, ShieldCheck, Dices, Activity, GitBranch, Scale, Ruler, TrendingUp, Gauge, HelpCircle } from 'lucide-react'
import { formatPnl, ENTRY_COLORS } from '../lib/store'
import { calcRiskSinkReport, bootstrapLift, monteCarloSurvival, riskLadder } from '../lib/riskSink'

// ── Palette for the three worlds ──
const C = {
  actual: 'var(--green)',
  copied: 'var(--orange)',
  single: 'var(--text-dim)',
  lift: 'var(--accent)',
}

const fmtR = (v, signed = true) => `${signed && v > 0 ? '+' : ''}${(v || 0).toFixed(1)}R`
const pct = (v) => `${Math.round((v || 0) * 100)}%`
const fmtK = (v) => {
  const a = Math.abs(v || 0)
  const body = a >= 1000 ? `$${(a / 1000).toFixed(a % 1000 ? 1 : 0)}k` : `$${Math.round(a)}`
  return `${v < 0 ? '-' : ''}${body}`
}
const tickFor = (isR) => (v) => (isR ? `${v}R` : fmtK(v))
const X_TICK = { tick: { fill: 'var(--text-muted)', fontSize: 10 }, axisLine: false, tickLine: false, minTickGap: 24, interval: 'preserveStartEnd' }

// ── Shared bits ──
// Every card takes an optional `info` node: an (i) button appears in the
// header and toggles a plain-English explanation of what the card shows.
const Card = ({ title, icon: Icon, subtitle, right, info, children, delay = 0, className = '' }) => {
  const [showInfo, setShowInfo] = useState(false)
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay }}
      className={`rounded-[14px] p-5 border ${className}`}
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
    >
      {(title || right || info) && (
        <div className="flex items-start justify-between mb-1 gap-3">
          <div>
            {title && (
              <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text)' }}>
                {Icon && <Icon size={16} style={{ color: 'var(--accent)' }} />}
                {title}
              </h3>
            )}
            {subtitle && <p className="text-xs opacity-50 mt-0.5">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">
            {right}
            {info && <InfoToggle open={showInfo} onToggle={() => setShowInfo(v => !v)} />}
          </div>
        </div>
      )}
      {info && showInfo && <InfoBox>{info}</InfoBox>}
      {children}
    </motion.div>
  )
}

const ChartTip = ({ active, payload, label, fmt, labelFmt, omit = [] }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg px-3 py-2 text-xs border" style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)' }}>
      <div className="opacity-60 mb-1">{labelFmt ? labelFmt(label, payload[0]?.payload) : label}</div>
      {payload.filter(p => p.name && !p.hide && !omit.includes(p.dataKey)).map((p, i) => (
        <div key={i} className="flex justify-between gap-4">
          <span style={{ color: p.color || p.stroke || 'var(--text)' }}>{p.name}</span>
          <span className="font-mono font-semibold">{fmt ? fmt(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  )
}

const Legend3 = ({ items }) => (
  <div className="flex flex-wrap gap-4 text-xs mt-2">
    {items.map(i => (
      <span key={i.label} className="flex items-center gap-1.5 opacity-80">
        <span className="inline-block w-3 h-[3px] rounded" style={{ background: i.color }} />
        {i.label}
      </span>
    ))}
  </div>
)

const Stat = ({ label, value, color, sub }) => (
  <div className="rounded-lg px-3 py-2" style={{ background: 'var(--surface)' }}>
    <div className="text-[11px] opacity-60">{label}</div>
    <div className="text-base font-mono font-bold" style={{ color: color || 'var(--text)' }}>{value}</div>
    {sub && <div className="text-[11px] opacity-50">{sub}</div>}
  </div>
)

const InfoToggle = ({ open, onToggle }) => (
  <button
    onClick={onToggle}
    className="p-1 rounded-md transition-colors border-0 bg-transparent cursor-pointer"
    style={{ color: 'var(--text)', opacity: 0.4 }}
    title="What is this?"
  >
    {open ? <X size={14} /> : <Info size={14} />}
  </button>
)

const InfoBox = ({ children }) => (
  <div className="mb-4 rounded-lg p-3 text-xs leading-relaxed" style={{ background: 'var(--surface)', opacity: 0.9 }}>{children}</div>
)

// ── Hero: verdict + twin curves + underwater ──
function HeroCard({ report, unit }) {
  const [showInfo, setShowInfo] = useState(false)
  const { totals, n, curve, maxDd } = report
  const isR = unit === 'R'
  const lift = isR ? totals.liftR : totals.liftPnl
  const f = isR ? fmtR : formatPnl
  const ahead = lift > 0, behind = lift < 0
  const verdictColor = ahead ? 'var(--green)' : behind ? 'var(--red)' : 'var(--text-dim)'
  const per = isR ? fmtR(totals.liftPerIdeaR) : formatPnl(totals.liftPerIdeaPnl)

  const kA = isR ? 'actualR' : 'actual', kC = isR ? 'copiedR' : 'copied', kS = isR ? 'singleR' : 'single', kL = isR ? 'liftR' : 'lift'
  const dateOf = (label, p) => (p?.date ? `Idea #${label} · ${p.date}` : `Idea #${label}`)

  return (
    <Card delay={0} className="!p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="text-[11px] font-semibold tracking-wide opacity-50 uppercase mb-1">The verdict</div>
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-4xl font-extrabold font-mono" style={{ color: verdictColor }}>{f(lift)}</span>
            <span className="text-sm" style={{ color: 'var(--text)' }}>
              {ahead ? 'added' : behind ? 'given up' : 'no difference'} by staggering into 3 accounts
              <span className="opacity-60"> · over {n} idea{n === 1 ? '' : 's'} · {per}/idea</span>
            </span>
          </div>
          <p className="text-xs opacity-60 mt-1.5 max-w-2xl">
            Compared to the obvious alternative: copying entry 1 to all three accounts — same budget,
            no stagger. Positive means the deeper E2/E3 fills earn more than the shallow, one-account-only
            winners cost.
          </p>
        </div>
        <InfoToggle open={showInfo} onToggle={() => setShowInfo(v => !v)} />
      </div>

      {showInfo && (
        <InfoBox>
          Every idea is its own control group, because E1 is the entry you'd take either way.
          <span className="font-semibold"> Sink</span> = what all filled entries actually made.
          <span className="font-semibold"> Copied</span> = E1's result × 3, i.e. the same three
          accounts with no stagger. <span className="font-semibold"> Single</span> = one account, E1 only.
          The sink wins when price runs deeper and reverses (tighter stops → more contracts → more R);
          it loses when E1 runs away and only one account got on. The lift is the net of both.
        </InfoBox>
      )}

      <div className="grid grid-cols-3 gap-3 mb-5">
        <Stat label="Sink (what you actually made)" value={f(isR ? totals.actualR : totals.actualPnl)} color={C.actual} sub={`max drawdown ${formatPnl(-maxDd.actual)}`} />
        <Stat label="Copied — E1 × 3 accounts" value={f(isR ? totals.copiedR : totals.copiedPnl)} color={C.copied} sub={`max drawdown ${formatPnl(-maxDd.copied)}`} />
        <Stat label="Single — one account, E1 only" value={f(isR ? totals.singleR : totals.singlePnl)} color={C.single} sub={`max drawdown ${formatPnl(-maxDd.single)}`} />
      </div>

      {/* Twin equity curves */}
      <div className="text-[11px] font-semibold tracking-wide opacity-50 uppercase mb-1">Cumulative {isR ? 'R' : 'P&L'} · same ideas, three ways</div>
      <div style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={curve} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="idx" {...X_TICK} />
            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={tickFor(isR)} />
            <Tooltip content={<ChartTip fmt={f} labelFmt={dateOf} />} />
            <ReferenceLine y={0} stroke="var(--border-hover)" />
            <Line type="monotone" dataKey={kS} name="Single" stroke={C.single} strokeWidth={1.5} dot={false} strokeDasharray="4 3" isAnimationActive={false} />
            <Line type="monotone" dataKey={kC} name="Copied ×3" stroke={C.copied} strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey={kA} name="Sink" stroke={C.actual} strokeWidth={2.5} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <Legend3 items={[{ label: 'Sink (actual)', color: C.actual }, { label: 'Copied ×3', color: C.copied }, { label: 'Single account', color: C.single }]} />

      {/* Lift + underwater side by side */}
      <div className="grid grid-cols-2 gap-4 mt-5">
        <div>
          <div className="text-[11px] font-semibold tracking-wide opacity-50 uppercase mb-1">Cumulative lift · sink − copied</div>
          <div style={{ height: 150 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={curve} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="rsLift" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="idx" {...X_TICK} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} width={44} tickFormatter={tickFor(isR)} />
                <Tooltip content={<ChartTip fmt={f} labelFmt={dateOf} />} />
                <ReferenceLine y={0} stroke="var(--border-hover)" />
                <Area type="monotone" dataKey={kL} name="Lift" stroke={C.lift} strokeWidth={2} fill="url(#rsLift)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div>
          <div className="text-[11px] font-semibold tracking-wide opacity-50 uppercase mb-1">Underwater · drawdown from peak ($)</div>
          <div style={{ height: 150 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={curve} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                <XAxis dataKey="idx" {...X_TICK} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} width={44} tickFormatter={fmtK} />
                <Tooltip content={<ChartTip fmt={formatPnl} labelFmt={dateOf} />} />
                <Area type="step" dataKey="ddCopied" name="Copied ×3" stroke={C.copied} fill={C.copied} fillOpacity={0.12} strokeWidth={1.5} isAnimationActive={false} />
                <Area type="step" dataKey="ddActual" name="Sink" stroke={C.actual} fill={C.actual} fillOpacity={0.18} strokeWidth={2} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </Card>
  )
}

// ── Mechanism: fill funnel ──
function FunnelCard({ report }) {
  const { funnel, n } = report
  return (
    <Card title="How deep do ideas go?" icon={GitBranch} subtitle="Share of completed ideas where each entry got filled" delay={0.05}
      info={<>
        E1 fills on every idea (it's your first entry). E2 fills only when price runs deeper to
        your second level, E3 deeper still. So these bars show how often the market actually
        gives you the discount the sink is designed to catch. If E2/E3 rarely fill, the sink
        rarely gets to do its job — most ideas end up one-account-deep.
      </>}>
      <div className="space-y-3 mt-3">
        {funnel.map(f => (
          <div key={f.slot}>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-semibold" style={{ color: ENTRY_COLORS[f.slot] }}>E{f.slot}</span>
              <span className="font-mono opacity-80">{f.count}/{n} · {pct(f.pct)}</span>
            </div>
            <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--surface)' }}>
              <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${Math.max(2, f.pct * 100)}%` }} transition={{ duration: 0.7 }} style={{ background: ENTRY_COLORS[f.slot] }} />
            </div>
          </div>
        ))}
      </div>
      <p className="text-[11px] opacity-50 mt-4 leading-relaxed">
        This is the sink's utilization. E2/E3 only earn their keep on the ideas where they fill —
        the rest of the time you're one account deep against a copied-×3 alternative.
      </p>
    </Card>
  )
}

// ── Mechanism: outcome by depth vs break-even ──
function DepthCard({ report }) {
  const { byDepth } = report
  return (
    <Card title="Outcome by depth" icon={Ruler} subtitle="Win rate you have vs. the win rate each depth needs to break even" delay={0.1}
      info={<>
        Each row groups ideas by how many entries filled. Reading the columns:
        <span className="font-semibold"> Ideas</span> — how many landed in this group (and its share of all ideas).
        <span className="font-semibold"> Win rate</span> — how often this group won.
        <span className="font-semibold"> Break-even</span> — the win rate this group would NEED, given its
        average win and loss, just to make $0. Example: if wins average +11R and losses −3R,
        winning just 21% of the time breaks even.
        <span className="font-semibold"> Win rate green</span> = you're above that hurdle and this depth is
        profitable; red = below it. Deep ideas can have a LOW win rate and still be your most
        profitable group — that's the whole trade-off of adding size near the stop.
      </>}>
      <div className="overflow-x-auto mt-2">
        <table className="w-full text-xs">
          <thead>
            <tr className="opacity-50 text-left">
              <th className="py-1.5 font-medium">Filled</th>
              <th className="py-1.5 font-medium text-right">Ideas</th>
              <th className="py-1.5 font-medium text-right">Win rate</th>
              <th className="py-1.5 font-medium text-right">Break-even</th>
              <th className="py-1.5 font-medium text-right">Avg win</th>
              <th className="py-1.5 font-medium text-right">Avg loss</th>
              <th className="py-1.5 font-medium text-right">Net</th>
            </tr>
          </thead>
          <tbody>
            {byDepth.map(d => {
              const has = d.ideas > 0
              const edge = d.edgeOverBreakEven
              const edgeColor = !has || d.wins + d.losses === 0 ? 'var(--text-muted)' : edge >= 0 ? 'var(--green)' : 'var(--red)'
              return (
                <tr key={d.depth} className="border-t" style={{ borderColor: 'var(--border)' }}>
                  <td className="py-2">
                    <span className="font-semibold">{d.depth === 1 ? 'E1 only' : d.depth === 2 ? 'E1 + E2' : 'All three'}</span>
                    <span className="opacity-50 ml-1.5">{pct(d.share)}</span>
                  </td>
                  <td className="py-2 text-right font-mono">{d.ideas}</td>
                  <td className="py-2 text-right font-mono font-semibold" style={{ color: edgeColor }}>{has ? pct(d.wr) : '—'}</td>
                  <td className="py-2 text-right font-mono opacity-70">{has && d.avgWinR > 0 ? pct(d.breakEvenWR) : '—'}</td>
                  <td className="py-2 text-right font-mono" style={{ color: 'var(--green)' }}>{d.wins ? fmtR(d.avgWinR) : '—'}</td>
                  <td className="py-2 text-right font-mono" style={{ color: 'var(--red)' }}>{d.losses ? fmtR(d.avgLossR) : '—'}</td>
                  <td className="py-2 text-right font-mono font-semibold" style={{ color: d.totalPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>{has ? formatPnl(d.totalPnl) : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] opacity-50 mt-3 leading-relaxed">
        With one shared stop, a full-depth loser costs 3 units; a full-depth winner pays E1+E2+E3.
        Green win rate = you clear the hurdle at that depth.
      </p>
    </Card>
  )
}

// ── Mechanism: R per slot ──
function SlotRCard({ report }) {
  const { bySlot, rHistogram } = report
  return (
    <Card title="Deeper entries, bigger R" icon={TrendingUp} subtitle="Winning R by entry slot — the engine behind the lift" delay={0.15}
      info={<>
        R = how many times your risk a win paid. You risk the same $200 on every entry, but E2/E3
        enter closer to the stop — so the same move to target is worth more multiples of that $200.
        A 3R win at E1 pays $600; if E3 catches the same move at 5R it pays $1,000 for the same risk.
        The boxes show each slot's average winning R; the chart shows every winning entry bucketed
        by R. If the E2/E3 bars sit to the right of E1's, the "deeper = bigger payoff" engine is
        working. Their win rates will naturally be a bit lower — deeper fills are nearer the stop.
      </>}>
      <div className="grid grid-cols-3 gap-2 mt-2 mb-3">
        {bySlot.map(s => (
          <div key={s.slot} className="rounded-lg px-3 py-2" style={{ background: 'var(--surface)' }}>
            <div className="text-[11px] font-semibold" style={{ color: ENTRY_COLORS[s.slot] }}>E{s.slot}</div>
            <div className="text-base font-mono font-bold">{s.wins ? fmtR(s.avgWinR, false) : '—'}</div>
            <div className="text-[11px] opacity-50">avg win · {s.wins}W / {s.losses}L · {s.wins + s.losses ? pct(s.wr) : '—'}</div>
          </div>
        ))}
      </div>
      <div style={{ height: 150 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rHistogram} margin={{ top: 4, right: 8, left: -20, bottom: 0 }} barGap={1} barCategoryGap="25%">
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="r" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}R`} />
            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip content={<ChartTip labelFmt={(l) => `Wins at ${l}R`} />} cursor={{ fill: 'var(--border)' }} />
            <Bar dataKey="E1" name="E1" fill={ENTRY_COLORS[1]} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="E2" name="E2" fill={ENTRY_COLORS[2]} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="E3" name="E3" fill={ENTRY_COLORS[3]} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

// ── Mechanism: cost-of-sink ledger ──
function LedgerCard({ report }) {
  const { ledger, totals } = report
  const rows = [
    { label: 'Winners, stagger ahead', sub: `${ledger.deepWinners} idea${ledger.deepWinners === 1 ? '' : 's'} · deep fills out-earned 3× E1`, value: ledger.deepWinnersLift },
    { label: 'Winners, copying ahead', sub: `${ledger.shallowWinners} idea${ledger.shallowWinners === 1 ? '' : 's'} · shallow fills, 3× E1 would have paid more`, value: ledger.shallowWinnersLift },
    { label: 'Losers', sub: `${ledger.losersSaved} saved vs. copied · ${ledger.losersCost} cost more`, value: ledger.losersLift },
  ]
  const maxAbs = Math.max(1, ...rows.map(r => Math.abs(r.value)))
  return (
    <Card title="Where the lift comes from" icon={Scale} subtitle="The honest ledger — what the stagger earned and what it cost, vs. copied ×3" delay={0.2}
      info={<>
        Every idea is compared against "what if I'd copied E1 to all three accounts instead of
        staggering". Three buckets:
        <span className="font-semibold"> Winners, stagger ahead</span> — deep fills beat copying (green: this is what the sink is for).
        <span className="font-semibold"> Winners, copying ahead</span> — the idea won but only E1 filled, so two accounts
        sat idle; copying would have tripled the win. This is the price you pay for waiting for depth.
        <span className="font-semibold"> Losers</span> — with a shared stop, a shallow loser costs 1×$200 while copying
        loses 3×$200, so unfilled entries SAVE money on losers.
        The net of all three is the verdict number at the top of the page.
      </>}>
      <div className="space-y-3 mt-3">
        {rows.map(r => (
          <div key={r.label}>
            <div className="flex justify-between items-baseline text-xs mb-1">
              <span><span className="font-semibold">{r.label}</span> <span className="opacity-50 ml-1">{r.sub}</span></span>
              <span className="font-mono font-bold" style={{ color: r.value > 0 ? 'var(--green)' : r.value < 0 ? 'var(--red)' : 'var(--text-dim)' }}>{formatPnl(r.value)}</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface)' }}>
              <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${Math.max(2, (Math.abs(r.value) / maxAbs) * 100)}%` }} transition={{ duration: 0.7 }} style={{ background: r.value >= 0 ? 'var(--green)' : 'var(--red)', opacity: 0.85 }} />
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between items-baseline text-xs mt-4 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
        <span className="font-semibold">Net lift</span>
        <span className="font-mono font-bold text-sm" style={{ color: totals.liftPnl > 0 ? 'var(--green)' : totals.liftPnl < 0 ? 'var(--red)' : 'var(--text-dim)' }}>{formatPnl(totals.liftPnl)}</span>
      </div>
    </Card>
  )
}

// ── Robustness: rolling lift ──
function RollingCard({ report, unit }) {
  const { rolling } = report
  const isR = unit === 'R'
  const k = isR ? 'liftR' : 'liftPnl'
  const f = isR ? fmtR : formatPnl
  const last = rolling[rolling.length - 1]
  return (
    <Card title="Is the edge stable?" icon={Activity} subtitle="Lift over the last 30 ideas, rolling — same window as the Risk Sink Score" delay={0.25}
      info={<>
        Each bar answers: "counting only the 30 ideas up to this point, was the stagger beating
        copied ×3?" Green bars = the sink was ahead over that stretch; red = behind. What to look
        for is the trend, not any single bar: mostly green and steady means the edge is holding;
        a long red run means the recent market hasn't been giving you the deep-then-reverse moves
        the sink feeds on. It uses the same 30-idea window as the Risk Sink Score, so the two move together.
      </>}
      right={last && <span className="text-sm font-mono font-bold" style={{ color: last[k] > 0 ? 'var(--green)' : last[k] < 0 ? 'var(--red)' : 'var(--text-dim)' }}>{f(last[k])}<span className="text-[11px] opacity-50 font-sans font-normal ml-1">now</span></span>}>
      <div style={{ height: 160 }} className="mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rolling} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="idx" {...X_TICK} />
            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} width={44} tickFormatter={tickFor(isR)} />
            <Tooltip content={<ChartTip fmt={f} labelFmt={(l, p) => `Through idea #${l}${p?.full ? '' : ' (window filling)'}`} />} cursor={{ fill: 'var(--border)' }} />
            <ReferenceLine y={0} stroke="var(--border-hover)" />
            <Bar dataKey={k} name="30-idea lift" isAnimationActive={false} radius={[2, 2, 0, 0]}>
              {rolling.map((r, i) => (
                <Cell key={i} fill={r[k] >= 0 ? 'var(--green)' : 'var(--red)'} fillOpacity={r.full ? 0.85 : 0.35} />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[11px] opacity-50 mt-2">Faded bars = fewer than 30 ideas in the window yet.</p>
    </Card>
  )
}

// ── Robustness: bootstrap ──
function BootstrapCard({ report, unit }) {
  const isR = unit === 'R'
  const f = isR ? fmtR : formatPnl
  const boot = useMemo(() => bootstrapLift(report.ideas, { key: isR ? 'liftR' : 'liftPnl' }), [report.ideas, isR])
  const data = useMemo(() => boot.band.map((b, i) => ({
    ...b,
    base: b.p5,
    span: b.p95 - b.p5,
    actual: report.curve[i] ? (isR ? report.curve[i].liftR : report.curve[i].lift) : null,
  })), [boot, report.curve, isR])
  const p = boot.pAbove
  const verdict = report.n < 10 ? 'Too few ideas to say' : p >= 0.95 ? 'Very unlikely to be luck' : p >= 0.8 ? 'Probably real, still early' : p >= 0.5 ? 'Coin-flip territory' : 'The lift is not holding up'
  const color = report.n < 10 ? 'var(--text-dim)' : p >= 0.8 ? 'var(--green)' : p >= 0.5 ? 'var(--orange)' : 'var(--red)'
  return (
    <Card title="Is the lift real or luck?" icon={Dices} subtitle="Your ideas reshuffled 1,000 times — where the lift lands" delay={0.3}
      info={<>
        A small lift can come from two or three lucky ideas. To check, this takes your own ideas,
        shuffles them into 1,000 alternate histories (drawing with replacement), and replays the
        lift in each one. The shaded band is where 90% of those replays landed (5th to 95th
        percentile), the dashed line is the typical (median) replay, and the solid line is what
        actually happened. How to read it: if even the BOTTOM of the band ends above zero, the
        edge survives reshuffling — it isn't riding on a few lucky ideas. The big percentage is
        simply how many of the 1,000 replays ended positive.
      </>}>
      <div className="flex items-baseline gap-3 mb-2">
        <span className="text-2xl font-extrabold font-mono" style={{ color }}>{report.n ? pct(p) : '—'}</span>
        <span className="text-xs" style={{ color: 'var(--text)' }}>of replays end with a positive lift <span className="opacity-50">· {verdict}</span></span>
      </div>
      <div style={{ height: 170 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="idx" {...X_TICK} />
            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} width={44} tickFormatter={tickFor(isR)} />
            <Tooltip content={<ChartTip fmt={f} labelFmt={(l) => `After ${l} ideas`} omit={['base', 'span']} />} />
            <ReferenceLine y={0} stroke="var(--border-hover)" />
            <Area type="monotone" dataKey="base" stackId="b" stroke="none" fill="transparent" isAnimationActive={false} name="base" />
            <Area type="monotone" dataKey="span" stackId="b" stroke="none" fill="var(--accent)" fillOpacity={0.15} isAnimationActive={false} name="band" />
            <Line type="monotone" dataKey="p5" name="5th pct" stroke="var(--accent)" strokeWidth={0} dot={false} isAnimationActive={false} legendType="none" />
            <Line type="monotone" dataKey="p95" name="95th pct" stroke="var(--accent)" strokeWidth={0} dot={false} isAnimationActive={false} legendType="none" />
            <Line type="monotone" dataKey="p50" name="Median replay" stroke="var(--accent)" strokeDasharray="4 3" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="actual" name="Actual lift" stroke="var(--text)" strokeWidth={2} dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3">
        <Stat label="5th percentile" value={f(boot.finalP5)} color={boot.finalP5 > 0 ? 'var(--green)' : 'var(--red)'} />
        <Stat label="Median" value={f(boot.finalP50)} color={boot.finalP50 > 0 ? 'var(--green)' : 'var(--red)'} />
        <Stat label="95th percentile" value={f(boot.finalP95)} color={boot.finalP95 > 0 ? 'var(--green)' : 'var(--red)'} />
      </div>
    </Card>
  )
}

// ── Robustness: Monte Carlo account survival ──
function SurvivalCard({ report, settings }) {
  const [horizon, setHorizon] = useState(50)
  const mll = settings?.mll || 2000
  const mc = useMemo(() => monteCarloSurvival(report.ideas, { horizon, mll, riskPerEntry: report.riskPerEntry }), [report.ideas, horizon, mll, report.riskPerEntry])
  if (!mc) return null
  const Row = ({ label, sink, copied, fmt, lowerIsBetter }) => {
    const better = lowerIsBetter ? sink < copied : sink > copied
    const worse = lowerIsBetter ? sink > copied : sink < copied
    return (
      <tr className="border-t" style={{ borderColor: 'var(--border)' }}>
        <td className="py-2 text-xs">{label}</td>
        <td className="py-2 text-right font-mono text-xs font-bold" style={{ color: better ? 'var(--green)' : worse ? 'var(--red)' : 'var(--text)' }}>{fmt(sink)}</td>
        <td className="py-2 text-right font-mono text-xs opacity-70">{fmt(copied)}</td>
      </tr>
    )
  }
  return (
    <Card title="Will the accounts survive?" icon={ShieldCheck}
      subtitle={`Next ${horizon} ideas, resampled 1,000× from your history · $${mll.toLocaleString()} max loss per account`} delay={0.35}
      right={
        <div className="flex gap-0.5 p-0.5 rounded-md" style={{ background: 'var(--surface)' }}>
          {[25, 50, 100].map(h => (
            <button key={h} onClick={() => setHorizon(h)} className="px-2 py-0.5 rounded text-[11px] font-semibold border-0 cursor-pointer"
              style={{ background: horizon === h ? 'var(--card)' : 'transparent', color: horizon === h ? 'var(--text)' : 'var(--text-dim)' }}>{h}</button>
          ))}
        </div>
      }
      info={<>
        This simulates your next {horizon} ideas, 1,000 times, by drawing randomly from ideas
        you've already logged (the 25/50/100 buttons set how far ahead to look). Under the sink,
        account 1 gets E1's result, account 2 gets E2's, account 3 gets E3's — exactly how your
        slots work. Under copied, all three accounts take E1's result. An account "busts" when it
        falls ${mll.toLocaleString()} below its own high-water mark, like a prop-firm trailing
        drawdown. This is the prop-firm view of the sink: not "did I make more?" but "how often
        do I lose an account?" — the sink's quiet superpower is that unfilled entries mean two
        accounts often sit out the losers. "10th pct" = a bad run (only 1 in 10 futures is worse);
        "90th pct" = a good run.
      </>}>
      <div className="grid grid-cols-2 gap-3 mb-3 mt-2">
        <div className="rounded-lg px-3 py-3" style={{ background: 'var(--surface)' }}>
          <div className="text-[11px] opacity-60">Sink · chance of losing ≥1 account</div>
          <div className="text-2xl font-mono font-extrabold" style={{ color: mc.sink.pAnyBust <= mc.copied.pAnyBust ? 'var(--green)' : 'var(--red)' }}>{pct(mc.sink.pAnyBust)}</div>
          <div className="text-[11px] opacity-50">expected accounts lost: {mc.sink.expectedBusts.toFixed(2)}</div>
        </div>
        <div className="rounded-lg px-3 py-3" style={{ background: 'var(--surface)' }}>
          <div className="text-[11px] opacity-60">Copied ×3 · chance of losing ≥1 account</div>
          <div className="text-2xl font-mono font-extrabold" style={{ color: C.copied }}>{pct(mc.copied.pAnyBust)}</div>
          <div className="text-[11px] opacity-50">expected accounts lost: {mc.copied.expectedBusts.toFixed(2)} <span className="opacity-70">(all-or-none — same trades)</span></div>
        </div>
      </div>
      <table className="w-full">
        <thead>
          <tr className="text-[11px] opacity-50 text-left">
            <th className="font-medium pb-1">Pooled, over {horizon} ideas</th>
            <th className="font-medium pb-1 text-right">Sink</th>
            <th className="font-medium pb-1 text-right">Copied ×3</th>
          </tr>
        </thead>
        <tbody>
          <Row label="Median P&L" sink={mc.sink.medianPnl} copied={mc.copied.medianPnl} fmt={formatPnl} />
          <Row label="Bad run (10th pct) P&L" sink={mc.sink.p10Pnl} copied={mc.copied.p10Pnl} fmt={formatPnl} />
          <Row label="Good run (90th pct) P&L" sink={mc.sink.p90Pnl} copied={mc.copied.p90Pnl} fmt={formatPnl} />
          <Row label="Median worst drawdown" sink={mc.sink.medianMaxDd} copied={mc.copied.medianMaxDd} fmt={(v) => formatPnl(-v)} lowerIsBetter />
          <Row label="Bad-run worst drawdown (90th)" sink={mc.sink.p90MaxDd} copied={mc.copied.p90MaxDd} fmt={(v) => formatPnl(-v)} lowerIsBetter />
        </tbody>
      </table>
    </Card>
  )
}

// ── Risk headroom: what per-entry risk does your history support? ──
// Deliberately framed as a CEILING at a bust tolerance the trader picks, not
// a recommendation to size up. Quiet by design: no nudges, no alerts.
function HeadroomCard({ report, settings }) {
  const [tolerance, setTolerance] = useState(0.05)
  const mll = settings?.mll || 2000
  const current = report.riskPerEntry
  const ladder = useMemo(
    () => riskLadder(report.ideas, { mll, riskPerEntry: current, maxBust: tolerance }),
    [report.ideas, mll, current, tolerance]
  )
  if (!ladder) return null
  const data = ladder.rows.map(r => ({ ...r, bustPct: r.pAnyBust * 100 }))
  const currentRow = ladder.rows.find(r => r.risk === current)
  const small = report.n < 30
  const safe = ladder.safeRisk

  return (
    <Card title="How much risk does your history support?" icon={Gauge}
      subtitle={`Same ideas replayed at other $-per-entry sizes · $${mll.toLocaleString()} trailing drawdown · next ${ladder.horizon} ideas`}
      delay={0.4}
      right={
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] opacity-50">bust chance I'd accept</span>
          <div className="flex gap-0.5 p-0.5 rounded-md" style={{ background: 'var(--surface)' }}>
            {[0.02, 0.05, 0.10].map(t => (
              <button key={t} onClick={() => setTolerance(t)} className="px-2 py-0.5 rounded text-[11px] font-semibold border-0 cursor-pointer"
                style={{ background: tolerance === t ? 'var(--card)' : 'transparent', color: tolerance === t ? 'var(--text)' : 'var(--text-dim)' }}>{Math.round(t * 100)}%</button>
            ))}
          </div>
        </div>
      }
      info={<>
        Because you always risk a fixed dollar amount per entry, your whole history scales cleanly:
        at $300 per entry every win and loss would simply have been 1.5× its logged size. This card
        replays your ideas 800 times at each size on the ladder ($100–$500) and asks: at this size,
        how often does an account's trailing drawdown hit ${mll.toLocaleString()} within the next
        {' '}{ladder.horizon} ideas? The headline is the LARGEST size that stays under the bust
        chance you selected above. Read it as a ceiling your data can currently justify — not a
        target, and not advice. It assumes the future resembles your logged past, so it deserves
        more trust as the idea count grows, and less right after a change in market or style.
        Two honest asymmetries to keep in mind: a busted account costs a reset fee and weeks of
        rebuilding, while extra size only adds marginal dollars; and this can't see risks that
        aren't in your history yet.
      </>}>

      <div className="flex items-baseline gap-3 mb-1 mt-1 flex-wrap">
        {safe ? (
          <>
            <span className="text-3xl font-extrabold font-mono" style={{ color: safe > current ? 'var(--green)' : safe < current ? 'var(--orange)' : 'var(--text)' }}>
              ${safe}
            </span>
            <span className="text-xs" style={{ color: 'var(--text)' }}>
              per entry is the most your history supports at a {Math.round(tolerance * 100)}% bust chance
              <span className="opacity-60"> · you risk ${current} now{currentRow ? ` (${Math.round(currentRow.pAnyBust * 100)}% bust chance)` : ''}</span>
            </span>
          </>
        ) : (
          <span className="text-sm" style={{ color: 'var(--red)' }}>
            Even ${ladder.rows[0].risk} per entry exceeds a {Math.round(tolerance * 100)}% bust chance on this history — the drawdowns in your data are too large for that tolerance.
          </span>
        )}
      </div>
      <p className="text-[11px] opacity-50 mb-3">
        A ceiling, not a target — staying under it is the point.{small ? ` Only ${report.n} ideas so far: treat this as a rough sketch until ~30+.` : ''}
      </p>

      <div style={{ height: 170 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="risk" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} width={40} tickFormatter={(v) => `${v}%`} allowDecimals={false} />
            <Tooltip content={<ChartTip fmt={(v) => `${(+v).toFixed(1)}%`} labelFmt={(l) => `$${l} risked per entry`} />} cursor={{ stroke: 'var(--border-hover)' }} />
            <ReferenceLine y={tolerance * 100} stroke="var(--red)" strokeDasharray="4 3" label={{ value: `${Math.round(tolerance * 100)}% tolerance`, position: 'insideTopRight', fill: 'var(--red)', fontSize: 10 }} />
            <ReferenceLine x={current} stroke="var(--accent)" strokeDasharray="3 3" label={{ value: 'you', position: 'insideTopLeft', fill: 'var(--accent)', fontSize: 10 }} />
            <Line type="monotone" dataKey="bustPct" name="Chance of losing ≥1 account" stroke="var(--orange)" strokeWidth={2} dot={{ r: 3, fill: 'var(--orange)', strokeWidth: 0 }} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3">
        <Stat label={`At $${current} (now)`} value={currentRow ? `${Math.round(currentRow.pAnyBust * 100)}%` : '—'} sub="bust chance" />
        <Stat label={safe ? `At $${safe} (ceiling)` : 'Ceiling'} value={safe ? `${Math.round((ladder.rows.find(r => r.risk === safe)?.pAnyBust || 0) * 100)}%` : '—'} sub="bust chance" />
        <Stat label={safe && currentRow ? 'Median P&L at ceiling' : 'Median P&L'} value={safe ? formatPnl(ladder.rows.find(r => r.risk === safe)?.medianPnl || 0) : currentRow ? formatPnl(currentRow.medianPnl) : '—'} sub={`over ${ladder.horizon} ideas, pooled`} />
      </div>
    </Card>
  )
}

// ── Secondary: by instrument ──
function InstrumentCard({ report }) {
  const { byInstrument } = report
  if (byInstrument.length < 2) return null
  return (
    <Card title="Lift by instrument" icon={Layers} delay={0.4}
      info={<>
        The same sink-vs-copied comparison, split by what you traded. A strongly negative lift on
        one instrument with a positive lift on another suggests the stagger suits how one market
        moves (deep pullbacks that reverse) better than the other — worth watching once each row
        has a few dozen ideas, meaningless before that.
      </>}>
      <table className="w-full mt-2">
        <thead>
          <tr className="text-[11px] opacity-50 text-left">
            <th className="font-medium pb-1">Instrument</th>
            <th className="font-medium pb-1 text-right">Ideas</th>
            <th className="font-medium pb-1 text-right">Sink</th>
            <th className="font-medium pb-1 text-right">Copied ×3</th>
            <th className="font-medium pb-1 text-right">Lift</th>
          </tr>
        </thead>
        <tbody>
          {byInstrument.map(r => (
            <tr key={r.instrument} className="border-t text-xs" style={{ borderColor: 'var(--border)' }}>
              <td className="py-2 font-semibold">{r.instrument}</td>
              <td className="py-2 text-right font-mono">{r.ideas}</td>
              <td className="py-2 text-right font-mono" style={{ color: r.actualPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>{formatPnl(r.actualPnl)}</td>
              <td className="py-2 text-right font-mono opacity-70">{formatPnl(r.copiedPnl)}</td>
              <td className="py-2 text-right font-mono font-bold" style={{ color: r.liftPnl > 0 ? 'var(--green)' : r.liftPnl < 0 ? 'var(--red)' : 'var(--text-dim)' }}>{formatPnl(r.liftPnl)} <span className="opacity-50 font-normal">({fmtR(r.liftR)})</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

// ── Page ──
export default function RiskSink({ state }) {
  const [unit, setUnit] = useState('$')
  const [from, setFrom] = useState('')
  const [excludeRescues, setExcludeRescues] = useState(false)
  const [showPrimer, setShowPrimer] = useState(false)

  const report = useMemo(
    () => calcRiskSinkReport(state.trades || [], state.settings, { from, excludeRescues }),
    [state.trades, state.settings, from, excludeRescues]
  )

  const Toggle = ({ value, options, onChange }) => (
    <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--surface)' }}>
      {options.map(o => (
        <button key={o} onClick={() => onChange(o)} className="px-3 py-1 rounded-md text-sm font-semibold transition-all border-0 cursor-pointer"
          style={{ background: value === o ? 'var(--card)' : 'transparent', color: value === o ? 'var(--text)' : 'var(--text-dim)', boxShadow: value === o ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
          {o}
        </button>
      ))}
    </div>
  )

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight" style={{ color: 'var(--text)' }}>Risk Sink</h1>
          <p className="text-xs opacity-60 mt-0.5">
            One question: what does staggering into three accounts actually buy you?
            <button onClick={() => setShowPrimer(v => !v)}
              className="ml-2 inline-flex items-center gap-1 border-0 bg-transparent cursor-pointer text-xs font-semibold"
              style={{ color: 'var(--accent)' }}>
              <HelpCircle size={12} /> {showPrimer ? 'hide the primer' : 'what am I looking at?'}
            </button>
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-xs opacity-80">
            <span>From</span>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="rounded-md px-2 py-1 text-xs border bg-transparent"
              style={{ borderColor: 'var(--border)', color: 'var(--text)', colorScheme: state.settings?.theme === 'light' ? 'light' : 'dark' }} />
            {from && <button onClick={() => setFrom('')} className="border-0 bg-transparent cursor-pointer opacity-60" style={{ color: 'var(--text)' }}><X size={12} /></button>}
          </label>
          {report.rescuesFound > 0 && (
            <label className="flex items-center gap-1.5 text-xs opacity-80 cursor-pointer">
              <input type="checkbox" checked={excludeRescues} onChange={e => setExcludeRescues(e.target.checked)} />
              Hide re-entry-era ideas ({report.rescuesFound})
            </label>
          )}
          <Toggle value={unit} options={['$', 'R']} onChange={setUnit} />
        </div>
      </div>

      {showPrimer && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-[14px] p-5 border text-xs leading-relaxed space-y-2"
          style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)' }}>
          <p className="font-semibold text-sm">The one idea behind this page</p>
          <p>
            Every trade idea you log secretly contains an experiment. E1 is the entry you'd take no
            matter what — so we can ask: what did staggering E2/E3 deeper actually change, compared
            to just copying E1 into all three accounts?
          </p>
          <p>
            <span className="font-semibold" style={{ color: C.actual }}>Sink</span> — what really happened: every entry that filled, added up.<br />
            <span className="font-semibold" style={{ color: C.copied }}>Copied ×3</span> — the alternative you: E1's result times three, because all three accounts took the same first entry. This is the fair benchmark — same budget, same idea, no stagger.<br />
            <span className="font-semibold">Single</span> — one account taking only E1, shown for scale.<br />
            <span className="font-semibold" style={{ color: C.lift }}>Lift</span> — sink minus copied. The page's verdict number. Positive = the stagger is earning its keep.
          </p>
          <p>
            <span className="font-semibold">R</span> is your unit of risk: 1R = the $200 you risk per entry. A "+4R" win made 4 × $200 = $800.
            <span className="font-semibold"> Drawdown</span> is how far an equity curve has fallen from its highest point — what prop firms actually measure you on.
            <span className="font-semibold"> Percentiles</span> (5th/50th/95th) are just "bad run / typical / good run" across many simulated replays.
          </p>
          <p className="opacity-70">
            The page reads top to bottom: the verdict (did the sink pay?), then why (which mechanics
            produced it), then whether to believe it (luck checks and account-survival odds). Every
            card has an <Info size={11} className="inline" /> button with a plain-English explanation.
          </p>
        </motion.div>
      )}

      {report.n === 0 ? (
        <Card>
          <div className="py-10 text-center text-sm opacity-60">
            No completed ideas {from ? 'since that date' : 'yet'}. Log a few ideas — W/L and R per entry is all this page needs.
          </div>
        </Card>
      ) : (
        <>
          {!report.usedLaterEntries && (
            <div className="rounded-lg px-4 py-3 text-xs border" style={{ background: 'var(--orange-dim)', borderColor: 'var(--border)', color: 'var(--text)' }}>
              None of these ideas used E2 or E3 yet, so the sink and the copied baseline only differ by size. The comparison gets interesting once deeper entries fill.
            </div>
          )}

          <HeroCard report={report} unit={unit} />

          <div>
            <h2 className="text-xs font-semibold tracking-wide opacity-60 mb-3 uppercase">Why the lift exists</h2>
            <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 2fr' }}>
              <FunnelCard report={report} />
              <DepthCard report={report} />
            </div>
            <div className="grid gap-4 mt-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <SlotRCard report={report} />
              <LedgerCard report={report} />
            </div>
          </div>

          <div>
            <h2 className="text-xs font-semibold tracking-wide opacity-60 mb-3 uppercase">Is it real, and will it hold?</h2>
            <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <RollingCard report={report} unit={unit} />
              <BootstrapCard report={report} unit={unit} />
            </div>
            <div className="grid gap-4 mt-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <SurvivalCard report={report} settings={state.settings} />
              <HeadroomCard report={report} settings={state.settings} />
            </div>
            <div className="mt-4">
              <InstrumentCard report={report} />
            </div>
          </div>

          <p className="text-[11px] opacity-40 leading-relaxed max-w-3xl">
            Method notes · "Copied ×3" assumes you would have taken E1's exact stop and target in all three accounts — fair for a shared-stop,
            building-position style, but a model, not an observation. Ideas where E1 lost and a later entry won carry a re-entry-style
            signature (impossible with one shared stop); hide them above to judge the current style alone. Dollar figures come from the
            logged P&L per entry, falling back to R × ${report.riskPerEntry} when none was logged.
          </p>
        </>
      )}
    </div>
  )
}
