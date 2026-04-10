import { useState, useEffect } from 'react'

const MOBILE_BREAKPOINT = 768
const DESKTOP_OVERRIDE_KEY = 'rs-force-desktop'

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    if (localStorage.getItem(DESKTOP_OVERRIDE_KEY) === '1') return false
    return window.innerWidth < MOBILE_BREAKPOINT
  })

  useEffect(() => {
    const onResize = () => {
      if (localStorage.getItem(DESKTOP_OVERRIDE_KEY) === '1') {
        setIsMobile(false)
        return
      }
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const forceDesktop = () => {
    localStorage.setItem(DESKTOP_OVERRIDE_KEY, '1')
    setIsMobile(false)
  }

  const clearDesktopOverride = () => {
    localStorage.removeItem(DESKTOP_OVERRIDE_KEY)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
  }

  return { isMobile, forceDesktop, clearDesktopOverride }
}
