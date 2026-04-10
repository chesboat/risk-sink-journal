import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Camera, Clipboard, Trash2 } from 'lucide-react'
import {
  createTrade,
  INSTRUMENTS,
  SESSIONS,
  SETUPS,
  EMOTIONS,
  QUALITIES,
  ENTRY_LABELS,
  MISTAKES,
  CONDITIONS,
  CONFIRMATIONS,
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
      className="px-2.5 py-1 rounded-lg text-[12px] font-medium transition-all duration-200 cursor-pointer border-0"
      style={{
        background: selected ? (color || 'rgba(10,132,255,0.15)') : 'var(--surface)',
        color: selected ? (color || 'var(--accent)') : 'var(--text-muted)',
        border: `1px solid ${selected ? (color || 'var(--accent)') : 'var(--border)'}`,
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

function EntryRow({ slot, entry, onChange }) {
  const colors = { 1: 'var(--green)', 2: 'var(--orange)', 3: 'var(--teal)' }
  const c = colors[slot]

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
            <input
              type="number"
              step="0.1"
              placeholder="R"
              value={entry.r || ''}
              onChange={e => onChange({ ...entry, r: parseFloat(e.target.value) || 0 })}
              className="w-full px-2 py-1.5 rounded-lg text-sm font-mono outline-none"
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

  // Cmd+V paste handler — attached to the whole modal
  useEffect(() => {
    const handlePaste = (e) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault()
          processFile(item.getAsFile())
          return
        }
      }
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [processFile])

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

export default function TradeModal({ trade, onSave, onClose }) {
  const initTrade = trade || createTrade()
  // Ensure tags structure exists for older trades
  if (!initTrade.tags) initTrade.tags = { mistakes: [], conditions: [], confirmations: [] }
  if (!initTrade.notes) initTrade.notes = ''

  const [form, setForm] = useState(initTrade)
  const [activeSection, setActiveSection] = useState('info') // 'info' | 'entries' | 'journal' | 'tags'

  // Close on Escape key
  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

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
    if (!form.date) return
    onSave(form)
  }

  const sections = [
    { id: 'info', label: 'Trade Info' },
    { id: 'entries', label: 'Entries' },
    { id: 'journal', label: 'Journal' },
    { id: 'tags', label: 'Tags' },
  ]

  // Count filled tags for badge
  const tagCount = (form.tags?.mistakes?.length || 0) + (form.tags?.conditions?.length || 0) + (form.tags?.confirmations?.length || 0)

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, pointerEvents: 'auto' }}
      exit={{ opacity: 0, pointerEvents: 'none' }}
      transition={{ duration: 0.15 }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
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
          <button onClick={onClose} className="p-1.5 rounded-lg cursor-pointer border-0" style={{ background: 'var(--surface)', color: 'var(--text-dim)' }}>
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
                  <EntryRow key={i} slot={e.slot} entry={e} onChange={(val) => updateEntry(i, val)} />
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

                <TagSection
                  label="Confirmations"
                  options={CONFIRMATIONS}
                  selected={form.tags?.confirmations || []}
                  onToggle={(tag) => toggleTag('confirmations', tag)}
                  color="var(--green)"
                />

                <TagSection
                  label="Market Conditions"
                  options={CONDITIONS}
                  selected={form.tags?.conditions || []}
                  onToggle={(tag) => toggleTag('conditions', tag)}
                  color="var(--blue)"
                />

                <TagSection
                  label="Mistakes"
                  options={MISTAKES}
                  selected={form.tags?.mistakes || []}
                  onToggle={(tag) => toggleTag('mistakes', tag)}
                  color="var(--red)"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer — Save Button */}
        <div className="p-5 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={handleSave}
            className="w-full py-3 rounded-xl text-white font-semibold text-sm cursor-pointer border-0 transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, var(--blue), var(--purple))' }}
          >
            {trade ? 'Update Trade' : 'Log Trade'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
