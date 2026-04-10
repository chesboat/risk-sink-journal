import { useState } from 'react'
import { motion } from 'framer-motion'
import { Edit2, Check, X } from 'lucide-react'
import { HEALTH_STATUSES, getAccountStats, formatCurrency } from '../lib/store'

function HealthPill({ status }) {
  const colors = {
    Eval: 'var(--blue)',
    Funded: 'var(--green)',
    'Near Payout': 'var(--purple)',
    Damaged: 'var(--orange)',
    Critical: 'var(--red)',
    Passed: 'var(--teal)',
  }
  const c = colors[status] || 'var(--text-muted)'
  return (
    <span
      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
      style={{
        background: `color-mix(in srgb, ${c} 15%, transparent)`,
        color: c,
        border: `1px solid color-mix(in srgb, ${c} 30%, transparent)`,
      }}
    >
      {status}
    </span>
  )
}

function AccountCard({ account, trades, settings, onUpdate }) {
  const stats = getAccountStats(account, trades, settings)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({
    name: account.name,
    startingPnl: account.startingPnl || 0,
    health: account.health,
  })

  const save = () => {
    onUpdate({
      ...account,
      name: draft.name,
      startingPnl: Number(draft.startingPnl) || 0,
      health: draft.health,
    })
    setEditing(false)
  }

  const mllPct = Math.max(0, Math.min(100, stats.mllPercent))
  const ptPct = Math.max(0, Math.min(100, stats.ptPercent))
  const mllHealthy = mllPct > 50
  const mllWarn = mllPct > 25 && mllPct <= 50

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-4 border mb-3"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-center justify-between mb-3">
        {editing ? (
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className="flex-1 bg-transparent border-0 outline-none text-base font-semibold"
            style={{ color: 'var(--text)', borderBottom: '1px solid var(--border)' }}
          />
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            <div className="text-base font-semibold truncate" style={{ color: 'var(--text)' }}>
              {account.name}
            </div>
            <HealthPill status={account.health} />
          </div>
        )}
        <button
          onClick={() => (editing ? save() : setEditing(true))}
          className="p-1.5 rounded-lg border-0 cursor-pointer ml-2 flex-shrink-0"
          style={{ background: 'var(--surface)', color: editing ? 'var(--green)' : 'var(--text-muted)' }}
        >
          {editing ? <Check size={14} /> : <Edit2 size={14} />}
        </button>
        {editing && (
          <button
            onClick={() => {
              setDraft({ name: account.name, startingPnl: account.startingPnl || 0, health: account.health })
              setEditing(false)
            }}
            className="p-1.5 rounded-lg border-0 cursor-pointer ml-1"
            style={{ background: 'var(--surface)', color: 'var(--red)' }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Total P&L */}
      <div className="mb-3">
        <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Total P&L
        </div>
        <div
          className="text-2xl font-bold font-mono"
          style={{ color: stats.totalPnl >= 0 ? 'var(--green)' : 'var(--red)' }}
        >
          {formatCurrency(stats.totalPnl)}
        </div>
      </div>

      {editing && (
        <div className="mb-3 p-2 rounded-lg" style={{ background: 'var(--surface)' }}>
          <div className="text-[10px] uppercase mb-1" style={{ color: 'var(--text-muted)' }}>
            Starting P&L offset
          </div>
          <input
            type="number"
            value={draft.startingPnl}
            onChange={(e) => setDraft({ ...draft, startingPnl: e.target.value })}
            className="w-full bg-transparent border-0 outline-none text-sm font-mono"
            style={{ color: 'var(--text)' }}
          />
          <div className="text-[10px] uppercase mt-2 mb-1" style={{ color: 'var(--text-muted)' }}>
            Health
          </div>
          <div className="flex gap-1 flex-wrap">
            {HEALTH_STATUSES.map((h) => (
              <button
                key={h}
                onClick={() => setDraft({ ...draft, health: h })}
                className="px-2 py-0.5 rounded-full text-[10px] border-0 cursor-pointer"
                style={{
                  background: draft.health === h ? 'var(--blue)' : 'transparent',
                  color: draft.health === h ? '#fff' : 'var(--text-dim)',
                  border: `1px solid ${draft.health === h ? 'transparent' : 'var(--border)'}`,
                }}
              >
                {h}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Trailing MLL Bar */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] uppercase" style={{ color: 'var(--text-muted)' }}>
            To bust
          </span>
          <span className="text-[11px] font-mono font-semibold" style={{ color: 'var(--text)' }}>
            {formatCurrency(stats.mllLeft)}
          </span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface)' }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${mllPct}%`,
              background: mllHealthy ? 'var(--green)' : mllWarn ? 'var(--orange)' : 'var(--red)',
            }}
          />
        </div>
        <div className="flex items-center justify-between text-[9px] font-mono mt-1" style={{ color: 'var(--text-muted)' }}>
          <span>Peak {formatCurrency(stats.mllPeak || 0)}</span>
          <span>Floor {formatCurrency(stats.mllFloor || 0)}</span>
          {stats.mllBusted && <span style={{ color: 'var(--red)', fontWeight: 700 }}>BUSTED</span>}
        </div>
      </div>

      {/* PT Bar */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] uppercase" style={{ color: 'var(--text-muted)' }}>
            Profit Target
          </span>
          <span className="text-[11px] font-mono font-semibold" style={{ color: 'var(--text)' }}>
            {ptPct.toFixed(0)}%
          </span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface)' }}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${ptPct}%`, background: 'var(--blue)' }}
          />
        </div>
      </div>

      {/* Mini stats row */}
      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
        <div>
          <div className="text-[9px] uppercase" style={{ color: 'var(--text-muted)' }}>
            Entries
          </div>
          <div className="text-xs font-bold" style={{ color: 'var(--text)' }}>
            {stats.totalEntries}
          </div>
        </div>
        <div>
          <div className="text-[9px] uppercase" style={{ color: 'var(--text-muted)' }}>
            Slot WR
          </div>
          <div className="text-xs font-bold" style={{ color: 'var(--text)' }}>
            {(stats.slotWR * 100).toFixed(0)}%
          </div>
        </div>
        <div>
          <div className="text-[9px] uppercase" style={{ color: 'var(--text-muted)' }}>
            Journal
          </div>
          <div
            className="text-xs font-bold font-mono"
            style={{ color: stats.journalPnl >= 0 ? 'var(--green)' : 'var(--red)' }}
          >
            {formatCurrency(stats.journalPnl)}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default function MobileAccounts({ state, updateAccounts, updateSettings }) {
  const onUpdateAccount = (updated) => {
    const next = (state.accounts || []).map((a) => (a.id === updated.id ? updated : a))
    updateAccounts(next)
  }

  const [settingsDraft, setSettingsDraft] = useState({
    mll: state.settings.mll,
    profitTarget: state.settings.profitTarget,
    accountSize: state.settings.accountSize,
  })
  const [editingSettings, setEditingSettings] = useState(false)

  return (
    <div className="px-4 pt-4 pb-28">
      <div className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
        Prop Firm Rules
      </div>
      <div
        className="rounded-2xl p-4 border mb-4"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
      >
        {editingSettings ? (
          <div className="space-y-3">
            <div>
              <div className="text-[10px] uppercase mb-1" style={{ color: 'var(--text-muted)' }}>
                Max Loss Limit ($)
              </div>
              <input
                type="number"
                value={settingsDraft.mll}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, mll: Number(e.target.value) })}
                className="w-full rounded-lg px-3 py-2 text-sm font-mono border"
                style={{ background: 'var(--surface)', color: 'var(--text)', borderColor: 'var(--border)' }}
              />
            </div>
            <div>
              <div className="text-[10px] uppercase mb-1" style={{ color: 'var(--text-muted)' }}>
                Profit Target ($)
              </div>
              <input
                type="number"
                value={settingsDraft.profitTarget}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, profitTarget: Number(e.target.value) })}
                className="w-full rounded-lg px-3 py-2 text-sm font-mono border"
                style={{ background: 'var(--surface)', color: 'var(--text)', borderColor: 'var(--border)' }}
              />
            </div>
            <div>
              <div className="text-[10px] uppercase mb-1" style={{ color: 'var(--text-muted)' }}>
                Account Size ($)
              </div>
              <input
                type="number"
                value={settingsDraft.accountSize}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, accountSize: Number(e.target.value) })}
                className="w-full rounded-lg px-3 py-2 text-sm font-mono border"
                style={{ background: 'var(--surface)', color: 'var(--text)', borderColor: 'var(--border)' }}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  updateSettings(settingsDraft)
                  setEditingSettings(false)
                }}
                className="flex-1 py-2 rounded-lg text-sm font-semibold cursor-pointer border-0 text-white keep-white"
                style={{ background: 'var(--blue)' }}
              >
                Save
              </button>
              <button
                onClick={() => {
                  setSettingsDraft({
                    mll: state.settings.mll,
                    profitTarget: state.settings.profitTarget,
                    accountSize: state.settings.accountSize,
                  })
                  setEditingSettings(false)
                }}
                className="flex-1 py-2 rounded-lg text-sm font-semibold cursor-pointer border-0"
                style={{ background: 'var(--surface)', color: 'var(--text)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <div>
              <div className="text-[9px] uppercase" style={{ color: 'var(--text-muted)' }}>
                MLL
              </div>
              <div className="text-sm font-bold font-mono" style={{ color: 'var(--red)' }}>
                ${state.settings.mll}
              </div>
            </div>
            <div>
              <div className="text-[9px] uppercase" style={{ color: 'var(--text-muted)' }}>
                PT
              </div>
              <div className="text-sm font-bold font-mono" style={{ color: 'var(--green)' }}>
                ${state.settings.profitTarget}
              </div>
            </div>
            <div>
              <div className="text-[9px] uppercase" style={{ color: 'var(--text-muted)' }}>
                Size
              </div>
              <div className="text-sm font-bold font-mono" style={{ color: 'var(--text)' }}>
                ${state.settings.accountSize}
              </div>
            </div>
            <button
              onClick={() => setEditingSettings(true)}
              className="col-span-3 mt-2 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border-0"
              style={{ background: 'var(--surface)', color: 'var(--text-dim)', border: '1px solid var(--border)' }}
            >
              Edit rules
            </button>
          </div>
        )}
      </div>

      <div className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
        Accounts
      </div>
      {(state.accounts || []).map((a) => (
        <AccountCard
          key={a.id}
          account={a}
          trades={state.trades || []}
          settings={state.settings}
          onUpdate={onUpdateAccount}
        />
      ))}
    </div>
  )
}
