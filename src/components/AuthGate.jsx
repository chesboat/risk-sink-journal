import { motion } from 'framer-motion'
import { signInWithGoogle } from '../lib/supabase'

export default function AuthGate() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--bg)' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        <div
          className="rounded-2xl p-10 text-center"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}
        >
          {/* Logo */}
          <div
            className="w-16 h-16 mx-auto mb-5 rounded-2xl flex items-center justify-center font-mono font-bold text-xl text-white keep-white"
            style={{ background: 'linear-gradient(135deg, var(--blue), var(--purple))' }}
          >
            RS
          </div>

          <h1
            className="text-2xl font-bold mb-2"
            style={{ color: 'var(--text)' }}
          >
            Risk Sink Journal
          </h1>
          <p
            className="text-sm mb-8"
            style={{ color: 'var(--text-muted)' }}
          >
            Sign in to access your trading journal
          </p>

          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl font-semibold text-sm cursor-pointer transition-all hover:scale-[1.02]"
            style={{
              background: '#fff',
              color: '#1a1a1a',
              border: '1px solid var(--border)',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
          </button>

          <p
            className="text-xs mt-6"
            style={{ color: 'var(--text-muted)' }}
          >
            Your trades are private to your account
          </p>
        </div>
      </motion.div>
    </div>
  )
}
