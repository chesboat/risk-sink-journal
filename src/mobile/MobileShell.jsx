import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  LayoutDashboard,
  Calendar,
  PenLine,
  BarChart3,
  Users,
  Plus,
  Moon,
  Sun,
  Cloud,
  CloudOff,
  LogOut,
  Monitor,
  Download,
  History,
} from 'lucide-react'
import { exportData } from '../lib/store'
import { listSnapshots, downloadSnapshot } from '../lib/backup'
import MobileDashboard from './MobileDashboard'
import MobileCalendar from './MobileCalendar'
import MobileTradeLog from './MobileTradeLog'
import MobileAnalytics from './MobileAnalytics'
import MobileAccounts from './MobileAccounts'
import MobileTradeDetail from './MobileTradeDetail'

const NAV = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'tradelog', label: 'Log', icon: PenLine },
  { id: 'analytics', label: 'Stats', icon: BarChart3 },
  { id: 'accounts', label: 'Accounts', icon: Users },
]

const PAGE_TITLES = {
  dashboard: 'Dashboard',
  calendar: 'Calendar',
  tradelog: 'Trade Log',
  analytics: 'Analytics',
  accounts: 'Accounts',
}

export default function MobileShell({
  state,
  openNewTrade,
  openEditTrade,
  deleteTrade,
  updateAccounts,
  updateSettings,
  toggleTheme,
  syncStatus,
  supabaseConfigured,
  user,
  signOut,
  forceDesktop,
}) {
  const [page, setPage] = useState('dashboard')
  const [viewTrade, setViewTrade] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const isLight = state.settings.theme === 'light'

  const openViewTrade = (trade) => setViewTrade(trade)
  const closeDetailView = () => setViewTrade(null)

  // Re-fetch viewed trade from state so edits propagate live
  const freshViewTrade =
    viewTrade ? state.trades.find((t) => t.id === viewTrade.id) || viewTrade : null

  const renderPage = () => {
    const props = { state, openViewTrade }
    switch (page) {
      case 'dashboard':
        return <MobileDashboard {...props} />
      case 'calendar':
        return <MobileCalendar {...props} />
      case 'tradelog':
        return <MobileTradeLog {...props} />
      case 'analytics':
        return <MobileAnalytics {...props} />
      case 'accounts':
        return <MobileAccounts state={state} updateAccounts={updateAccounts} updateSettings={updateSettings} />
      default:
        return <MobileDashboard {...props} />
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: 'var(--bg)',
        color: 'var(--text)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* Header */}
      {!freshViewTrade && (
        <header
          className="sticky top-0 z-30 px-4 py-3 flex items-center justify-between border-b"
          style={{
            background: 'var(--bg)',
            borderColor: 'var(--border)',
            paddingTop: 'calc(env(safe-area-inset-top) + 12px)',
          }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-[8px] flex items-center justify-center font-mono font-bold text-[11px] text-white keep-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, var(--blue), var(--purple))' }}
            >
              RS
            </div>
            <div className="text-base font-bold" style={{ color: 'var(--text)' }}>
              {PAGE_TITLES[page]}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {supabaseConfigured && (
              <div className="p-1.5" title={syncStatus}>
                {syncStatus === 'offline' ? (
                  <CloudOff size={14} style={{ color: 'var(--text-muted)' }} />
                ) : (
                  <Cloud
                    size={14}
                    style={{ color: syncStatus === 'synced' ? 'var(--green)' : 'var(--orange)' }}
                    className={syncStatus === 'syncing' ? 'animate-pulse' : ''}
                  />
                )}
              </div>
            )}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg border-0 cursor-pointer"
              style={{ background: 'transparent', color: 'var(--text-dim)' }}
            >
              {isLight ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              onClick={() => setMenuOpen(true)}
              className="p-2 rounded-lg border-0 cursor-pointer"
              style={{ background: 'transparent', color: 'var(--text-dim)' }}
              aria-label="More"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="3" cy="8" r="1.5" />
                <circle cx="8" cy="8" r="1.5" />
                <circle cx="13" cy="8" r="1.5" />
              </svg>
            </button>
          </div>
        </header>
      )}

      {/* Page content */}
      <main className="flex-1">
        <AnimatePresence mode="wait">
          {freshViewTrade ? (
            <motion.div
              key={`detail-${freshViewTrade.id}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <MobileTradeDetail
                trade={freshViewTrade}
                onBack={closeDetailView}
                onEdit={(t) => {
                  openEditTrade(t)
                }}
                onDelete={(id) => {
                  deleteTrade(id)
                  closeDetailView()
                }}
              />
            </motion.div>
          ) : (
            <motion.div
              key={page}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              {renderPage()}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Floating + button */}
      {!freshViewTrade && (
        <motion.button
          onClick={openNewTrade}
          whileTap={{ scale: 0.92 }}
          className="fixed z-40 rounded-full flex items-center justify-center border-0 text-white keep-white cursor-pointer"
          style={{
            bottom: 'calc(env(safe-area-inset-bottom) + 70px)',
            right: 16,
            width: 54,
            height: 54,
            background: 'linear-gradient(135deg, var(--blue), var(--purple))',
            boxShadow: '0 6px 20px rgba(10,132,255,0.4)',
          }}
        >
          <Plus size={24} />
        </motion.button>
      )}

      {/* Bottom nav */}
      {!freshViewTrade && (
        <nav
          className="fixed left-0 right-0 bottom-0 z-30 border-t"
          style={{
            background: 'var(--surface)',
            borderColor: 'var(--border)',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          <div className="flex items-stretch">
            {NAV.map(({ id, label, icon: Icon }) => {
              const active = page === id
              return (
                <button
                  key={id}
                  onClick={() => setPage(id)}
                  className="flex-1 flex flex-col items-center justify-center py-2 cursor-pointer border-0 bg-transparent"
                  style={{
                    color: active ? 'var(--blue)' : 'var(--text-muted)',
                    minHeight: 56,
                  }}
                >
                  <Icon size={20} />
                  <span
                    className="text-[10px] font-semibold mt-0.5"
                    style={{ color: active ? 'var(--blue)' : 'var(--text-muted)' }}
                  >
                    {label}
                  </span>
                </button>
              )
            })}
          </div>
        </nav>
      )}

      {/* More menu sheet */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              style={{ background: 'rgba(0,0,0,0.55)' }}
              onClick={() => setMenuOpen(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed left-0 right-0 bottom-0 z-50 rounded-t-3xl overflow-hidden"
              style={{
                background: 'var(--surface)',
                borderTop: '1px solid var(--border)',
                paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)',
              }}
            >
              <div className="flex justify-center pt-2 pb-1">
                <div
                  className="w-10 h-1 rounded-full"
                  style={{ background: 'var(--text-muted)', opacity: 0.4 }}
                />
              </div>
              <div className="p-4 space-y-1">
                {user && (
                  <div
                    className="px-3 py-2 text-xs"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {user.email}
                  </div>
                )}
                <button
                  onClick={() => {
                    exportData(state)
                    setMenuOpen(false)
                  }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer border-0 text-left"
                  style={{ background: 'var(--card)', color: 'var(--text)' }}
                >
                  <Download size={16} />
                  <span className="text-sm font-medium">Export backup (JSON)</span>
                </button>
                {user && (() => {
                  const snaps = listSnapshots(user.id)
                  return (
                    <button
                      onClick={() => {
                        if (snaps.length === 0) { alert('No local snapshots yet — one is saved automatically each day you open the journal.'); return }
                        downloadSnapshot(snaps[0])
                        setMenuOpen(false)
                      }}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer border-0 text-left"
                      style={{ background: 'var(--card)', color: 'var(--text)' }}
                    >
                      <History size={16} />
                      <span className="text-sm font-medium">
                        Download latest snapshot
                        {snaps.length > 0 && (
                          <span className="opacity-50"> ({snaps[0].date})</span>
                        )}
                      </span>
                    </button>
                  )
                })()}
                <button
                  onClick={() => {
                    setMenuOpen(false)
                    forceDesktop()
                  }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer border-0 text-left"
                  style={{ background: 'var(--card)', color: 'var(--text)' }}
                >
                  <Monitor size={16} />
                  <span className="text-sm font-medium">Switch to desktop view</span>
                </button>
                {user && (
                  <button
                    onClick={() => {
                      if (confirm('Sign out?')) {
                        setMenuOpen(false)
                        signOut()
                      }
                    }}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer border-0 text-left"
                    style={{ background: 'var(--card)', color: 'var(--red)' }}
                  >
                    <LogOut size={16} />
                    <span className="text-sm font-medium">Sign out</span>
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
