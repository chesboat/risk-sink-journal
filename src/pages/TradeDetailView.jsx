import { useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Edit3, Camera, Clipboard, Trash2, X,
  Clock, TrendingUp, Target, FileText, Tag, ChevronRight,
  ZoomIn, ZoomOut, Maximize2
} from 'lucide-react'
import {
  getIdeaResult, getNetR, getNetPnl, formatPnl, formatDate,
  ENTRY_LABELS, ENTRY_COLORS,
  TAG_CATEGORIES,
} from '../lib/store'

// ── Screenshot Viewer ──
function ScreenshotViewer({ src }) {
  const [zoomed, setZoomed] = useState(false)

  if (!src) return (
    <div
      className="rounded-xl flex items-center justify-center"
      style={{ background: 'var(--surface)', border: '1px dashed var(--border)', minHeight: 260 }}
    >
      <div className="text-center py-12">
        <Camera size={32} style={{ color: 'var(--text-dim)', opacity: 0.3 }} className="mx-auto mb-2" />
        <p className="text-sm font-medium" style={{ color: 'var(--text-dim)', opacity: 0.5 }}>No chart screenshot</p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-dim)', opacity: 0.3 }}>Edit this trade to add one</p>
      </div>
    </div>
  )

  return (
    <>
      <div
        className="rounded-xl overflow-hidden cursor-pointer relative group"
        style={{ border: '1px solid var(--border)' }}
        onClick={() => setZoomed(true)}
      >
        <img src={src} alt="Chart" className="w-full object-contain" style={{ maxHeight: 420 }} />
        <div
          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: 'rgba(0,0,0,0.2)' }}
        >
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: 'rgba(0,0,0,0.7)', color: '#fff' }}>
            <Maximize2 size={14} />
            Click to expand
          </div>
        </div>
      </div>

      {/* Fullscreen lightbox */}
      {zoomed && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center p-8"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => setZoomed(false)}
        >
          <button
            onClick={() => setZoomed(false)}
            className="absolute top-6 right-6 p-2 rounded-full border-0 cursor-pointer z-10"
            style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}
          >
            <X size={20} />
          </button>
          <motion.img
            src={src}
            alt="Chart"
            className="max-w-full max-h-full rounded-xl object-contain"
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            onClick={(e) => e.stopPropagation()}
          />
        </motion.div>
      )}
    </>
  )
}

// ── Tag Pill ──
function TagPill({ label, color }) {
  return (
    <span
      className="px-2.5 py-1 rounded-lg text-[11px] font-semibold"
      style={{ background: `${color}18`, color }}
    >
      {label}
    </span>
  )
}

// ── Journal Section ──
function JournalBlock({ title, icon: Icon, content, emptyText }) {
  if (!content) return (
    <div className="rounded-xl px-4 py-3" style={{ background: 'var(--surface)', border: '1px dashed var(--border)' }}>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} style={{ color: 'var(--text-dim)', opacity: 0.4 }} />
        <span className="text-xs font-semibold" style={{ color: 'var(--text-dim)', opacity: 0.5 }}>{title}</span>
      </div>
      <p className="text-xs italic" style={{ color: 'var(--text-dim)', opacity: 0.3 }}>{emptyText}</p>
    </div>
  )

  return (
    <div className="rounded-xl px-4 py-3" style={{ background: 'var(--surface)' }}>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} style={{ color: 'var(--accent)' }} />
        <span className="text-xs font-semibold" style={{ color: 'var(--text-dim)' }}>{title}</span>
      </div>
      <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text)' }}>{content}</p>
    </div>
  )
}

// ═══════════════════════════════════════════════════
// MAIN TRADE DETAIL VIEW
// ═══════════════════════════════════════════════════

export default function TradeDetailView({ trade, onBack, onEdit, onDelete }) {
  // Escape to go back — must be before any conditional returns (Rules of Hooks)
  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onBack() }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onBack])

  if (!trade) return null

  const ideaResult = getIdeaResult(trade)
  const netR = getNetR(trade)
  const netPnl = getNetPnl(trade)
  const entries = trade.entries || []
  const triggeredEntries = entries.filter(e => e.triggered && e.result)
  const tags = trade.tags || { mistakes: [], conditions: [], confirmations: [], riskSinkStyles: [] }
  const hasTags = TAG_CATEGORIES.some(c => (tags[c.key]?.length || 0) > 0)
  const hasJournal = trade.thesis || trade.notes || trade.lesson

  return (
    <div className="pb-16">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold cursor-pointer border-0 transition-colors"
          style={{ background: 'var(--surface)', color: 'var(--text-dim)' }}
        >
          <ArrowLeft size={16} />
          Back
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onEdit(trade)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer border-0 transition-colors"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            <Edit3 size={14} />
            Edit Trade
          </button>
          <button
            onClick={() => {
              if (window.confirm('Delete this trade? This cannot be undone.')) {
                onDelete(trade.id)
                onBack()
              }
            }}
            className="p-2 rounded-xl cursor-pointer border-0 transition-colors"
            style={{ background: 'var(--surface)', color: 'var(--red)' }}
            title="Delete trade"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Trade header */}
      <div className="flex items-center gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text)' }}>
              {trade.instrument}
            </h1>
            {ideaResult && (
              <span
                className="px-3 py-1 rounded-lg text-sm font-bold"
                style={{
                  background: ideaResult === 'WIN' ? 'var(--green-dim)' : 'var(--red-dim)',
                  color: ideaResult === 'WIN' ? 'var(--green)' : 'var(--red)',
                }}
              >
                {ideaResult}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm font-mono" style={{ color: 'var(--text-dim)' }}>
              {formatDate(trade.date)}
            </span>
            {trade.session && (
              <span className="text-xs px-2 py-0.5 rounded-md" style={{ background: 'var(--surface)', color: 'var(--text-dim)' }}>
                {trade.session}
              </span>
            )}
            {trade.setup && (
              <span className="text-xs px-2 py-0.5 rounded-md" style={{ background: 'var(--surface)', color: 'var(--text-dim)' }}>
                {trade.setup}
              </span>
            )}
          </div>
        </div>

        <div className="ml-auto flex gap-6 text-right">
          <div>
            <p className="text-xs font-medium" style={{ color: 'var(--text-dim)', opacity: 0.6 }}>Net R</p>
            <p className="text-xl font-extrabold font-mono" style={{ color: netR >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {netR >= 0 ? '+' : ''}{netR.toFixed(1)}R
            </p>
          </div>
          <div>
            <p className="text-xs font-medium" style={{ color: 'var(--text-dim)', opacity: 0.6 }}>P&L</p>
            <p className="text-xl font-extrabold font-mono" style={{ color: netPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {formatPnl(netPnl)}
            </p>
          </div>
        </div>
      </div>

      {/* Two-column layout: Screenshot + Journal | Sidebar */}
      <div className="grid gap-6" style={{ gridTemplateColumns: '1fr 340px' }}>

        {/* Left column: Screenshot + Journal */}
        <div className="space-y-5">
          {/* Chart Screenshot */}
          <ScreenshotViewer src={trade.screenshot} />

          {/* Journal entries */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold tracking-wide" style={{ color: 'var(--text-dim)', opacity: 0.5, textTransform: 'uppercase' }}>
              Journal
            </h3>
            <JournalBlock
              title="Trade Thesis"
              icon={Target}
              content={trade.thesis}
              emptyText="No thesis recorded — what was your reasoning?"
            />
            <JournalBlock
              title="Post-Trade Notes"
              icon={FileText}
              content={trade.notes}
              emptyText="No post-trade notes — what happened during the trade?"
            />
            <JournalBlock
              title="Key Lesson"
              icon={TrendingUp}
              content={trade.lesson}
              emptyText="No lesson recorded — what's the one takeaway?"
            />
          </div>
        </div>

        {/* Right column: Entries + Tags + Meta */}
        <div className="space-y-5">

          {/* Entry Results */}
          <div className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <h3 className="text-xs font-semibold tracking-wide mb-3" style={{ color: 'var(--text-dim)', opacity: 0.5, textTransform: 'uppercase' }}>
              Entry Results
            </h3>
            <div className="space-y-2.5">
              {entries.map((entry, i) => {
                const slot = entry.slot || (i + 1)
                const label = ENTRY_LABELS[slot] || `E${slot}`
                const color = ENTRY_COLORS[slot] || '#888'
                const isTriggered = entry.triggered && entry.result
                return (
                  <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg" style={{ background: 'var(--surface)' }}>
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                      <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{label}</span>
                    </div>
                    {isTriggered ? (
                      <div className="flex items-center gap-3">
                        <span
                          className="text-xs font-bold px-2 py-0.5 rounded"
                          style={{
                            background: entry.result === 'W' ? 'var(--green-dim)' : entry.result === 'L' ? 'var(--red-dim)' : 'var(--surface)',
                            color: entry.result === 'W' ? 'var(--green)' : entry.result === 'L' ? 'var(--red)' : 'var(--text-dim)',
                          }}
                        >
                          {entry.result === 'W' ? 'WIN' : entry.result === 'L' ? 'LOSS' : 'BE'}
                        </span>
                        {entry.result === 'W' && entry.r && (
                          <span className="text-xs font-mono font-bold" style={{ color: 'var(--green)' }}>+{entry.r}R</span>
                        )}
                        {entry.pnl !== undefined && entry.pnl !== 0 && (
                          <span className="text-xs font-mono font-bold" style={{ color: entry.pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                            {formatPnl(entry.pnl)}
                          </span>
                        )}
                      </div>
                    ) : entry.triggered ? (
                      // Triggered but no result yet — a live/pending entry,
                      // not the same thing as one that never fired.
                      <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: 'var(--blue-dim)', color: 'var(--accent)' }}>OPEN</span>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--text-dim)', opacity: 0.4 }}>Not triggered</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Tags */}
          <div className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <h3 className="text-xs font-semibold tracking-wide mb-3" style={{ color: 'var(--text-dim)', opacity: 0.5, textTransform: 'uppercase' }}>
              Tags
            </h3>
            {hasTags ? (
              <div className="space-y-3">
                {TAG_CATEGORIES.map(cat => (
                  (tags[cat.key]?.length > 0) && (
                    <div key={cat.key}>
                      <p className="text-[10px] font-semibold mb-1.5" style={{ color: cat.color, opacity: 0.7 }}>{cat.label}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {tags[cat.key].map(t => <TagPill key={t} label={t} color={cat.color} />)}
                      </div>
                    </div>
                  )
                ))}
              </div>
            ) : (
              <p className="text-xs italic" style={{ color: 'var(--text-dim)', opacity: 0.3 }}>No tags — edit this trade to add tags</p>
            )}
          </div>

          {/* Trade Metadata */}
          <div className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <h3 className="text-xs font-semibold tracking-wide mb-3" style={{ color: 'var(--text-dim)', opacity: 0.5, textTransform: 'uppercase' }}>
              Details
            </h3>
            <div className="space-y-2">
              {[
                { label: 'Date', value: formatDate(trade.date) },
                { label: 'Instrument', value: trade.instrument },
                { label: 'Session', value: trade.session || '—' },
                { label: 'Setup', value: trade.setup || '—' },
                { label: 'Emotion', value: trade.emotion || '—' },
                { label: 'Account', value: trade.account || '—' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center">
                  <span className="text-xs" style={{ color: 'var(--text-dim)', opacity: 0.6 }}>{label}</span>
                  <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
