import { useState, useEffect, useCallback, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { LayoutDashboard, Calendar, PenLine, BarChart3, Users, Moon, Sun, Plus, Download, Upload, Cloud, CloudOff } from 'lucide-react'
import { loadState, saveState, getDefaultState, createTrade, exportData, importData } from './lib/store'
import { isSupabaseConfigured, pullState, pushState, pushTrade, pushConfig, deleteTrade as supaDeleteTrade } from './lib/supabase'
import Dashboard from './pages/Dashboard'
import CalendarPage from './pages/CalendarPage'
import TradeLog from './pages/TradeLog'
import Analytics from './pages/Analytics'
import Accounts from './pages/Accounts'
import TradeModal from './components/TradeModal'

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
  transition: { duration: 0.25, ease: 'easeOut' },
}

export default function App() {
  const [state, setState] = useState(loadState)
  const [page, setPage] = useState('dashboard')
  const [showModal, setShowModal] = useState(false)
  const [editTrade, setEditTrade] = useState(null)
  const [sidebarHover, setSidebarHover] = useState(false)

  // Save on state change
  useEffect(() => { saveState(state) }, [state])

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
  }, [])

  const updateTrade = useCallback((trade) => {
    setState(s => ({ ...s, trades: s.trades.map(t => t.id === trade.id ? trade : t) }))
    setShowModal(false)
    setEditTrade(null)
  }, [])

  const deleteTrade = useCallback((id) => {
    setState(s => ({ ...s, trades: s.trades.filter(t => t.id !== id) }))
  }, [])

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

  const openEditTrade = (trade) => {
    setEditTrade(trade)
    setShowModal(true)
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
    const props = { state, openEditTrade, deleteTrade, updateAccounts, updateSettings }
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
          <div className="w-8 h-8 rounded-[10px] flex-shrink-0 flex items-center justify-center font-mono font-bold text-sm text-white"
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
            onClick={() => setPage(id)}
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
          <button onClick={() => exportData(state)} className="p-2 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }} title="Export">
            <Download size={16} />
          </button>
          <button onClick={handleImport} className="p-2 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }} title="Import">
            <Upload size={16} />
          </button>
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
          <motion.div key={page} {...pageTransition}>
            {renderPage()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Floating New Trade Button */}
      <motion.button
        onClick={openNewTrade}
        className="fixed bottom-7 right-8 z-40 flex items-center gap-2 px-6 py-3.5 rounded-2xl text-white font-semibold text-sm cursor-pointer border-0"
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
