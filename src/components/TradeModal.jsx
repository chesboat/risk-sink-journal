import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, Camera } from 'lucide-react'
import { createTrade, INSTRUMENTS, SESSIONS, SETUPS, EMOTIONS, QUALITIES, ENTRY_LABELS } from '../lib/store'

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

export default function TradeModal({ trade, onSave, onClose }) {
  const [form, setForm] = useState(trade || createTrade())

  const update = (key, val) => setForm(f => ({ ...f, [key]: val }))
  const updateEntry = (idx, entry) => {
    setForm(f => ({ ...f, entries: f.entries.map((e, i) => i === idx ? entry : e) }))
  }

  const handleScreenshot = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => update('screenshot', ev.target.result)
    reader.readAsDataURL(file)
  }

  const handleSave = () => {
    if (!form.date) return
    onSave(form)
  }

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-6"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold">{trade ? 'Edit Trade' : 'New Trade'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg cursor-pointer border-0" style={{ background: 'var(--surface)', color: 'var(--text-dim)' }}>
            <X size={18} />
          </button>
        </div>

        {/* Date */}
        <div className="mb-4">
          <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-dim)' }}>Date</label>
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
          <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-dim)' }}>Instrument</label>
          <div className="flex gap-2 flex-wrap">
            {INSTRUMENTS.map(i => <Chip key={i} label={i} selected={form.instrument === i} onClick={() => update('instrument', i)} />)}
          </div>
        </div>

        {/* Session */}
        <div className="mb-4">
          <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-dim)' }}>Session</label>
          <div className="flex gap-2 flex-wrap">
            {SESSIONS.map(s => <Chip key={s} label={s} selected={form.session === s} onClick={() => update('session', s)} />)}
          </div>
        </div>

        {/* Setup */}
        <div className="mb-4">
          <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-dim)' }}>Setup</label>
          <div className="flex gap-2 flex-wrap">
            {SETUPS.map(s => <Chip key={s} label={s} selected={form.setup === s} onClick={() => update('setup', s)} />)}
          </div>
        </div>

        {/* Thesis */}
        <div className="mb-4">
          <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-dim)' }}>Thesis</label>
          <input
            type="text"
            value={form.thesis}
            onChange={e => update('thesis', e.target.value)}
            placeholder="Why did you take this trade?"
            className="w-full px-3 py-2 rounded-xl text-sm outline-none"
            style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }}
          />
        </div>

        {/* Entries */}
        <div className="mb-4">
          <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-dim)' }}>Entries</label>
          {form.entries.map((e, i) => (
            <EntryRow key={i} slot={e.slot} entry={e} onChange={(val) => updateEntry(i, val)} />
          ))}
        </div>

        {/* Emotion + Quality */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-dim)' }}>Emotion</label>
            <div className="flex gap-1.5 flex-wrap">
              {EMOTIONS.map(e => <Chip key={e} label={e} selected={form.emotion === e} onClick={() => update('emotion', e)} />)}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-dim)' }}>Quality</label>
            <div className="flex gap-1.5 flex-wrap">
              {QUALITIES.map(q => <Chip key={q} label={q} selected={form.quality === q} onClick={() => update('quality', q)} />)}
            </div>
          </div>
        </div>

        {/* Lesson */}
        <div className="mb-4">
          <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-dim)' }}>Lesson</label>
          <textarea
            value={form.lesson}
            onChange={e => update('lesson', e.target.value)}
            placeholder="What did you learn?"
            rows={2}
            className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
            style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }}
          />
        </div>

        {/* Screenshot */}
        <div className="mb-5">
          <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-dim)' }}>Chart Screenshot</label>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm cursor-pointer"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}>
              <Camera size={16} />
              {form.screenshot ? 'Change' : 'Upload'}
              <input type="file" accept="image/*" onChange={handleScreenshot} className="hidden" />
            </label>
            {form.screenshot && (
              <img src={form.screenshot} alt="Chart" className="h-10 rounded-lg object-cover" style={{ border: '1px solid var(--border)' }} />
            )}
          </div>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          className="w-full py-3 rounded-xl text-white font-semibold text-sm cursor-pointer border-0 transition-all hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, var(--blue), var(--purple))' }}
        >
          {trade ? 'Update Trade' : 'Log Trade'}
        </button>
      </motion.div>
    </motion.div>
  )
}
