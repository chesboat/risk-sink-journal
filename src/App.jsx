import { useState, useEffect, useCallback, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { LayoutDashboard, Calendar, PenLine, BarChart3, Users, Moon, Sun, Plus, Download, Upload, Cloud, CloudOff, LogOut, AlertCircle, X, Sparkles, FileDown, History } from 'lucide-react'
import { getDefaultState, createTrade, exportData, exportForAI, importData, createStrategyAssignment } from './lib/store'
import {
  isSupabaseConfigured,
  pullState,
  pushTrade,
  pushConfigGuarded,
  deleteTrade as supaDeleteTrade,
  replaceAllTrades,
  getCurrentUser,
  onAuthChange,
  signOut,
  pushAssignment,
  closeActiveAssignment,
  upsertBotTrades,
} from './lib/supabase'
import { saveSnapshot, listSnapshots, downloadSnapshot } from './lib/backup'
import Dashboard from './pages/Dashboard'
import CalendarPage from './pages/CalendarPage'
import TradeLog from './pages/TradeLog'
import Analytics from './pages/Analytics'
import Accounts from './pages/Accounts'
import ImportBotTrades from './pages/ImportBotTrades'
import TradeModal from './components/TradeModal'
import TradeDetailView from './pages/TradeDetailView'
import AuthGate from './components/AuthGate'
import MobileShell from './mobile/MobileShell'
import { useIsMobile } from './mobile/useIsMobile'

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'tradelog', label: 'Trade Log', icon: PenLine },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'accounts', label: 'Accounts', icon: Users },
  { id: 'import', label: 'Import Bot', icon: FileDown },
]

const pageTransition = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.2, ease: 'easeOut' },
}

export default function App() {
  const { isMobile, forceDesktop } = useIsMobile()
  const [state, setState] = useState(getDefaultState)
  const [page, setPage] = useState('dashboard')
  const [showModal, setShowModal] = useState(false)
  const [editTrade, setEditTrade] = useState(null)
  const [viewTrade, setViewTrade] = useState(null)
  const [prevPage, setPrevPage] = useState(null)
  const [sidebarHover, setSidebarHover] = useState(false)
  const [syncStatus, setSyncStatus] = useState(isSupabaseConfigured() ? 'syncing' : 'offline') // 'synced' | 'syncing' | 'offline' | 'error'
  const [syncError, setSyncError] = useState(null) // { message } | null
  const [user, setUser] = useState(null)
  const [authChecked, setAuthChecked] = useState(!isSupabaseConfigured())
  const [ready, setReady] = useState(!isSupabaseConfigured()) // first-pull gate
  const [showSnapshots, setShowSnapshots] = useState(false)
  const pendingOps = useRef(0)
  const loadedUserId = useRef(null) // tracks which user we've already pulled for
  const configUpdatedAt = useRef(null) // server stamp of the config row we last saw
  const lastPullAt = useRef(0)
  // Mirror of the latest committed state so event handlers can read current
  // values without the setState-updater-side-effect pattern.
  const stateRef = useRef(state)
  useEffect(() => { stateRef.current = state }, [state])

  // ── Sync status helpers ──
  const markSyncing = useCallback(() => {
    pendingOps.current += 1
    setSyncStatus('syncing')
  }, [])
  const markSynced = useCallback(() => {
    pendingOps.current = Math.max(0, pendingOps.current - 1)
    if (pendingOps.current === 0) setSyncStatus('synced')
  }, [])
  // note: what actually happened to the user's data — shown in the banner.
  // Default fits the mutation paths that cleanly revert; paths that don't
  // revert MUST pass an accurate note instead.
  const markError = useCallback((err, note) => {
    pendingOps.current = Math.max(0, pendingOps.current - 1)
    setSyncStatus('error')
    setSyncError({ message: err?.message || String(err) || 'Sync failed', note: note || 'Change reverted.' })
  }, [])
  const dismissError = () => { setSyncError(null); if (pendingOps.current === 0) setSyncStatus('synced') }

  // ── Auth: check current session + subscribe to changes ──
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setAuthChecked(true)
      return
    }
    getCurrentUser().then(u => {
      setUser(u)
      setAuthChecked(true)
    })
    const unsub = onAuthChange((u) => {
      // Only update user state when the identity actually changes (sign-in/sign-out),
      // NOT on token refreshes — those fire every time you return to the tab and
      // would re-trigger the pull effect, flashing the loading screen.
      setUser(prev => {
        const prevId = prev?.id || null
        const newId = u?.id || null
        if (prevId === newId) return prev // same user, keep same reference
        if (!u) {
          // Signed out — reset to empty defaults
          loadedUserId.current = null
          setState(getDefaultState())
          setReady(true)
        }
        return u
      })
    })
    return unsub
  }, [])

  // Apply a pulled remote state and record bookkeeping (config stamp, pull
  // time, daily local snapshot). Shared by the initial pull and focus refresh.
  const applyRemote = useCallback((remote, userId) => {
    const defaults = getDefaultState()
    const trades = (remote.trades || []).slice().sort(
      (a, b) => new Date(b.date) - new Date(a.date) || b.createdAt - a.createdAt
    )
    const next = {
      trades,
      botTrades: remote.botTrades || [],
      strategyAssignments: remote.strategyAssignments || [],
      accounts: remote.accounts || defaults.accounts,
      settings: { ...defaults.settings, ...(remote.settings || {}) },
    }
    setState(next)
    configUpdatedAt.current = remote.configUpdatedAt || null
    lastPullAt.current = Date.now()
    loadedUserId.current = userId
    try { saveSnapshot(next, userId, 'auto') } catch (e) { console.warn('Snapshot failed:', e) }
  }, [])

  // ── Pull on mount (once user is known) — AUTHORITATIVE REMOTE ──
  // Only runs once per user identity, not on token refreshes.
  useEffect(() => {
    if (!isSupabaseConfigured() || !user) return
    if (loadedUserId.current === user.id) return // already loaded for this user
    let cancelled = false
    setReady(false)
    setSyncStatus('syncing')
    pullState(user.id)
      .then(remote => {
        if (cancelled) return
        if (!remote) {
          setSyncStatus('offline')
          setReady(true)
          return
        }
        applyRemote(remote, user.id)
        setSyncStatus('synced')
        setReady(true)
      })
      .catch(err => {
        if (cancelled) return
        console.error('Initial pull failed:', err)
        // loadedUserId intentionally NOT set — the focus-refresh effect below
        // retries the pull next time the tab regains focus (e.g. after a
        // paused Supabase project wakes up).
        markError(err, 'Could not load your journal — will retry when you return to this tab.')
        // Still allow app to render with defaults so user isn't stuck
        setReady(true)
      })
    return () => { cancelled = true }
  }, [user, markError, applyRemote])

  // ── Refresh on tab focus ──
  // Re-pulls when the tab becomes visible and local data is stale (>5 min)
  // or the initial pull failed. Skipped while writes are in flight so an
  // optimistic update can't be clobbered by its own refresh.
  useEffect(() => {
    if (!isSupabaseConfigured() || !user) return
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (pendingOps.current > 0) return
      const stale = Date.now() - lastPullAt.current > 5 * 60 * 1000
      const neverLoaded = loadedUserId.current !== user.id
      if (!stale && !neverLoaded) return
      pullState(user.id)
        .then(remote => {
          if (!remote) return
          if (pendingOps.current > 0) return // a write started while we fetched
          applyRemote(remote, user.id)
          setSyncStatus('synced')
          setReady(true)
        })
        .catch(err => console.warn('Focus refresh failed:', err))
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [user, applyRemote])

  // ── Theme ──
  useEffect(() => {
    if (state.settings.theme === 'light') {
      document.body.classList.add('light')
    } else {
      document.body.classList.remove('light')
    }
  }, [state.settings.theme])

  // ═══ Optimistic mutations with revert-on-failure ═══

  const addTrade = useCallback((trade) => {
    setShowModal(false)
    setEditTrade(null)
    setState(s => ({ ...s, trades: [...s.trades, trade] }))
    if (!user) return
    markSyncing()
    pushTrade(trade, user.id)
      .then(markSynced)
      .catch(err => {
        console.error('Add trade sync failed:', err)
        // Revert: remove the trade we just added
        setState(s => ({ ...s, trades: s.trades.filter(t => t.id !== trade.id) }))
        markError(err)
      })
  }, [user, markSyncing, markSynced, markError])

  const updateTrade = useCallback((trade) => {
    setShowModal(false)
    setEditTrade(null)
    let prevTrade = null
    setState(s => {
      prevTrade = s.trades.find(t => t.id === trade.id) || null
      return { ...s, trades: s.trades.map(t => t.id === trade.id ? trade : t) }
    })
    setViewTrade(prev => prev?.id === trade.id ? trade : prev)
    if (!user) return
    markSyncing()
    pushTrade(trade, user.id)
      .then(markSynced)
      .catch(err => {
        console.error('Update trade sync failed:', err)
        if (prevTrade) {
          setState(s => ({ ...s, trades: s.trades.map(t => t.id === trade.id ? prevTrade : t) }))
          setViewTrade(prev => prev?.id === trade.id ? prevTrade : prev)
        }
        markError(err)
      })
  }, [user, markSyncing, markSynced, markError])

  const deleteTradeHandler = useCallback((id) => {
    let removed = null
    setState(s => {
      removed = s.trades.find(t => t.id === id) || null
      return { ...s, trades: s.trades.filter(t => t.id !== id) }
    })
    if (!user) return
    markSyncing()
    supaDeleteTrade(id, user.id)
      .then(markSynced)
      .catch(err => {
        console.error('Delete trade sync failed:', err)
        // Revert: put the trade back
        if (removed) {
          setState(s => ({ ...s, trades: [...s.trades, removed] }))
        }
        markError(err)
      })
  }, [user, markSyncing, markSynced, markError])

  // Push accounts+settings with the concurrency guard. On conflict (another
  // device wrote since our last pull) the remote version is reloaded instead
  // of clobbered, and the user is told to re-apply their change.
  const pushConfigWithGuard = useCallback(async (accounts, settings, revert) => {
    markSyncing()
    try {
      const res = await pushConfigGuarded(accounts, settings, user.id, configUpdatedAt.current)
      if (res.conflict) {
        const remote = await pullState(user.id)
        if (remote && pendingOps.current <= 1) applyRemote(remote, user.id)
        markError(
          new Error('Settings were changed on another device'),
          'Loaded the newest version instead of overwriting it — please re-apply your change.'
        )
        return
      }
      configUpdatedAt.current = res.updatedAt
      markSynced()
    } catch (err) {
      console.error('Config sync failed:', err)
      revert()
      markError(err)
    }
  }, [user, markSyncing, markSynced, markError, applyRemote])

  const updateAccounts = useCallback((accounts) => {
    const prev = stateRef.current.accounts
    const settings = stateRef.current.settings
    setState(s => ({ ...s, accounts }))
    if (!user) return
    pushConfigWithGuard(accounts, settings, () => setState(s2 => ({ ...s2, accounts: prev })))
  }, [user, pushConfigWithGuard])

  const updateSettings = useCallback((partial) => {
    const prev = stateRef.current.settings
    const merged = { ...prev, ...partial }
    const accounts = stateRef.current.accounts
    setState(s => ({ ...s, settings: merged }))
    if (!user) return
    pushConfigWithGuard(accounts, merged, () => setState(s2 => ({ ...s2, settings: prev })))
  }, [user, pushConfigWithGuard])

  const toggleTheme = () => {
    updateSettings({ theme: state.settings.theme === 'dark' ? 'light' : 'dark' })
  }

  // ═══ Bot trade import ═══

  // Optimistically merge a batch of bot trades into state and push to Supabase.
  // On failure, revert the local addition. Returns a promise so the import UI
  // can show success/error feedback.
  const importBotTrades = useCallback(async (trades) => {
    if (!trades || trades.length === 0) return
    let prev = null
    setState(s => {
      prev = s.botTrades || []
      return { ...s, botTrades: [...trades, ...prev] }
    })
    if (!user) return
    markSyncing()
    try {
      await upsertBotTrades(trades, user.id)
      markSynced()
    } catch (err) {
      console.error('Bot trade import sync failed:', err)
      setState(s => ({ ...s, botTrades: prev }))
      markError(err)
      throw err
    }
  }, [user, markSyncing, markSynced, markError])

  // ═══ Bot strategy assignments ═══

  // Switch the active strategy on a bot account.
  // Atomically closes any currently-active assignment and opens a new one at
  // `switchAt`. The partial unique index in the DB guarantees only one active
  // assignment per account, so two parallel swaps can't both leave open rows.
  const switchStrategy = useCallback(({ accountId, strategyName, switchAt, note }) => {
    if (!accountId || !strategyName?.trim()) return
    const startedAt = switchAt ? new Date(switchAt).toISOString() : new Date().toISOString()
    const newAssignment = createStrategyAssignment({
      accountId, strategyName, startedAt, note,
    })

    // Optimistic: close current active, add new
    let prevList = null
    setState(s => {
      prevList = s.strategyAssignments || []
      const closed = prevList.map(a =>
        a.accountId === accountId && !a.endedAt ? { ...a, endedAt: startedAt } : a
      )
      return { ...s, strategyAssignments: [newAssignment, ...closed] }
    })

    if (!user) return
    markSyncing()
    ;(async () => {
      try {
        await closeActiveAssignment(accountId, startedAt, user.id)
        await pushAssignment(newAssignment, user.id)
        markSynced()
      } catch (err) {
        console.error('Switch strategy sync failed:', err)
        setState(s => ({ ...s, strategyAssignments: prevList }))
        markError(err)
      }
    })()
  }, [user, markSyncing, markSynced, markError])

  // Persist a user-added custom tag so it reappears on the next trade.
  // No-op if the tag already exists in this category.
  const addCustomTag = useCallback((category, tag) => {
    const trimmed = (tag || '').trim()
    if (!trimmed) return
    const current = state.settings.customTags || {}
    const list = current[category] || []
    if (list.includes(trimmed)) return
    updateSettings({
      customTags: { ...current, [category]: [...list, trimmed] }
    })
  }, [state.settings.customTags, updateSettings])

  const openNewTrade = () => {
    setEditTrade(null)
    setShowModal(true)
  }

  const openViewTrade = (trade) => {
    setPrevPage(page)
    setViewTrade(trade)
  }

  const openEditTrade = (trade) => {
    setEditTrade(trade)
    setShowModal(true)
  }

  // Duplicate: opens the modal with a NEW trade pre-filled from an existing
  // one (setup context copied, entries/journal reset). Saving goes through
  // addTrade because the fresh id isn't in state yet.
  const openDuplicateTrade = (trade) => {
    const copy = createTrade({
      instrument: trade.instrument,
      session: trade.session,
      setup: trade.setup,
      thesis: trade.thesis || '',
      tags: JSON.parse(JSON.stringify(trade.tags || {})),
    })
    setEditTrade(copy)
    setShowModal(true)
  }

  // The modal's editTrade may be an existing trade OR a fresh duplicate —
  // route the save by whether the id already exists.
  const saveFromModal = useCallback((t) => {
    const exists = stateRef.current.trades.some(x => x.id === t.id)
    if (exists) updateTrade(t)
    else addTrade(t)
  }, [updateTrade, addTrade])

  const closeDetailView = () => {
    setViewTrade(null)
    if (prevPage) setPage(prevPage)
  }

  const handleImport = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      try {
        const data = await importData(e.target.files[0])
        const prevState = stateRef.current
        const counts = `${(data.trades || []).length} trades, ${(data.accounts || []).length} accounts`
        if (!confirm(`Import will REPLACE your current journal with the file's contents (${counts}). Continue?`)) return
        // Safety net before any destructive write
        if (user) {
          try { saveSnapshot(prevState, user.id, 'pre-import') } catch {}
        }
        setState(data)
        if (!user) return
        markSyncing()
        try {
          await replaceAllTrades(data.trades || [], user.id)
          // Import deliberately overwrites config; null guard = unconditional
          const res = await pushConfigGuarded(data.accounts, data.settings, user.id, null)
          configUpdatedAt.current = res.updatedAt
          markSynced()
        } catch (err) {
          console.error('Import sync failed:', err)
          // Server was never wiped (upsert-first order); put local back too
          setState(prevState)
          markError(err, 'Import aborted — your previous journal is still intact (plus a local snapshot from just before).')
        }
      } catch (err) {
        alert('Failed to import: ' + err.message)
      }
    }
    input.click()
  }

  const renderPage = () => {
    if (viewTrade) {
      const fresh = state.trades.find(t => t.id === viewTrade.id) || viewTrade
      return (
        <TradeDetailView
          trade={fresh}
          onBack={closeDetailView}
          onEdit={openEditTrade}
          onDelete={(id) => { deleteTradeHandler(id); closeDetailView() }}
        />
      )
    }

    const props = { state, openEditTrade: openViewTrade, updateTrade, deleteTrade: deleteTradeHandler, duplicateTrade: openDuplicateTrade, updateAccounts, updateSettings, switchStrategy, importBotTrades }
    switch (page) {
      case 'dashboard': return <Dashboard {...props} />
      case 'calendar': return <CalendarPage {...props} />
      case 'tradelog': return <TradeLog {...props} />
      case 'analytics': return <Analytics {...props} />
      case 'accounts': return <Accounts {...props} />
      case 'import': return <ImportBotTrades {...props} />
      default: return <Dashboard {...props} />
    }
  }

  const isLight = state.settings.theme === 'light'

  // Auth gate
  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</div>
      </div>
    )
  }
  if (isSupabaseConfigured() && !user) {
    return <AuthGate />
  }

  // Loading gate — wait for first pull so we don't show stale defaults then flash to real data
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="flex items-center gap-3">
          <Cloud size={18} className="animate-pulse" style={{ color: 'var(--blue)' }} />
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading your journal…</div>
        </div>
      </div>
    )
  }

  // ── Error banner (reusable) ──
  const errorBanner = syncError && (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg max-w-md"
      style={{ background: 'var(--red)', color: 'white' }}
    >
      <AlertCircle size={18} />
      <div className="text-sm flex-1">
        <div className="font-semibold">Sync failed</div>
        <div className="opacity-90 text-xs">{syncError.message}. {syncError.note}</div>
      </div>
      <button onClick={dismissError} className="p-1 cursor-pointer border-0 bg-transparent" style={{ color: 'white' }}>
        <X size={16} />
      </button>
    </div>
  )

  // Mobile layout
  if (isMobile) {
    return (
      <>
        {errorBanner}
        <MobileShell
          state={state}
          openNewTrade={openNewTrade}
          openEditTrade={openEditTrade}
          deleteTrade={deleteTradeHandler}
          updateAccounts={updateAccounts}
          updateSettings={updateSettings}
          toggleTheme={toggleTheme}
          syncStatus={syncStatus}
          supabaseConfigured={isSupabaseConfigured()}
          user={user}
          signOut={signOut}
          forceDesktop={forceDesktop}
        />
        <AnimatePresence>
          {showModal && (
            <TradeModal
              trade={editTrade}
              onSave={saveFromModal}
              onClose={() => { setShowModal(false); setEditTrade(null) }}
              customTags={state.settings.customTags || {}}
              onAddCustomTag={addCustomTag}
            />
          )}
        </AnimatePresence>
      </>
    )
  }

  return (
    <div className="flex min-h-screen">
      {errorBanner}
      {/* Sidebar */}
      <nav
        className="fixed left-0 top-0 bottom-0 z-50 flex flex-col items-center py-4 border-r transition-all duration-300 overflow-hidden"
        style={{
          width: sidebarHover ? 200 : 64,
          background: 'var(--surface)',
          borderColor: 'var(--border)',
        }}
        onMouseEnter={() => setSidebarHover(true)}
        onMouseLeave={() => setSidebarHover(false)}
      >
        {/* Logo */}
        <div className="flex items-center px-4 mb-6 whitespace-nowrap">
          <div className="w-8 h-8 rounded-[10px] flex-shrink-0 flex items-center justify-center font-mono font-bold text-sm text-white keep-white"
            style={{ background: 'linear-gradient(135deg, var(--blue), var(--purple))' }}>
            RS
          </div>
          <span className="font-bold text-[15px] overflow-hidden transition-all duration-300"
            style={{ opacity: sidebarHover ? 1 : 0, width: sidebarHover ? 'auto' : 0, marginLeft: sidebarHover ? 8 : 0 }}>
            Risk Sink
          </span>
        </div>

        {/* Nav Items */}
        {NAV.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => { setPage(id); setViewTrade(null) }}
            className="flex items-center rounded-[10px] mb-1 cursor-pointer transition-all duration-200 whitespace-nowrap overflow-hidden"
            style={{
              width: sidebarHover ? 184 : 48,
              minHeight: 44,
              padding: '0 14px',
              background: page === id ? 'var(--blue-dim)' : 'transparent',
            }}
          >
            <Icon
              size={20}
              className="flex-shrink-0 transition-colors duration-200"
              style={{ color: page === id ? 'var(--accent)' : 'var(--text-muted)' }}
            />
            <span
              className="ml-3 text-sm font-medium transition-all duration-250"
              style={{
                opacity: sidebarHover ? 1 : 0,
                transform: sidebarHover ? 'translateX(0)' : 'translateX(-8px)',
                color: page === id ? 'var(--accent)' : 'var(--text-dim)',
                fontWeight: page === id ? 600 : 500,
              }}
            >
              {label}
            </span>
          </button>
        ))}

        {/* Bottom actions */}
        <div className="mt-auto flex flex-col gap-2 items-center">
          {isSupabaseConfigured() && (
            <div className="p-2" title={
              syncStatus === 'synced' ? 'Synced to cloud'
              : syncStatus === 'syncing' ? 'Syncing...'
              : syncStatus === 'error' ? 'Sync error'
              : 'Offline'
            }>
              {syncStatus === 'offline' ? (
                <CloudOff size={16} style={{ color: 'var(--text-muted)' }} />
              ) : syncStatus === 'error' ? (
                <AlertCircle size={16} style={{ color: 'var(--red)' }} />
              ) : (
                <Cloud size={16} style={{ color: syncStatus === 'synced' ? 'var(--green)' : 'var(--orange)' }} className={syncStatus === 'syncing' ? 'animate-pulse' : ''} />
              )}
            </div>
          )}
          <button onClick={() => exportForAI(state)} className="p-2 rounded-lg transition-colors border-0 cursor-pointer" style={{ color: 'var(--text-muted)', background: 'transparent' }} title="Export for AI analysis (Markdown)">
            <Sparkles size={16} />
          </button>
          <button onClick={() => exportData(state)} className="p-2 rounded-lg transition-colors border-0 cursor-pointer" style={{ color: 'var(--text-muted)', background: 'transparent' }} title="Export raw backup (JSON)">
            <Download size={16} />
          </button>
          {user && (
            <button onClick={() => setShowSnapshots(true)} className="p-2 rounded-lg transition-colors border-0 cursor-pointer" style={{ color: 'var(--text-muted)', background: 'transparent' }} title="Local snapshots (automatic daily backups)">
              <History size={16} />
            </button>
          )}
          <button onClick={handleImport} className="p-2 rounded-lg transition-colors border-0 cursor-pointer" style={{ color: 'var(--text-muted)', background: 'transparent' }} title="Import">
            <Upload size={16} />
          </button>
          {user && (
            <button
              onClick={() => { if (confirm('Sign out?')) signOut() }}
              className="p-2 rounded-lg transition-colors border-0 cursor-pointer"
              style={{ color: 'var(--text-muted)', background: 'transparent' }}
              title={`Sign out (${user.email})`}
            >
              <LogOut size={16} />
            </button>
          )}
          <button
            onClick={toggleTheme}
            className="w-9 h-9 rounded-[10px] flex items-center justify-center cursor-pointer transition-all duration-300 relative overflow-hidden"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <Sun size={18} className="absolute transition-all duration-400" style={{
              color: 'var(--text-dim)',
              opacity: isLight ? 1 : 0,
              transform: isLight ? 'rotate(0) scale(1)' : 'rotate(90deg) scale(0.5)',
            }} />
            <Moon size={18} className="absolute transition-all duration-400" style={{
              color: 'var(--text-dim)',
              opacity: isLight ? 0 : 1,
              transform: isLight ? 'rotate(-90deg) scale(0.5)' : 'rotate(0) scale(1)',
            }} />
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 transition-all duration-300" style={{ marginLeft: 64, padding: '28px 32px' }}>
        <AnimatePresence mode="wait">
          <motion.div key={viewTrade ? `trade-${viewTrade.id}` : page} {...pageTransition}>
            {renderPage()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Floating New Trade Button */}
      <motion.button
        onClick={openNewTrade}
        className="fixed bottom-7 right-8 z-40 flex items-center gap-2 px-6 py-3.5 rounded-2xl text-white keep-white font-semibold text-sm cursor-pointer border-0"
        style={{
          background: 'linear-gradient(135deg, var(--blue), var(--purple))',
          boxShadow: '0 4px 20px rgba(10,132,255,0.3)',
        }}
        whileHover={{ y: -2, scale: 1.02, boxShadow: '0 8px 32px rgba(10,132,255,0.4)' }}
        whileTap={{ scale: 0.98 }}
      >
        <Plus size={18} />
        New Trade
      </motion.button>

      {/* Trade Modal */}
      <AnimatePresence>
        {showModal && (
          <TradeModal
            trade={editTrade}
            onSave={saveFromModal}
            onClose={() => { setShowModal(false); setEditTrade(null) }}
          />
        )}
      </AnimatePresence>

      {/* Local snapshots */}
      {showSnapshots && user && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setShowSnapshots(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border p-6 max-h-[80vh] overflow-y-auto"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--text)' }}>
                <History size={18} />
                Local snapshots
              </h3>
              <button onClick={() => setShowSnapshots(false)} className="p-1 border-0 bg-transparent cursor-pointer" style={{ color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
              Automatic daily backups kept in this browser (screenshots excluded).
              To restore one: download it, then use Import.
            </p>
            {listSnapshots(user.id).length === 0 ? (
              <div className="text-sm py-6 text-center" style={{ color: 'var(--text-muted)' }}>
                No snapshots yet — one is saved automatically each day you open the journal.
              </div>
            ) : (
              <div className="space-y-2">
                {listSnapshots(user.id).map((snap) => (
                  <div
                    key={snap.takenAt}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl"
                    style={{ background: 'var(--surface)' }}
                  >
                    <div>
                      <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                        {snap.date}
                        {snap.label !== 'auto' && (
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded uppercase font-semibold" style={{ background: 'var(--blue-dim)', color: 'var(--accent)' }}>
                            {snap.label}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{snap.tradeCount} trades</div>
                    </div>
                    <button
                      onClick={() => downloadSnapshot(snap)}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border cursor-pointer bg-transparent"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
                    >
                      <Download size={12} />
                      Download
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
