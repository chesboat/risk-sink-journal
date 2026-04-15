import { useState, useEffect, useCallback, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { LayoutDashboard, Calendar, PenLine, BarChart3, Users, Moon, Sun, Plus, Download, Upload, Cloud, CloudOff, LogOut, AlertCircle, X } from 'lucide-react'
import { getDefaultState, createTrade, exportData, importData } from './lib/store'
import {
  isSupabaseConfigured,
  pullState,
  pushTrade,
  pushConfig,
  deleteTrade as supaDeleteTrade,
  replaceAllTrades,
  getCurrentUser,
  onAuthChange,
  signOut,
} from './lib/supabase'
import Dashboard from './pages/Dashboard'
import CalendarPage from './pages/CalendarPage'
import TradeLog from './pages/TradeLog'
import Analytics from './pages/Analytics'
import Accounts from './pages/Accounts'
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
  const pendingOps = useRef(0)

  // ── Sync status helpers ──
  const markSyncing = useCallback(() => {
    pendingOps.current += 1
    setSyncStatus('syncing')
  }, [])
  const markSynced = useCallback(() => {
    pendingOps.current = Math.max(0, pendingOps.current - 1)
    if (pendingOps.current === 0) setSyncStatus('synced')
  }, [])
  const markError = useCallback((err) => {
    pendingOps.current = Math.max(0, pendingOps.current - 1)
    setSyncStatus('error')
    setSyncError({ message: err?.message || String(err) || 'Sync failed' })
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
      setUser(u)
      if (!u) {
        // Signed out — reset to empty defaults
        setState(getDefaultState())
        setReady(true)
      }
    })
    return unsub
  }, [])

  // ── Pull on mount (once user is known) — AUTHORITATIVE REMOTE ──
  useEffect(() => {
    if (!isSupabaseConfigured() || !user) return
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
        const defaults = getDefaultState()
        const trades = (remote.trades || []).slice().sort(
          (a, b) => new Date(b.date) - new Date(a.date) || b.createdAt - a.createdAt
        )
        setState({
          trades,
          accounts: remote.accounts || defaults.accounts,
          settings: { ...defaults.settings, ...(remote.settings || {}) },
        })
        setSyncStatus('synced')
        setReady(true)
      })
      .catch(err => {
        if (cancelled) return
        console.error('Initial pull failed:', err)
        markError(err)
        // Still allow app to render with defaults so user isn't stuck
        setReady(true)
      })
    return () => { cancelled = true }
  }, [user, markError])

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

  const updateAccounts = useCallback((accounts) => {
    let prev = null
    setState(s => {
      prev = { accounts: s.accounts, settings: s.settings }
      return { ...s, accounts }
    })
    if (!user) return
    markSyncing()
    // Use current settings from the update we just applied
    setState(s => {
      pushConfig(accounts, s.settings, user.id)
        .then(markSynced)
        .catch(err => {
          console.error('Accounts sync failed:', err)
          setState(s2 => ({ ...s2, accounts: prev.accounts }))
          markError(err)
        })
      return s
    })
  }, [user, markSyncing, markSynced, markError])

  const updateSettings = useCallback((partial) => {
    let prev = null
    let merged = null
    setState(s => {
      prev = s.settings
      merged = { ...s.settings, ...partial }
      return { ...s, settings: merged }
    })
    if (!user) return
    markSyncing()
    setState(s => {
      pushConfig(s.accounts, merged, user.id)
        .then(markSynced)
        .catch(err => {
          console.error('Settings sync failed:', err)
          setState(s2 => ({ ...s2, settings: prev }))
          markError(err)
        })
      return s
    })
  }, [user, markSyncing, markSynced, markError])

  const toggleTheme = () => {
    updateSettings({ theme: state.settings.theme === 'dark' ? 'light' : 'dark' })
  }

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
        // Optimistic local update
        setState(data)
        if (!user) return
        markSyncing()
        try {
          await replaceAllTrades(data.trades || [], user.id)
          await pushConfig(data.accounts, data.settings, user.id)
          markSynced()
        } catch (err) {
          console.error('Import sync failed:', err)
          markError(err)
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

    const props = { state, openEditTrade: openViewTrade, deleteTrade: deleteTradeHandler, updateAccounts, updateSettings }
    switch (page) {
      case 'dashboard': return <Dashboard {...props} />
      case 'calendar': return <CalendarPage {...props} />
      case 'tradelog': return <TradeLog {...props} />
      case 'analytics': return <Analytics {...props} />
      case 'accounts': return <Accounts {...props} />
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
        <div className="opacity-90 text-xs">{syncError.message}. Change reverted.</div>
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
              onSave={editTrade ? updateTrade : addTrade}
              onClose={() => { setShowModal(false); setEditTrade(null) }}
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
          <button onClick={() => exportData(state)} className="p-2 rounded-lg transition-colors border-0 cursor-pointer" style={{ color: 'var(--text-muted)', background: 'transparent' }} title="Export">
            <Download size={16} />
          </button>
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
            onSave={editTrade ? updateTrade : addTrade}
            onClose={() => { setShowModal(false); setEditTrade(null) }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
