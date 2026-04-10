import { ArrowLeft, Edit2, Trash2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { getIdeaResult, getNetPnl, getNetR, formatCurrency, ENTRY_LABELS } from '../lib/store'

const ACCOUNT_NAMES = { 1: 'Lucid', 2: 'Tradeify', 3: 'Topstep' }

function EntryCard({ entry }) {
  const bg =
    !entry.triggered
      ? 'transparent'
      : entry.result === 'W'
      ? 'color-mix(in srgb, var(--green) 12%, var(--card))'
      : entry.result === 'L'
      ? 'color-mix(in srgb, var(--red) 12%, var(--card))'
      : 'var(--card)'
  const border =
    !entry.triggered
      ? '1px dashed var(--border)'
      : entry.result === 'W'
      ? '1px solid color-mix(in srgb, var(--green) 40%, var(--border))'
      : entry.result === 'L'
      ? '1px solid color-mix(in srgb, var(--red) 40%, var(--border))'
      : '1px solid var(--border)'

  return (
    <div className="rounded-xl p-3" style={{ background: bg, border }}>
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
          {ENTRY_LABELS[entry.slot] || `E${entry.slot}`}
        </div>
        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
          {ACCOUNT_NAMES[entry.slot]}
        </div>
      </div>
      {!entry.triggered ? (
        <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          Not triggered
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div
            className="text-xs font-bold"
            style={{
              color:
                entry.result === 'W'
                  ? 'var(--green)'
                  : entry.result === 'L'
                  ? 'var(--red)'
                  : 'var(--text-dim)',
            }}
          >
            {entry.result || '—'} · {entry.r >= 0 ? '+' : ''}
            {entry.r}R
          </div>
          <div
            className="text-sm font-bold font-mono"
            style={{ color: entry.pnl >= 0 ? 'var(--green)' : 'var(--red)' }}
          >
            {formatCurrency(entry.pnl || 0)}
          </div>
        </div>
      )}
    </div>
  )
}

function TagRow({ label, tags, color }) {
  if (!tags || tags.length === 0) return null
  return (
    <div className="mb-3">
      <div className="text-[10px] font-semibold uppercase mb-1.5" style={{ color: 'var(--text-muted)' }}>
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t, i) => (
          <span
            key={i}
            className="text-[10px] font-medium px-2 py-0.5 rounded-full"
            style={{
              background: `color-mix(in srgb, ${color} 15%, transparent)`,
              color,
              border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
            }}
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function MobileTradeDetail({ trade, onBack, onEdit, onDelete }) {
  const pnl = getNetPnl(trade)
  const r = getNetR(trade)
  const result = getIdeaResult(trade)

  return (
    <div className="pb-24">
      {/* Header */}
      <div
        className="sticky top-0 z-20 px-4 py-3 flex items-center justify-between border-b"
        style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
      >
        <button
          onClick={onBack}
          className="p-2 rounded-lg border-0 cursor-pointer -ml-2"
          style={{ background: 'transparent', color: 'var(--text)' }}
        >
          <ArrowLeft size={20} />
        </button>
        <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
          Trade
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => onEdit(trade)}
            className="p-2 rounded-lg border-0 cursor-pointer"
            style={{ background: 'transparent', color: 'var(--blue)' }}
          >
            <Edit2 size={18} />
          </button>
          <button
            onClick={() => {
              if (confirm('Delete this trade?')) onDelete(trade.id)
            }}
            className="p-2 rounded-lg border-0 cursor-pointer"
            style={{ background: 'transparent', color: 'var(--red)' }}
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="px-4 pt-4">
        {/* Hero */}
        <div
          className="rounded-2xl p-4 mb-3 border"
          style={{
            background:
              pnl > 0
                ? 'linear-gradient(135deg, color-mix(in srgb, var(--green) 18%, var(--card)), var(--card))'
                : pnl < 0
                ? 'linear-gradient(135deg, color-mix(in srgb, var(--red) 18%, var(--card)), var(--card))'
                : 'var(--card)',
            borderColor: 'var(--border)',
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-base font-bold" style={{ color: 'var(--text)' }}>
                {trade.instrument}
              </div>
              <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {new Date(trade.date + 'T00:00:00').toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
                {' · '}
                {trade.session}
              </div>
            </div>
            {result && (
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{
                  background: result === 'WIN' ? 'var(--green-dim)' : 'var(--red-dim)',
                  color: result === 'WIN' ? 'var(--green)' : 'var(--red)',
                }}
              >
                {result}
              </span>
            )}
          </div>
          <div className="flex items-end justify-between">
            <div
              className="text-3xl font-bold font-mono"
              style={{ color: pnl > 0 ? 'var(--green)' : pnl < 0 ? 'var(--red)' : 'var(--text)' }}
            >
              {formatCurrency(pnl)}
            </div>
            <div
              className="text-sm font-bold font-mono"
              style={{ color: r >= 0 ? 'var(--green)' : 'var(--red)' }}
            >
              {r >= 0 ? '+' : ''}
              {r.toFixed(2)}R
            </div>
          </div>
        </div>

        {/* Setup + quality + emotion */}
        {(trade.setup || trade.quality || trade.emotion) && (
          <div
            className="rounded-2xl p-3 mb-3 border flex items-center justify-between flex-wrap gap-2"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          >
            {trade.setup && (
              <div>
                <div className="text-[9px] uppercase" style={{ color: 'var(--text-muted)' }}>
                  Setup
                </div>
                <div className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
                  {trade.setup}
                </div>
              </div>
            )}
            {trade.quality && (
              <div>
                <div className="text-[9px] uppercase" style={{ color: 'var(--text-muted)' }}>
                  Grade
                </div>
                <div className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
                  {trade.quality}
                </div>
              </div>
            )}
            {trade.emotion && (
              <div>
                <div className="text-[9px] uppercase" style={{ color: 'var(--text-muted)' }}>
                  Emotion
                </div>
                <div className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
                  {trade.emotion}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Entry results */}
        <div className="mb-3">
          <div
            className="text-[10px] font-semibold uppercase tracking-wider mb-2 px-1"
            style={{ color: 'var(--text-muted)' }}
          >
            Entry Results
          </div>
          <div className="space-y-2">
            {(trade.entries || []).map((entry, i) => (
              <EntryCard key={i} entry={{ ...entry, slot: entry.slot || i + 1 }} />
            ))}
          </div>
        </div>

        {/* Thesis / Notes / Lesson */}
        {trade.thesis && (
          <div
            className="rounded-2xl p-3 mb-2 border"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <div className="text-[10px] font-semibold uppercase mb-1.5" style={{ color: 'var(--text-muted)' }}>
              Thesis
            </div>
            <div className="text-[13px] leading-relaxed" style={{ color: 'var(--text)' }}>
              {trade.thesis}
            </div>
          </div>
        )}

        {trade.notes && (
          <div
            className="rounded-2xl p-3 mb-2 border"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <div className="text-[10px] font-semibold uppercase mb-1.5" style={{ color: 'var(--text-muted)' }}>
              Notes
            </div>
            <div className="text-[13px] leading-relaxed" style={{ color: 'var(--text)' }}>
              {trade.notes}
            </div>
          </div>
        )}

        {trade.lesson && (
          <div
            className="rounded-2xl p-3 mb-2 border"
            style={{
              background: 'color-mix(in srgb, var(--blue) 8%, var(--card))',
              borderColor: 'color-mix(in srgb, var(--blue) 30%, var(--border))',
            }}
          >
            <div className="text-[10px] font-semibold uppercase mb-1.5" style={{ color: 'var(--blue)' }}>
              Lesson
            </div>
            <div className="text-[13px] leading-relaxed" style={{ color: 'var(--text)' }}>
              {trade.lesson}
            </div>
          </div>
        )}

        {/* Tags */}
        {(trade.tags?.confirmations?.length ||
          trade.tags?.conditions?.length ||
          trade.tags?.mistakes?.length) ? (
          <div
            className="rounded-2xl p-3 mt-2 border"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <TagRow label="Confirmations" tags={trade.tags?.confirmations} color="var(--green)" />
            <TagRow label="Conditions" tags={trade.tags?.conditions} color="var(--blue)" />
            <TagRow label="Mistakes" tags={trade.tags?.mistakes} color="var(--red)" />
          </div>
        ) : null}

        {/* Screenshot */}
        {trade.screenshot && (
          <div
            className="rounded-2xl overflow-hidden mt-2 border"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <img src={trade.screenshot} alt="Trade screenshot" className="w-full" />
          </div>
        )}
      </motion.div>
    </div>
  )
}
