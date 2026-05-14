import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, AlertCircle, CheckCircle, TrendingUp, Shield, Bot, Plus, Repeat, History, X, ChevronDown, ChevronUp } from 'lucide-react';
import {
  getAccountStats,
  HEALTH_STATUSES,
  ENTRY_LABELS,
  ENTRY_COLORS,
  getManualAccounts,
  getBotAccounts,
  createBotAccount,
  getBotAccountStats,
  getActiveAssignment,
  getAssignmentHistory,
  getAllStrategyNames,
  BROKERS,
  BROKER_LABEL,
} from '../lib/store';

const SLOT_COLORS = {
  E1: '#22c55e', // green
  E2: '#f97316', // orange
  E3: '#14b8a6', // teal
};

const HEALTH_COLOR_MAP = {
  Eval: '#3b82f6',
  Funded: '#22c55e',
  'Near Payout': '#22c55e',
  Damaged: '#f97316',
  Critical: '#ef4444',
  Passed: '#a855f7',
};

const AccountAccentBar = ({ slot }) => (
  <div
    className="absolute left-0 top-4 bottom-4 w-1 rounded-r"
    style={{ backgroundColor: SLOT_COLORS[slot] || '#9ca3af' }}
  />
);

const ProgressRing = ({ percentage, size = 52, strokeWidth = 3 }) => {
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (percentage / 100) * circumference;

  return (
    <svg width={size} height={size} viewBox="0 0 52 52" className="transform -rotate-90">
      <circle
        cx="26"
        cy="26"
        r={radius}
        fill="none"
        stroke="var(--surface)"
        strokeWidth={strokeWidth}
      />
      <motion.circle
        cx="26"
        cy="26"
        r={radius}
        fill="none"
        stroke="#22c55e"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: dashOffset }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        strokeLinecap="round"
      />
    </svg>
  );
};

const ProgressBar = ({ percentage, label, color = '#22c55e' }) => (
  <div className="flex items-center gap-3">
    <div className="flex-1">
      <div className="h-1.5 rounded-full" style={{ backgroundColor: 'var(--surface)' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </div>
    <span className="text-sm text-gray-400 whitespace-nowrap">{label}</span>
  </div>
);

const SlotSelector = ({ value, onChange, label }) => {
  const slots = ['E1', 'E2', 'E3'];

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-400">{label}</label>
      <div className="flex gap-2">
        {slots.map((slot) => (
          <motion.button
            key={slot}
            onClick={() => onChange(slot)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              value === slot
                ? 'text-white keep-white'
                : 'bg-transparent text-gray-400 hover:text-gray-200'
            }`}
            style={{
              backgroundColor: value === slot ? SLOT_COLORS[slot] : 'transparent',
              border: `1px solid ${value === slot ? SLOT_COLORS[slot] : 'var(--border)'}`,
            }}
          >
            {slot}
          </motion.button>
        ))}
      </div>
    </div>
  );
};

const HealthChip = ({ status, onStatusChange }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.05 }}
        className="px-3 py-1.5 rounded-lg text-sm font-medium text-white keep-white transition-all"
        style={{ backgroundColor: HEALTH_COLOR_MAP[status] || '#9ca3af' }}
      >
        {status}
      </motion.button>

      {isOpen && (
        <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
      )}
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="absolute top-full mt-2 left-0 rounded-lg shadow-lg z-20"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          {HEALTH_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => {
                onStatusChange(s);
                setIsOpen(false);
              }}
              className="w-full px-4 py-2 text-left text-sm first:rounded-t-lg last:rounded-b-lg transition-colors cursor-pointer border-0"
              style={{
                background: status === s ? HEALTH_COLOR_MAP[s] : 'transparent',
                color: 'var(--text)',
              }}
            >
              {s}
            </button>
          ))}
        </motion.div>
      )}
    </div>
  );
};

const EditableField = ({ value, onChange, label, type = 'text', prefix = '' }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);

  const handleSave = () => {
    onChange(localValue);
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setLocalValue(value);
    }
  };

  if (isEditing) {
    return (
      <input
        type={type}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        autoFocus
        className="px-3 py-2 rounded-xl border text-sm w-full"
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--border)',
          color: 'white',
        }}
      />
    );
  }

  return (
    <motion.button
      onClick={() => {
        setLocalValue(value);
        setIsEditing(true);
      }}
      whileHover={{ opacity: 0.8 }}
      className="text-left px-3 py-2 rounded-xl hover:bg-gray-800 transition-colors text-sm"
    >
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-white font-medium">
        {prefix}
        {value}
      </div>
    </motion.button>
  );
};

const AccountCard = ({ account, onUpdate, settings, trades }) => {
  const stats = getAccountStats(account, trades || [], settings);

  const handleSlotChange = (newSlot) => {
    const oldSlot = account.slot;
    const updatedAccount = {
      ...account,
      slot: newSlot,
      history: [
        ...(account.history || []),
        {
          date: new Date().toISOString(),
          from: oldSlot,
          to: newSlot,
        },
      ],
    };
    onUpdate(updatedAccount);
  };

  const handleNameChange = (newName) => {
    onUpdate({ ...account, name: newName });
  };

  const handleHealthChange = (newStatus) => {
    onUpdate({ ...account, health: newStatus });
  };

  const handleStartingPLChange = (newValue) => {
    const numValue = parseFloat(newValue) || 0;
    onUpdate({ ...account, startingPnl: numValue });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative rounded-xl border p-6 overflow-hidden"
      style={{
        backgroundColor: 'var(--card)',
        borderColor: 'var(--border)',
      }}
    >
      <AccountAccentBar slot={account.slot} />

      <div className="space-y-4">
        {/* Account Name */}
        <EditableField
          value={account.name}
          onChange={handleNameChange}
          label="Account Name"
        />

        {/* Slot Selector */}
        <SlotSelector
          value={account.slot}
          onChange={handleSlotChange}
          label="Slot Assignment"
        />

        {/* Health Status */}
        <div>
          <label className="text-xs font-medium text-gray-400 block mb-2">
            Health Status
          </label>
          <HealthChip
            status={account.health}
            onStatusChange={handleHealthChange}
          />
        </div>

        {/* Starting P&L */}
        <EditableField
          value={account.startingPnl}
          onChange={handleStartingPLChange}
          label="Starting P&L"
          type="number"
          prefix="$"
        />

        <div className="border-t border-gray-700 pt-4">
          {/* Total P&L */}
          <div className="mb-4">
            <div className="text-xs text-gray-400 mb-1">Total P&L</div>
            <div className="text-2xl font-bold" style={{ color: (stats.totalPnl || 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
              ${(stats.totalPnl || 0).toFixed(2)}
            </div>
          </div>

          {/* PT Progress */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center justify-center relative" style={{ width: 52, height: 52 }}>
              <ProgressRing percentage={stats.ptPercent || 0} />
              <div className="absolute text-xs font-semibold text-white">
                {Math.round(stats.ptPercent || 0)}%
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-400">PT Progress</div>
              <div className="text-sm text-white">
                ${(stats.ptProgress || 0).toFixed(0)} / ${(settings?.profitTarget || 3000).toFixed(0)}
              </div>
            </div>
          </div>

          {/* Trailing MLL */}
          <div className="mb-4">
            <ProgressBar
              percentage={stats.mllPercent || 0}
              label={`$${(stats.mllLeft || 0).toFixed(0)} to bust`}
              color={(stats.mllPercent || 0) > 50 ? '#22c55e' : (stats.mllPercent || 0) > 25 ? '#f97316' : '#ef4444'}
            />
            <div className="flex items-center justify-between text-[11px] text-gray-500 mt-1.5 font-mono">
              <span>Peak: ${Math.round(stats.mllPeak || 0).toLocaleString()}</span>
              <span>Floor: ${Math.round(stats.mllFloor || 0).toLocaleString()}</span>
              {stats.mllBusted && <span className="text-red-500 font-semibold">BUSTED</span>}
            </div>
          </div>

          {/* Slot Win Rate */}
          <div>
            <div className="text-xs text-gray-400 mb-2">Slot Win Rate</div>
            <div className="text-lg font-semibold text-white">
              {((stats.slotWR || 0) * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// ═══════════════════════════════════════════════════
// BOT ACCOUNTS
// ═══════════════════════════════════════════════════

const BOT_ACCENT = '#a855f7'; // purple — visually distinct from manual slot colors

const SwitchStrategyModal = ({ account, activeAssignment, suggestions, onSave, onClose }) => {
  // Default the switchover time to "right now" in local-input format
  const nowLocal = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };
  const [name, setName] = useState('');
  const [when, setWhen] = useState(nowLocal());
  const [note, setNote] = useState('');

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      strategyName: name.trim(),
      switchAt: new Date(when).toISOString(),
      note: note.trim(),
    });
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 12 }}
        className="w-full max-w-md rounded-2xl border p-6"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Repeat size={18} style={{ color: BOT_ACCENT }} />
            Switch Strategy
          </h3>
          <button onClick={onClose} className="p-1 border-0 bg-transparent cursor-pointer" style={{ color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        <div className="text-xs text-gray-400 mb-4">
          {account.name}
          {activeAssignment && (
            <> · currently: <span className="text-white">{activeAssignment.strategyName}</span></>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">New strategy name</label>
            <input
              type="text"
              list="strategy-suggestions"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. MNQ-CISD-Bot"
              autoFocus
              className="w-full px-3 py-2 rounded-xl border text-white"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            />
            <datalist id="strategy-suggestions">
              {suggestions.map(s => <option key={s} value={s} />)}
            </datalist>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Switchover time</label>
            <input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border text-white"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            />
            <div className="text-[11px] text-gray-500 mt-1">
              Trades that fill after this time get attributed to the new strategy.
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Note (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="e.g. tightened stop to 1.2R"
              className="w-full px-3 py-2 rounded-xl border text-white text-sm"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            />
          </div>
        </div>

        <div className="flex gap-2 justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border text-sm cursor-pointer"
            style={{ background: 'transparent', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-4 py-2 rounded-xl text-sm font-medium text-white keep-white border-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: BOT_ACCENT }}
          >
            Switch
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

const AddBotAccountModal = ({ onSave, onClose }) => {
  const [name, setName] = useState('');
  const [broker, setBroker] = useState('tradovate');
  const [propFirm, setPropFirm] = useState('');
  const [externalAccountId, setExternalAccountId] = useState('');
  const [startingPnl, setStartingPnl] = useState('0');

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      broker,
      propFirm: propFirm.trim(),
      externalAccountId: externalAccountId.trim(),
      startingPnl: parseFloat(startingPnl) || 0,
    });
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 12 }}
        className="w-full max-w-md rounded-2xl border p-6"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Bot size={18} style={{ color: BOT_ACCENT }} />
            Add Bot Account
          </h3>
          <button onClick={onClose} className="p-1 border-0 bg-transparent cursor-pointer" style={{ color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Account name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Lucid Bot 1"
              autoFocus
              className="w-full px-3 py-2 rounded-xl border text-white"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Broker platform</label>
              <select
                value={broker}
                onChange={(e) => setBroker(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border text-white"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
              >
                {BROKERS.map(b => <option key={b} value={b}>{BROKER_LABEL[b]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Prop firm</label>
              <input
                type="text"
                value={propFirm}
                onChange={(e) => setPropFirm(e.target.value)}
                placeholder="Lucid, Tradeify, Topstep"
                className="w-full px-3 py-2 rounded-xl border text-white"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Broker account ID</label>
            <input
              type="text"
              value={externalAccountId}
              onChange={(e) => setExternalAccountId(e.target.value)}
              placeholder="Used by ingestion to match fills"
              className="w-full px-3 py-2 rounded-xl border text-white"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            />
            <div className="text-[11px] text-gray-500 mt-1">
              Optional now; required before automatic ingestion can pull fills for this account.
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Starting P&L</label>
            <div className="flex items-center">
              <span className="text-gray-400 mr-2">$</span>
              <input
                type="number"
                value={startingPnl}
                onChange={(e) => setStartingPnl(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border text-white"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border text-sm cursor-pointer"
            style={{ background: 'transparent', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-4 py-2 rounded-xl text-sm font-medium text-white keep-white border-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: BOT_ACCENT }}
          >
            Add
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

const BotAccountCard = ({ account, botTrades, assignments, settings, onSwitch, onUpdate, onDelete, suggestions }) => {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const stats = getBotAccountStats(account, botTrades, settings);
  const active = getActiveAssignment(assignments, account.id);
  const history = getAssignmentHistory(assignments, account.id);

  const handleHealthChange = (newStatus) => onUpdate({ ...account, health: newStatus });
  const handleNameChange = (newName) => onUpdate({ ...account, name: newName });

  const fmtDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      className="relative rounded-xl border p-6 overflow-hidden"
      style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
    >
      <div className="absolute left-0 top-4 bottom-4 w-1 rounded-r" style={{ backgroundColor: BOT_ACCENT }} />

      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <EditableField value={account.name} onChange={handleNameChange} label="Account Name" />
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wide" style={{ background: BOT_ACCENT, color: 'white' }}>
            <Bot size={11} /> Bot
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <div className="text-gray-400">Broker</div>
            <div className="text-white font-medium">{BROKER_LABEL[account.broker] || account.broker || '—'}</div>
          </div>
          <div>
            <div className="text-gray-400">Prop firm</div>
            <div className="text-white font-medium">{account.propFirm || '—'}</div>
          </div>
        </div>

        {/* Current strategy + Switch button */}
        <div className="rounded-lg p-3" style={{ background: 'var(--surface)' }}>
          <div className="flex items-center justify-between mb-1">
            <div className="text-[11px] uppercase tracking-wide text-gray-400">Current strategy</div>
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border-0 cursor-pointer text-white keep-white"
              style={{ background: BOT_ACCENT }}
            >
              <Repeat size={11} />
              {active ? 'Switch' : 'Assign'}
            </button>
          </div>
          <div className="text-white font-medium text-sm">
            {active ? active.strategyName : <span className="text-gray-500 italic">No strategy assigned</span>}
          </div>
          {active && (
            <div className="text-[11px] text-gray-500 mt-0.5">since {fmtDate(active.startedAt)}</div>
          )}
        </div>

        <div>
          <label className="text-xs font-medium text-gray-400 block mb-2">Health Status</label>
          <HealthChip status={account.health} onStatusChange={handleHealthChange} />
        </div>

        <div className="border-t border-gray-700 pt-4">
          <div className="mb-4">
            <div className="text-xs text-gray-400 mb-1">Total P&L</div>
            <div className="text-2xl font-bold" style={{ color: stats.totalPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
              ${stats.totalPnl.toFixed(2)}
            </div>
            <div className="text-[11px] text-gray-500 mt-1">
              {stats.trades} trades · {stats.wins}W / {stats.losses}L · WR {(stats.winRate * 100).toFixed(0)}%
            </div>
          </div>

          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center justify-center relative" style={{ width: 52, height: 52 }}>
              <ProgressRing percentage={stats.ptPercent || 0} />
              <div className="absolute text-xs font-semibold text-white">{Math.round(stats.ptPercent || 0)}%</div>
            </div>
            <div>
              <div className="text-xs text-gray-400">PT Progress</div>
              <div className="text-sm text-white">
                ${stats.ptProgress.toFixed(0)} / ${(settings?.profitTarget || 3000).toFixed(0)}
              </div>
            </div>
          </div>

          <div className="mb-4">
            <ProgressBar
              percentage={stats.mllPercent || 0}
              label={`$${(stats.mllLeft || 0).toFixed(0)} to bust`}
              color={stats.mllPercent > 50 ? '#22c55e' : stats.mllPercent > 25 ? '#f97316' : '#ef4444'}
            />
            <div className="flex items-center justify-between text-[11px] text-gray-500 mt-1.5 font-mono">
              <span>Peak: ${Math.round(stats.mllPeak).toLocaleString()}</span>
              <span>Floor: ${Math.round(stats.mllFloor).toLocaleString()}</span>
              {stats.mllBusted && <span className="text-red-500 font-semibold">BUSTED</span>}
            </div>
          </div>
        </div>

        {/* Strategy history expand */}
        {history.length > 0 && (
          <div className="border-t border-gray-700 pt-3">
            <button
              onClick={() => setHistoryOpen(o => !o)}
              className="flex items-center gap-2 text-xs text-gray-400 hover:text-white border-0 bg-transparent cursor-pointer p-0"
            >
              <History size={12} />
              Strategy history ({history.length})
              {historyOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            <AnimatePresence>
              {historyOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-1.5 mt-2">
                    {history.map(h => (
                      <div key={h.id} className="text-[11px] text-gray-300 p-2 rounded" style={{ background: 'var(--surface)' }}>
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-white">{h.strategyName}</span>
                          {!h.endedAt && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded uppercase font-semibold" style={{ background: BOT_ACCENT, color: 'white' }}>
                              active
                            </span>
                          )}
                        </div>
                        <div className="text-gray-500 mt-0.5">
                          {fmtDate(h.startedAt)} → {h.endedAt ? fmtDate(h.endedAt) : 'now'}
                        </div>
                        {h.note && <div className="text-gray-400 italic mt-1">"{h.note}"</div>}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <button
          onClick={() => { if (confirm(`Delete bot account "${account.name}"? Bot trades for this account remain in the database.`)) onDelete(account.id); }}
          className="text-[11px] text-gray-500 hover:text-red-400 border-0 bg-transparent cursor-pointer p-0"
        >
          Delete account
        </button>
      </div>

      <AnimatePresence>
        {modalOpen && (
          <SwitchStrategyModal
            account={account}
            activeAssignment={active}
            suggestions={suggestions}
            onSave={({ strategyName, switchAt, note }) => onSwitch({ accountId: account.id, strategyName, switchAt, note })}
            onClose={() => setModalOpen(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const BotAccountsSection = ({ botAccounts, botTrades, assignments, settings, onAdd, onUpdate, onDelete, onSwitch }) => {
  const [addOpen, setAddOpen] = useState(false);
  const suggestions = useMemo(() => getAllStrategyNames(assignments), [assignments]);

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <Bot size={20} style={{ color: BOT_ACCENT }} />
          Bot Accounts
          <span className="text-sm text-gray-400 font-normal">({botAccounts.length})</span>
        </h2>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white keep-white border-0 cursor-pointer"
          style={{ background: BOT_ACCENT }}
        >
          <Plus size={14} />
          Add Bot Account
        </button>
      </div>

      {botAccounts.length === 0 ? (
        <div
          className="rounded-xl border border-dashed p-8 text-center"
          style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
        >
          <Bot size={28} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
          <div className="text-sm text-gray-400">No bot accounts yet</div>
          <div className="text-xs text-gray-500 mt-1">Add one to start tracking automated trades.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {botAccounts.map(a => (
            <BotAccountCard
              key={a.id}
              account={a}
              botTrades={botTrades}
              assignments={assignments}
              settings={settings}
              onSwitch={onSwitch}
              onUpdate={onUpdate}
              onDelete={onDelete}
              suggestions={suggestions}
            />
          ))}
        </div>
      )}

      <AnimatePresence>
        {addOpen && (
          <AddBotAccountModal
            onSave={onAdd}
            onClose={() => setAddOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const SettingsSection = ({ settings, onSettingsChange }) => {
  const handleChange = (key, value) => {
    const numValue = parseFloat(value) || 0;
    onSettingsChange({
      ...settings,
      [key]: numValue,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="rounded-xl border p-6"
      style={{
        backgroundColor: 'var(--card)',
        borderColor: 'var(--border)',
      }}
    >
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Shield size={20} />
        Account Settings
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-400">Account Size</label>
          <div className="flex items-center">
            <span className="text-gray-400 mr-2">$</span>
            <input
              type="number"
              value={settings.accountSize || 50000}
              onChange={(e) => handleChange('accountSize', e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl border text-white"
              style={{
                backgroundColor: 'var(--surface)',
                borderColor: 'var(--border)',
              }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-400">Max Losing Limit (MLL)</label>
          <div className="flex items-center">
            <span className="text-gray-400 mr-2">$</span>
            <input
              type="number"
              value={settings.mll || 2000}
              onChange={(e) => handleChange('mll', e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl border text-white"
              style={{
                backgroundColor: 'var(--surface)',
                borderColor: 'var(--border)',
              }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-400">Profit Target</label>
          <div className="flex items-center">
            <span className="text-gray-400 mr-2">$</span>
            <input
              type="number"
              value={settings.profitTarget || 3000}
              onChange={(e) => handleChange('profitTarget', e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl border text-white"
              style={{
                backgroundColor: 'var(--surface)',
                borderColor: 'var(--border)',
              }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const RotationGuide = () => {
  const rules = [
    {
      condition: 'Damaged/Critical?',
      action: 'Move to E3 slot (lowest risk, highest target)',
      icon: AlertCircle,
    },
    {
      condition: 'Near Payout?',
      action: 'Move to E1 slot (highest win rate)',
      icon: TrendingUp,
    },
    {
      condition: 'Healthy?',
      action: 'Any slot works',
      icon: CheckCircle,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="rounded-xl border p-6"
      style={{
        backgroundColor: 'var(--card)',
        borderColor: 'var(--border)',
      }}
    >
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <RefreshCw size={20} />
        Rotation Guide
      </h3>

      <div className="space-y-3">
        {rules.map((rule, idx) => {
          const IconComponent = rule.icon;
          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.3 + idx * 0.1 }}
              className="flex gap-3 p-3 rounded-lg"
              style={{ backgroundColor: 'var(--surface)' }}
            >
              <IconComponent className="flex-shrink-0 mt-0.5 text-blue-400" size={18} />
              <div className="flex-1">
                <div className="text-sm font-medium text-white">{rule.condition}</div>
                <div className="text-xs text-gray-400 mt-1">{rule.action}</div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};

const AccountHistory = ({ accounts }) => {
  const allHistoryEntries = accounts
    .flatMap((account) =>
      (account.history || []).map((entry) => ({
        ...entry,
        accountName: account.name,
      }))
    )
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (allHistoryEntries.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="rounded-xl border p-6"
      style={{
        backgroundColor: 'var(--card)',
        borderColor: 'var(--border)',
      }}
    >
      <h3 className="text-lg font-semibold text-white mb-4">Account History</h3>

      <div className="space-y-3">
        {allHistoryEntries.map((entry, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.4 + idx * 0.05 }}
            className="flex items-center gap-4 p-3 rounded-lg"
            style={{ backgroundColor: 'var(--surface)' }}
          >
            <div className="flex-shrink-0 w-2 h-2 rounded-full" style={{ backgroundColor: SLOT_COLORS[entry.to] }} />
            <div className="flex-1">
              <div className="text-sm text-white">
                <span className="font-medium">{entry.accountName}</span>
                {' moved from '}
                <span
                  className="font-semibold"
                  style={{ color: SLOT_COLORS[entry.from] }}
                >
                  {entry.from}
                </span>
                {' to '}
                <span
                  className="font-semibold"
                  style={{ color: SLOT_COLORS[entry.to] }}
                >
                  {entry.to}
                </span>
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {new Date(entry.date).toLocaleString()}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

const Accounts = ({ state, updateAccounts, updateSettings, switchStrategy }) => {
  const manualAccounts = getManualAccounts(state.accounts);
  const botAccounts = getBotAccounts(state.accounts);

  const handleAccountUpdate = (updatedAccount) => {
    const updatedAccounts = state.accounts.map((acc) =>
      acc.id === updatedAccount.id ? updatedAccount : acc
    );
    updateAccounts(updatedAccounts);
  };

  const handleAddBotAccount = (input) => {
    const newAccount = createBotAccount(input);
    updateAccounts([...state.accounts, newAccount]);
  };

  const handleDeleteBotAccount = (id) => {
    updateAccounts(state.accounts.filter(a => a.id !== id));
  };

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: 'var(--background)' }}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-bold text-white">Accounts</h1>
        <p className="text-gray-400 mt-2">Manual risk-sink accounts and bot accounts</p>
      </motion.div>

      {/* Manual Account Cards Grid (E1/E2/E3) */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <RefreshCw size={20} />
          Risk-Sink Accounts
          <span className="text-sm text-gray-400 font-normal">({manualAccounts.length})</span>
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {manualAccounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              trades={state.trades}
              onUpdate={handleAccountUpdate}
              settings={state.settings}
            />
          ))}
        </div>
      </div>

      {/* Bot Accounts */}
      <BotAccountsSection
        botAccounts={botAccounts}
        botTrades={state.botTrades || []}
        assignments={state.strategyAssignments || []}
        settings={state.settings}
        onAdd={handleAddBotAccount}
        onUpdate={handleAccountUpdate}
        onDelete={handleDeleteBotAccount}
        onSwitch={switchStrategy}
      />

      {/* Settings Section */}
      <div className="mb-8">
        <SettingsSection
          settings={state.settings}
          onSettingsChange={updateSettings}
        />
      </div>

      {/* Rotation Guide */}
      <div className="mb-8">
        <RotationGuide />
      </div>

      {/* Account History (manual slot rotations) */}
      <AccountHistory accounts={manualAccounts} />
    </div>
  );
};

export default Accounts;
