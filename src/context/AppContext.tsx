import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, CircleAlert, Info, X } from 'lucide-react'
import { api } from '../lib/api'

type ToastTone = 'success' | 'error' | 'info'

interface ToastItem {
  id: string
  message: string
  tone: ToastTone
}

interface AppContextValue {
  openProject: (id: string) => void
  closeProject: () => void
  activeProjectId: string | null
  commandOpen: boolean
  setCommandOpen: (open: boolean) => void
  toast: (message: string, tone?: ToastTone) => void
  projectRevision: number
  bumpProjects: () => void
  unreadAlerts: number
  refreshAlertCount: () => Promise<void>
  askAi: (prompt: string) => void
  pendingPrompt: string | null
  consumePendingPrompt: () => string | null
}

const AppContext = createContext<AppContextValue | null>(null)

export function useApp(): AppContextValue {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used inside AppProvider')
  return context
}

export function AppProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [commandOpen, setCommandOpen] = useState(false)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [projectRevision, setProjectRevision] = useState(0)
  const [unreadAlerts, setUnreadAlerts] = useState(0)
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null)
  const timers = useRef<Record<string, number>>({})

  const toast = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    setToasts((current) => [...current.slice(-2), { id, message, tone }])
    timers.current[id] = window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id))
      delete timers.current[id]
    }, 3800)
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id))
    if (timers.current[id]) {
      window.clearTimeout(timers.current[id])
      delete timers.current[id]
    }
  }, [])

  useEffect(
    () => () => {
      Object.values(timers.current).forEach((timer) => window.clearTimeout(timer))
    },
    []
  )

  const refreshAlertCount = useCallback(async () => {
    try {
      const response = await api.alerts()
      setUnreadAlerts(response.stats.unread)
    } catch {
      // The badge is non-critical; keep the previous value on failure.
    }
  }, [])

  useEffect(() => {
    refreshAlertCount()
    const timer = window.setInterval(refreshAlertCount, 60_000)
    return () => window.clearInterval(timer)
  }, [refreshAlertCount])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const editing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandOpen(true)
      } else if (event.key === 'Escape' && !editing) {
        setCommandOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const openProject = useCallback((id: string) => setActiveProjectId(id), [])
  const closeProject = useCallback(() => setActiveProjectId(null), [])
  const bumpProjects = useCallback(() => setProjectRevision((value) => value + 1), [])
  const askAi = useCallback(
    (prompt: string) => {
      setPendingPrompt(prompt)
      setActiveProjectId(null)
      navigate('/assistant')
    },
    [navigate]
  )
  const consumePendingPrompt = useCallback(() => {
    const prompt = pendingPrompt
    setPendingPrompt(null)
    return prompt
  }, [pendingPrompt])

  const value = useMemo<AppContextValue>(
    () => ({
      openProject,
      closeProject,
      activeProjectId,
      commandOpen,
      setCommandOpen,
      toast,
      projectRevision,
      bumpProjects,
      unreadAlerts,
      refreshAlertCount,
      askAi,
      pendingPrompt,
      consumePendingPrompt
    }),
    [
      openProject,
      closeProject,
      activeProjectId,
      commandOpen,
      toast,
      projectRevision,
      bumpProjects,
      unreadAlerts,
      refreshAlertCount,
      askAi,
      pendingPrompt,
      consumePendingPrompt
    ]
  )

  return (
    <AppContext.Provider value={value}>
      {children}
      <div className="toast-viewport" aria-live="polite" aria-atomic="true">
        {toasts.map((item) => (
          <div className={`toast toast-${item.tone}`} key={item.id}>
            <span className="toast-icon">
              {item.tone === 'success' ? (
                <Check size={14} strokeWidth={2.6} />
              ) : item.tone === 'error' ? (
                <CircleAlert size={15} />
              ) : (
                <Info size={15} />
              )}
            </span>
            <span>{item.message}</span>
            <button type="button" onClick={() => dismissToast(item.id)} aria-label="关闭提示">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </AppContext.Provider>
  )
}
