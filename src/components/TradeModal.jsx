import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Camera, Clipboard, Trash2 } from 'lucide-react'
import {
  createTrade,
  rememberTradeDefaults,
  deriveEntryRisk,
  INSTRUMENTS,
  SESSIONS,
  SETUPS,
  EMOTIONS,
  QUALITIES,
  ENTRY_LABELS,
  TAG_CATEGORIES,
} from '../lib/store'

// ═══════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════

function Chip({ label, selected, onClick, color }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-200 cursor-pointer border-0"
      style={{
        background: selected ? (color || 'var(--accent)') : 'var(--surface)',
        color: selected ? '#fff' : 'var(--text-dim)',
        border: `1px solid ${selected ? 'transparent' : 'var(--border)'}`,
      }}
    >
      {label}
    </button>
  )
}

function MultiChip({ label, selected, onClick, color }) {
  return (
    <button
      onClick={onClick}
      className="px-2.5 py-1 rounded-lg text-[12px] font-semibold transition-all duration-200 cursor-pointer border-0"
      style={{
        background: selected ? (color || 'var(--accent)') : 'var(--surface)',
        color: selected ? '#fff' : 'var(--text-dim)',
        border: `1px solid ${selected ? 'transparent' : 'var(--border)'}`,
      }}
    >
      {label}
    </button>
  )
}

function SectionLabel({ children }) {
  return (
    <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-dim)' }}>
      {children}
    </label>
  )
}

// ═══════════════════════════════════════════════════
// ENTRY ROW
// ═══════════════════════════════════════════════════

function EntryRow({ slot, entry, onChange, instrument, sharedStop }) {
  const colors = { 1: 'var(--green)', 2: 'var(--orange)', 3: 'var(--teal)' }
  const c = colors[slot]
  // Optional price capture — lets the app DERIVE risk $ and R instead of
  // trusting a hand-typed R. Opens automatically if data already exists.
  const [showDetails, setShowDetails] = useState(
    entry.qty != null || entry.entryPrice != null || entry.stopPrice != null
  )
  const risk = deriveEntryRisk(entry, instrument)
  const numOrNull = (v) => (v === '' ? null : parseFloat(v))
  const detailField = (key, label, step) => (
    <div className="flex-1">
      <div className="text-[10px] mb-0.5" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <input
        type="number"
        step={step}
        value={entry[key] ?? ''}
        onChange={e => onChange({ ...entry, [key]: numOrNull(e.target.value) })}
        className="w-full px-2 py-1.5 rounded-lg text-sm font-mono outline-none"
        style={{ background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)' }}
      />
    </div>
  )

  return (
    <div className="p-3 rounded-xl mb-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold" style={{ color: c }}>{ENTRY_LABELS[slot]}</span>
        <button
          onClick={() => onChange({ ...entry, triggered: !entry.triggered })}
          className="px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer border-0 transition-all"
          style={{
            background: entry.triggered ? c : 'var(--card)',
            color: entry.triggered ? '#fff' : 'var(--text-muted)',
            border: `1px solid ${entry.triggered ? 'transparent' : 'var(--border)'}`,
          }}
        >
          {entry.triggered ? 'Triggered' : 'Not Triggered'}
        </button>
      </div>
      {entry.triggered && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="flex gap-3 items-center"
        >
          <div className="flex gap-1">
            {['W', 'L', 'BE'].map(r => (
              <button
                key={r}
                onClick={() => onChange({ ...entry, result: r })}
                className="w-10 h-8 rounded-lg text-xs font-bold cursor-pointer border-0 transition-all"
                style={{
                  background: entry.result === r
                    ? (r === 'W' ? 'var(--green)' : r === 'L' ? 'var(--red)' : 'var(--text-dim)')
                    : 'var(--card)',
                  color: entry.result === r ? '#fff' : 'var(--text-muted)',
                  border: `1px solid ${entry.result === r ? 'transparent' : 'var(--border)'}`,
                }}
              >
                {r}
              </button>
            ))}
          </div>
          <div className="flex-1">
            {/* R only applies to wins — losses are fixed at -1R and BE at 0R
                in the stats, so the input is disabled there instead of
                silently storing a number that's never used. */}
            <input
              type="number"
              step="0.1"
              placeholder={entry.result === 'L' ? '-1R fixed' : entry.result === 'BE' ? '0R fixed' : 'R'}
              disabled={entry.result === 'L' || entry.result === 'BE'}
              title={entry.result === 'L' ? 'Losses always count as -1R' : entry.result === 'BE' ? 'Break-evens always count as 0R' : 'Realized R multiple'}
              value={entry.result === 'L' || entry.result === 'BE' ? '' : (entry.r || '')}
              onChange={e => onChange({ ...entry, r: parseFloat(e.target.value) || 0 })}
              className="w-full px-2 py-1.5 rounded-lg text-sm font-mono outline-none disabled:opacity-40"
              style={{ background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)' }}
            />
          </div>
          <div className="flex-1">
            <input
              type="number"
              step="1"
              placeholder="$ P&L"
              value={entry.pnl || ''}
              onChange={e => onChange({ ...entry, pnl: parseFloat(e.target.value) || 0 })}
              className="w-full px-2 py-1.5 rounded-lg text-sm font-mono outline-none"
              style={{ background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)' }}
            />
          </div>
        </motion.div>
      )}
      {entry.triggered && (
        <div className="mt-2">
          <button
            onClick={() => {
              // Shared-stop convenience: with one stop for all entries
              // (building-position style), typing it once is enough — the
              // other entries inherit it when their details open.
              if (!showDetails && entry.stopPrice == null && sharedStop != null) {
                onChange({ ...entry, stopPrice: sharedStop })
              }
              setShowDetails(v => !v)
            }}
            className="text-[11px] border-0 bg-transparent cursor-pointer p-0"
            style={{ color: 'var(--text-muted)' }}
          >
            {showDetails ? '− hide details' : '+ contracts & prices (auto-R)'}
          </button>
          {showDetails && (
            <div className="mt-2">
              <div className="flex gap-2">
                {detailField('qty', 'Contracts', '1')}
                {detailField('entryPrice', 'Entry price', '0.25')}
                {detailField('stopPrice', 'Stop price', '0.25')}
              </div>
              {risk && (
                <div className="flex items-center gap-2 mt-2 text-[11px]" style={{ color: 'var(--text-dim)' }}>
                  <span>Risk: <span className="font-mono font-semibold">${risk.riskDollars.toFixed(0)}</span></span>
                  {entry.result === 'W' && (
                    <>
                      <span>→ realized <span className="font-mono font-semibold">{risk.suggestedR}R</span></span>
                      {entry.r !== risk.suggestedR && (
                        <button
                          onClick={() => onChange({ ...entry, r: risk.suggestedR })}
                          className="px-2 py-0.5 rounded-md text-[11px] font-semibold border-0 cursor-pointer"
                          style={{ background: 'var(--blue-dim)', color: 'var(--accent)' }}
                        >
                          use as R
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════
// SCREENSHOT PASTE ZONE
// ═══════════════════════════════════════════════════

function ScreenshotZone({ screenshot, onChange }) {
  const dropRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)

  const processFile = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (e) => onChange(e.target.result)
    reader.readAsDataURL(file)
  }, [onChange])

  // (Cmd+V paste is handled at the modal level so it works from any tab.)

  return (
    <div>
      <SectionLabel>Chart Screenshot</SectionLabel>
      <div
        ref={dropRef}
        className="rounded-xl transition-all cursor-pointer relative overflow-hidden"
        style={{
          background: dragOver ? 'rgba(10,132,255,0.1)' : 'var(--surface)',
          border: `2px dashed ${dragOver ? 'var(--accent)' : screenshot ? 'transparent' : 'var(--border)'}`,
          minHeight: screenshot ? 'auto' : 80,
        }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          const file = e.dataTransfer.files?.[0]
          processFile(file)
        }}
      >
        {screenshot ? (
          <div className="relative group">
            <img
              src={screenshot}
              alt="Chart"
              className="w-full rounded-xl object-contain"
              style={{ maxHeight: 200, border: '1px solid var(--border)' }}
            />
            <div className="absolute inset-0 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl"
              style={{ background: 'rgba(0,0,0,0.5)' }}>
              <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                style={{ background: 'var(--accent)', color: '#fff' }}>
                <Camera size={14} />
                Replace
                <input type="file" accept="image/*" onChange={(e) => processFile(e.target.files?.[0])} className="hidden" />
              </label>
              <button
                onClick={() => onChange(null)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border-0"
                style={{ background: 'var(--red)', color: '#fff' }}
              >
                <Trash2 size={14} />
                Remove
              </button>
            </div>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center py-6 cursor-pointer">
            <div className="flex items-center gap-2 mb-1.5" style={{ color: 'var(--text-dim)' }}>
              <Clipboard size={16} />
              <span className="text-sm font-medium">Paste (Cmd+V) or click to upload</span>
            </div>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Screenshot your TradingView chart and paste directly
            </span>
            <input type="file" accept="image/*" onChange={(e) => processFile(e.target.files?.[0])} className="hidden" />
          </label>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════
// TAG SECTION
// ═══════════════════════════════════════════════════

function TagSection({ label, options, selected, onToggle, color, customTags, onAddCustom }) {
  const [customInput, setCustomInput] = useState('')

  const handleAdd = () => {
    const tag = customInput.trim()
    if (tag && !selected.includes(tag)) {
      onToggle(tag)
      if (onAddCustom && !options.includes(tag)) {
        onAddCustom(tag)
      }
    }
    setCustomInput('')
  }

  return (
    <div className="mb-3">
      <SectionLabel>{label}</SectionLabel>
      <div className="flex gap-1.5 flex-wrap mb-1.5">
        {[...options, ...(customTags || []).filter(t => !options.includes(t))].map(tag => (
          <MultiChip
            key={tag}
            label={tag}
            selected={selected.includes(tag)}
            onClick={() => onToggle(tag)}
            color={selected.includes(tag) ? color : undefined}
          />
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={customInput}
          onChange={e => setCustomInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="+ Custom tag"
          className="flex-1 px-2.5 py-1 rounded-lg text-xs outline-none"
          style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }}
        />
        {customInput && (
          <button
            onClick={handleAdd}
            className="px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer border-0"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            Add
          </button>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════
// MAIN TRADE MODAL
// ═══════════════════════════════════════════════════

export default function TradeModal({ trade, onSave, onClose, customTags = {}, onAddCustomTag }) {
  // Lazy initializer, built immutably: the old version mutated the parent's
  // trade object during render (backfilling tags/notes in place, even on
  // cancel) and called createTrade() — new UUID and all — every render.
  const [form, setForm] = useState(() => {
    const base = trade ? { ...trade } : createTrade()
    return {
      ...base,
      notes: base.notes || '',
      // Ensure tag structure exists for older trades (riskSinkStyles added in v2)
      tags: {
        mistakes: [],
        conditions: [],
        confirmations: [],
        ...(base.tags || {}),
        riskSinkStyles: base.tags?.riskSinkStyles || [],
      },
    }
  })
  // New trades open straight on Entries — the outcome is what gets logged
  // after a session; Trade Info is pre-filled from the last trade anyway.
  const [activeSection, setActiveSection] = useState(trade ? 'info' : 'entries') // 'info' | 'entries' | 'journal' | 'tags'

  // Dirty-close guard: a stray backdrop click or Escape used to silently
  // throw away a fully-entered trade.
  const formRef = useRef(form)
  useEffect(() => { formRef.current = form }, [form])
  const initialJsonRef = useRef(null)
  if (initialJsonRef.current === null) initialJsonRef.current = JSON.stringify(form)
  const requestClose = () => {
    const dirty = JSON.stringify(formRef.current) !== initialJsonRef.current
    if (dirty && !confirm('Discard this trade? Your changes will be lost.')) return
    onClose()
  }

  // Keyboard: Escape closes (guarded), Cmd/Ctrl+Enter saves
  const saveRef = useRef(null)
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') requestClose()
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') saveRef.current?.()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Screenshot paste works from ANY tab of the modal (the drop zone itself
  // only mounts on Trade Info)
  useEffect(() => {
    const handlePaste = (e) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault()
          const reader = new FileReader()
          reader.onload = (ev) => setForm(f => ({ ...f, screenshot: ev.target.result }))
          reader.readAsDataURL(item.getAsFile())
          return
        }
      }
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [])

  const update = (key, val) => setForm(f => ({ ...f, [key]: val }))
  const updateEntry = (idx, entry) => {
    setForm(f => ({ ...f, entries: f.entries.map((e, i) => i === idx ? entry : e) }))
  }
  const toggleTag = (category, tag) => {
    setForm(f => ({
      ...f,
      tags: {
        ...f.tags,
        [category]: f.tags[category]?.includes(tag)
          ? f.tags[category].filter(t => t !== tag)
          : [...(f.tags[category] || []), tag],
      }
    }))
  }

  const handleSave = () => {
    if (!form.date) {
      alert('Pick a date before saving.')
      return
    }
    // Data-quality guard: these mistakes used to save silently and quietly
    // corrupt the stats (a W with no R counts as a 0R win; a triggered entry
    // with no result is invisible to every calculation).
    const issues = []
    for (const e of form.entries || []) {
      if (e.triggered && !e.result) {
        issues.push(`${ENTRY_LABELS[e.slot]} is triggered but has no W/L/BE result — it won't count in any stats yet.`)
      }
      if (e.triggered && e.result === 'W' && !(e.r > 0)) {
        issues.push(`${ENTRY_LABELS[e.slot]} is a WIN with no R value — it would count as a 0R win and drag your stats down.`)
      }
    }
    if (issues.length > 0 && !confirm(`Heads up:\n\n• ${issues.join('\n• ')}\n\nSave anyway?`)) return
    rememberTradeDefaults(form)
    onSave(form)
  }
  saveRef.current = handleSave

  const sections = [
    { id: 'info', label: 'Trade Info' },
    { id: 'entries', label: 'Entries' },
    { id: 'journal', label: 'Journal' },
    { id: 'tags', label: 'Tags' },
  ]

  // Count filled tags for badge (across all categories)
  const tagCount = TAG_CATEGORIES.reduce((sum, c) => sum + (form.tags?.[c.key]?.length || 0), 0)

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      // pointerEvents is set via style, never animated: framer-motion can't
      // resolve an animation on it, so AnimatePresence never completed the
      // exit and the modal NEVER UNMOUNTED. Closed modals piled up invisibly,
      // each still holding its Escape / Cmd+Enter / paste listeners — so a
      // later keystroke could re-save a stale trade over a newer one.
      style={{ pointerEvents: 'auto' }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={requestClose} />
      <motion.div
        className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-5 pb-0">
          <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>{trade ? 'Edit Trade' : 'New Trade'}</h2>
          <button onClick={requestClose} className="p-1.5 rounded-lg cursor-pointer border-0" style={{ background: 'var(--surface)', color: 'var(--text-dim)' }}>
            <X size={18} />
          </button>
        </div>

        {/* Section Tabs */}
        <div className="flex gap-1 px-5 pt-3 pb-0" style={{ borderBottom: '1px solid var(--border)' }}>
          {sections.map(sec => (
            <button
              key={sec.id}
              onClick={() => setActiveSection(sec.id)}
              className="px-3 py-2.5 text-xs font-semibold cursor-pointer border-0 relative transition-colors"
              style={{
                color: activeSection === sec.id ? 'var(--accent)' : 'var(--text-muted)',
                background: 'transparent',
              }}
            >
              {sec.label}
              {sec.id === 'tags' && tagCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ background: 'var(--accent)', color: '#fff' }}>
                  {tagCount}
                </span>
              )}
              {activeSection === sec.id && (
                <motion.div
                  className="absolute bottom-0 left-0 right-0 h-0.5"
                  style={{ background: 'var(--accent)' }}
                  layoutId="modalTab"
                />
              )}
            </button>
          ))}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5">
          <AnimatePresence mode="wait">
            {/* ── TRADE INFO ── */}
            {activeSection === 'info' && (
              <motion.div key="info" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.15 }}>
                {/* Date */}
                <div className="mb-4">
                  <SectionLabel>Date</SectionLabel>
                  <input
                    type="date"
                    value={form.date}
                    onChange={e => update('date', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                    style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }}
                  />
                </div>

                {/* Instrument */}
                <div className="mb-4">
                  <SectionLabel>Instrument</SectionLabel>
                  <div className="flex gap-2 flex-wrap">
                    {INSTRUMENTS.map(i => <Chip key={i} label={i} selected={form.instrument === i} onClick={() => update('instrument', i)} />)}
                  </div>
                </div>

                {/* Session */}
                <div className="mb-4">
                  <SectionLabel>Session</SectionLabel>
                  <div className="flex gap-2 flex-wrap">
                    {SESSIONS.map(s => <Chip key={s} label={s} selected={form.session === s} onClick={() => update('session', s)} />)}
                  </div>
                </div>

                {/* Setup */}
                <div className="mb-4">
                  <SectionLabel>Setup</SectionLabel>
                  <div className="flex gap-2 flex-wrap">
                    {SETUPS.map(s => <Chip key={s} label={s} selected={form.setup === s} onClick={() => update('setup', s)} />)}
                  </div>
                </div>

                {/* Direction */}
                <div className="mb-4">
                  <SectionLabel>Direction</SectionLabel>
                  <div className="flex gap-2">
                    {['long', 'short'].map(s => (
                      <Chip
                        key={s}
                        label={s === 'long' ? 'Long ▲' : 'Short ▼'}
                        selected={form.side === s}
                        onClick={() => update('side', form.side === s ? null : s)}
                        color={form.side === s ? (s === 'long' ? 'var(--green)' : 'var(--red)') : undefined}
                      />
                    ))}
                  </div>
                </div>

                {/* Emotion + Quality */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <SectionLabel>Emotion</SectionLabel>
                    <div className="flex gap-1.5 flex-wrap">
                      {EMOTIONS.map(e => <Chip key={e} label={e} selected={form.emotion === e} onClick={() => update('emotion', e)} />)}
                    </div>
                  </div>
                  <div>
                    <SectionLabel>Quality</SectionLabel>
                    <div className="flex gap-1.5 flex-wrap">
                      {QUALITIES.map(q => <Chip key={q} label={q} selected={form.quality === q} onClick={() => update('quality', q)} />)}
                    </div>
                  </div>
                </div>

                {/* Screenshot */}
                <ScreenshotZone
                  screenshot={form.screenshot}
                  onChange={(val) => update('screenshot', val)}
                />
              </motion.div>
            )}

            {/* ── ENTRIES ── */}
            {activeSection === 'entries' && (
              <motion.div key="entries" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.15 }}>
                <div className="mb-2">
                  <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                    Mark each entry as triggered and log its result. E1 targets 3R, E2 targets 4R, E3 targets 5R.
                  </p>
                </div>
                {form.entries.map((e, i) => (
                  <EntryRow
                    key={i}
                    slot={e.slot}
                    entry={e}
                    instrument={form.instrument}
                    sharedStop={form.entries.find(x => x.stopPrice != null)?.stopPrice ?? null}
                    onChange={(val) => updateEntry(i, val)}
                  />
                ))}
              </motion.div>
            )}

            {/* ── JOURNAL ── */}
            {activeSection === 'journal' && (
              <motion.div key="journal" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.15 }}>
                {/* Trade context banner */}
                {trade && (
                  <div className="flex items-center gap-3 mb-4 px-3 py-2.5 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <span className="text-xs font-bold font-mono" style={{ color: 'var(--text-dim)' }}>{form.date}</span>
                    <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{form.instrument}</span>
                    {form.setup && <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{form.setup}</span>}
                    {form.session && <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{form.session}</span>}
                    {(() => {
                      const entries = form.entries || [];
                      const triggered = entries.filter(e => e.triggered && e.result);
                      const wins = triggered.filter(e => e.result === 'W').length;
                      const losses = triggered.filter(e => e.result === 'L').length;
                      if (triggered.length === 0) return null;
                      return (
                        <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-md" style={{
                          background: wins > losses ? 'var(--green-dim)' : losses > wins ? 'var(--red-dim)' : 'var(--surface)',
                          color: wins > losses ? 'var(--green)' : losses > wins ? 'var(--red)' : 'var(--text-dim)',
                        }}>
                          {wins > losses ? 'WIN' : losses > wins ? 'LOSS' : 'BE'}
                        </span>
                      );
                    })()}
                  </div>
                )}

                {/* Thesis */}
                <div className="mb-4">
                  <SectionLabel>Trade Thesis</SectionLabel>
                  <textarea
                    value={form.thesis || ''}
                    onChange={e => update('thesis', e.target.value)}
                    placeholder="Why did you take this trade? What was your bias and reasoning?"
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-vertical"
                    style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', minHeight: '72px' }}
                  />
                </div>

                {/* Post-trade Notes */}
                <div className="mb-4">
                  <SectionLabel>Post-Trade Notes</SectionLabel>
                  <textarea
                    value={form.notes || ''}
                    onChange={e => update('notes', e.target.value)}
                    placeholder="What happened during the trade? What went right or wrong? How did you manage it?"
                    rows={5}
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-vertical"
                    style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', minHeight: '100px' }}
                  />
                </div>

                {/* Lesson */}
                <div className="mb-4">
                  <SectionLabel>Key Lesson</SectionLabel>
                  <textarea
                    value={form.lesson || ''}
                    onChange={e => update('lesson', e.target.value)}
                    placeholder="What's the one takeaway from this trade?"
                    rows={2}
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-vertical"
                    style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', minHeight: '48px' }}
                  />
                </div>

                {/* Journal quality hint */}
                {trade && !form.thesis && !form.notes && !form.lesson && (
                  <div className="text-center py-3 rounded-xl" style={{ background: 'var(--surface)', border: '1px dashed var(--border)' }}>
                    <p className="text-xs font-medium" style={{ color: 'var(--text-dim)', opacity: 0.6 }}>
                      Journaling improves your Risk Sink Score. Write your thesis before and review after each trade.
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── TAGS ── */}
            {activeSection === 'tags' && (
              <motion.div key="tags" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.15 }}>
                <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                  Tag your trades for powerful filtering and pattern recognition. Select multiple per category.
                </p>

                {TAG_CATEGORIES.map(cat => (
                  <TagSection
                    key={cat.key}
                    label={cat.label}
                    options={cat.options}
                    customTags={customTags?.[cat.key] || []}
                    onAddCustom={onAddCustomTag ? (tag) => onAddCustomTag(cat.key, tag) : undefined}
                    selected={form.tags?.[cat.key] || []}
                    onToggle={(tag) => toggleTag(cat.key, tag)}
                    color={cat.color}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer — Save Button */}
        <div className="p-5 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={handleSave}
            className="w-full py-3 rounded-xl text-white keep-white font-semibold text-sm cursor-pointer border-0 transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, var(--blue), var(--purple))' }}
          >
            {trade ? 'Update Trade' : 'Log Trade'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
