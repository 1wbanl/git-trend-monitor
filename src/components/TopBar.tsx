import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Bell,
  Inbox,
  Menu,
  RefreshCw,
  Search,
  Sparkles
} from 'lucide-react'
import { api } from '../lib/api'
import type { AlertsResponse, SourcesResponse } from '../lib/types'
import { relativeTime, severityLabel } from '../lib/format'
import { useApp } from '../context/AppContext'
import { Spinner } from './ui'

export function TopBar({
  sources,
  syncing,
  onSync,
  onOpenNav
}: {
  sources: SourcesResponse | null
  syncing: boolean
  onSync: () => void
  onOpenNav: () => void
}) {
  const navigate = useNavigate()
  const { setCommandOpen, unreadAlerts, refreshAlertCount, toast } = useApp()
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [alerts, setAlerts] = useState<AlertsResponse | null>(null)
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!notificationsOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [notificationsOpen])

  const openNotifications = async () => {
    const next = !notificationsOpen
    setNotificationsOpen(next)
    if (!next) return
    setNotificationsLoading(true)
    try {
      const response = await api.alerts()
      setAlerts(response)
    } catch {
      toast('信号收件箱读取失败，请稍后重试', 'error')
    } finally {
      setNotificationsLoading(false)
    }
  }

  const markAllRead = async () => {
    try {
      await api.markEventsRead()
      setAlerts((current) =>
        current
          ? {
              ...current,
              events: current.events.map((event) => ({ ...event, read: true })),
              stats: { ...current.stats, unread: 0 }
            }
          : current
      )
      await refreshAlertCount()
      toast('已把全部信号标记为已读')
    } catch {
      toast('操作失败，请稍后重试', 'error')
    }
  }

  const github = sources?.github
  const isLive = github?.mode === 'live'

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="icon-button mobile-menu-button" type="button" onClick={onOpenNav} aria-label="打开导航">
          <Menu size={19} />
        </button>
        <button className="search-trigger" type="button" onClick={() => setCommandOpen(true)}>
          <Search size={16} />
          <span className="search-placeholder">搜索项目、主题或信号</span>
          <span className="search-shortcut">
            <span>⌘</span>K
          </span>
        </button>
      </div>

      <div className="topbar-right">
        <div className={`sync-status ${isLive ? 'is-live' : 'is-demo'}`}>
          <span className="sync-dot" />
          <span>{github?.running ? '正在同步' : isLive ? '实时数据已连接' : '趋势基线'}</span>
          <span className="sync-time">
            {github?.lastSyncAt ? relativeTime(github.lastSyncAt) : '初始化中'}
          </span>
        </div>

        <button
          className={`icon-button sync-button ${syncing ? 'is-spinning' : ''}`}
          type="button"
          onClick={onSync}
          disabled={syncing || github?.running}
          title="立即同步 GitHub 趋势"
          aria-label="立即同步 GitHub 趋势"
        >
          {syncing ? <Spinner size={16} /> : <RefreshCw size={16.5} />}
        </button>

        <div className="notification-wrap" ref={panelRef}>
          <button
            className={`icon-button notification-button ${notificationsOpen ? 'is-active' : ''}`}
            type="button"
            onClick={openNotifications}
            aria-label={`信号收件箱${unreadAlerts ? `，${unreadAlerts} 条未读` : ''}`}
          >
            <Bell size={17.5} />
            {unreadAlerts > 0 && <span className="notification-badge">{unreadAlerts > 9 ? '9+' : unreadAlerts}</span>}
          </button>

          {notificationsOpen && (
            <div className="notification-panel">
              <div className="notification-head">
                <div>
                  <span className="eyebrow-mini">SIGNAL INBOX</span>
                  <h3>信号收件箱</h3>
                </div>
                <button type="button" className="text-link small" onClick={markAllRead} disabled={!alerts?.stats.unread}>
                  全部已读
                </button>
              </div>

              {notificationsLoading && !alerts ? (
                <div className="notification-loading">
                  <Spinner size={18} />
                  正在读取最新信号…
                </div>
              ) : alerts?.events.length ? (
                <div className="notification-list">
                  {alerts.events.slice(0, 4).map((event) => (
                    <button
                      type="button"
                      key={event.id}
                      className={`notification-item ${event.read ? 'is-read' : ''}`}
                      onClick={() => {
                        setNotificationsOpen(false)
                        navigate('/alerts')
                      }}
                    >
                      <span className={`severity-dot severity-${event.severity}`} />
                      <span className="notification-copy">
                        <span className="notification-title">{event.title}</span>
                        <span className="notification-meta">
                          {event.projectName || '系统信号'} · {relativeTime(event.createdAt)}
                        </span>
                      </span>
                      <span className={`severity-tag severity-${event.severity}`}>{severityLabel(event.severity)}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="notification-loading">
                  <Inbox size={19} />
                  暂时没有新信号
                </div>
              )}

              <button
                className="notification-footer"
                type="button"
                onClick={() => {
                  setNotificationsOpen(false)
                  navigate('/alerts')
                }}
              >
                查看全部智能预警
                <ArrowRight size={14} />
              </button>
            </div>
          )}
        </div>

        <button className="profile-button" type="button" onClick={() => navigate('/sources')} title="工作区设置">
          <span className="profile-avatar">LT</span>
          <span className="profile-status" />
        </button>
      </div>
    </header>
  )
}
