import { useState, useEffect, useCallback, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { LayoutDashboard, Calendar, PenLine, BarChart3, Users, Moon, Sun, Plus, Download, Upload, Cloud, CloudOff, LogOut } from 'lucide-react'
import { loadState, saveState, getDefaultState, createTrade, exportData, importData } from './lib/store'
import { isSupabaseConfigured, pullState, pushState, pushTrade, pushConfig, deleteTrade as supaDeleteTrade, getCurrentUser, onAuthChange, signOut } from './lib/supabase'
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
  const [state, setState] = useState(loadState)
  const [page, setPage] = useState('dashboard')
  const [showModal, setShowModal] = useState(false)
  const [editTrade, setEditTrade] = useState(null)
  const [viewTrade, setViewTrade] = useState(null)
  const [prevPage, setPrevPage] = useState(null)
  const [sidebarHover, setSidebarHover] = useState(false)
  const [syncStatus, setSyncStatus] = useState(isSupabaseConfigured() ? 'syncing' : 'offline') // 'synced' | 'syncing' | 'offline'
  const [user, setUser] = useState(null)
  const [authChecked, setAuthChecked] = useState(!isSupabaseConfigured())
  const isInitialSync = useRef(true)

  // Save to localStorage on every state change
  useEffect(() => { saveState(state) }, [state])

  // Auth: check current session + subscribe to changes
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
        // Signed out — reset to empty defaults so next user doesn't see stale data
        isInitialSync.current = true
        setState(getDefaultState())
      }
    })
    return unsub
  }, [])

  // Supabase: pull on mount (once user is known), merge with local
  useEffect(() => {
    if (!isSupabaseConfigured() || !user) return
    isInitialSync.current = true
    setSyncStatus('syncing')
    pullState(user.id).then(remote => {
      if (!remote) { setSyncStatus('offline'); isInitialSync.current = false; return }
      setState(prev => {
        const defaults = getDefaultState()
        // Merge trades: remote wins for duplicates, keep unique locals
        const remoteIds = new Set((remote.trades || []).map(t => t.id))
        const uniqueLocal = prev.trades.filter(t => !remoteIds.has(t.id))
        const mergedTrades = [...(remote.trades || []), ...uniqueLocal]
        // Sort by date descending
        mergedTrades.sort((a, b) => new Date(b.date) - new Date(a.date) || b.createdAt - a.createdAt)

        return {
          trades: mergedTrades,
          accounts: remote.accounts || prev.accounts || defaults.accounts,
          settings: { ...defaults.settings, ...(remote.settings || prev.settings) },
        }
      })
      setSyncStatus('synced')
      isInitialSync.current = false
    })
  }, [user])

  // Supabase: push full state after initial sync merges
  useEffect(() => {
    if (!isSupabaseConfigured() || !user || isInitialSync.current) return
    const timeout = setTimeout(() => {
      setSyncStatus('syncing')
      pushState(state, user.id).then(() => setSyncStatus('synced')).catch(() => setSyncStatus('offline'))
    }, 1000) // debounce 1s
    return () => clearTimeout(timeout)
  }, [state, user])

  // Theme
  useEffect(() => {
    if (state.settings.theme === 'light') {
      document.body.classList.add('light')
    } else {
      document.body.classList.remove('light')
    }
  }, [state.settings.theme])

  const toggleTheme = () => {
    setState(s => ({ ...s, settings: { ...s.settings, theme: s.settings.theme === 'dark' ? 'light' : 'dark' } }))
  }

  // Trade CRUD
  const addTrade = useCallback((trade) => {
    setState(s => ({ ...s, trades: [...s.trades, trade] }))
    setShowModal(false)
    setEditTrade(null)
    // If we were in detail view, stay there but clear stale ref
    // If not, viewTrade is already null so this is a no-op
  }, [])

  const updateTrade = useCallback((trade) => {
    setState(s => ({ ...s, trades: s.trades.map(t => t.id === trade.id ? trade : t) }))
    setShowModal(false)
    setEditTrade(null)
    // Update the viewTrade ref so detail view shows fresh data
    setViewTrade(prev => prev?.id === trade.id ? trade : prev)
  }, [])

  const deleteTradeHandler = useCallback((id) => {
    setState(s => ({ ...s, trades: s.trades.filter(t => t.id !== id) }))
    if (user) supaDeleteTrade(id, user.id) // fire and forget
  }, [user])

  const updateAccounts = useCallback((accounts) => {
    setState(s => ({ ...s, accounts }))
  }, [])

  const updateSettings = useCallback((settings) => {
    setState(s => ({ ...s, settings: { ...s.settings, ...settings } }))
  }, [])

  const openNewTrade = () => {
    setEditTrade(null)
    setShowModal(true)
  }

  // Click a trade → full-page detail view
  const openViewTrade = (trade) => {
    setPrevPage(page)
    setViewTrade(trade)
  }

  // Edit button inside detail view → open modal
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
        setState(data)
      } catch (err) {
        alert('Failed to import: ' + err.message)
      }
    }
    input.click()
  }

  const renderPage = () => {
    // If viewing a trade detail, show it instead of any page
    if (viewTrade) {
      // Re-fetch from state in case it was just edited
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

  // Auth gate: if Supabase is configured, require login
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

  // Mobile layout — separate component tree, same state
  if (isMobile) {
    return (
      <>
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
            <div className="p-2" title={syncStatus === 'synced' ? 'Synced to cloud' : syncStatus === 'syncing' ? 'Syncing...' : 'Offline — local only'}>
              {syncStatus === 'offline' ? (
                <CloudOff size={16} style={{ color: 'var(--text-muted)' }} />
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
