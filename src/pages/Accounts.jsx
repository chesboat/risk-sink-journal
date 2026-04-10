import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, AlertCircle, CheckCircle, TrendingUp, Shield } from 'lucide-react';
import { getAccountStats, HEALTH_STATUSES, ENTRY_LABELS, ENTRY_COLORS } from '../lib/store';

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

          {/* MLL Remaining */}
          <div className="mb-4">
            <ProgressBar
              percentage={stats.mllPercent || 0}
              label={`$${(stats.mllLeft || 0).toFixed(0)} remaining`}
              color={(stats.mllPercent || 0) > 50 ? '#22c55e' : (stats.mllPercent || 0) > 25 ? '#f97316' : '#ef4444'}
            />
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

const Accounts = ({ state, updateAccounts, updateSettings }) => {
  const handleAccountUpdate = (updatedAccount) => {
    const updatedAccounts = state.accounts.map((acc) =>
      acc.id === updatedAccount.id ? updatedAccount : acc
    );
    updateAccounts(updatedAccounts);
  };

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: 'var(--background)' }}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-bold text-white">Account Rotation</h1>
        <p className="text-gray-400 mt-2">Manage and rotate your trading accounts across slots</p>
      </motion.div>

      {/* Account Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {state.accounts.map((account) => (
          <AccountCard
            key={account.id}
            account={account}
            trades={state.trades}
            onUpdate={handleAccountUpdate}
            settings={state.settings}
          />
        ))}
      </div>

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

      {/* Account History */}
      <AccountHistory accounts={state.accounts} />
    </div>
  );
};

export default Accounts;
