import { NavLink } from 'react-router-dom'
import {
  Bell,
  Bot,
  ChevronRight,
  Database,
  FolderKanban,
  LayoutDashboard,
  Radar,
  Sparkles,
  X,
  type LucideIcon
} from 'lucide-react'
import type { SourcesResponse } from '../lib/types'
import { relativeTime } from '../lib/format'
import { useApp } from '../context/AppContext'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  badge?: 'alerts'
  tag?: string
}

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: '工作台',
    items: [
      { to: '/', label: '总览', icon: LayoutDashboard, end: true },
      { to: '/trends', label: '趋势雷达', icon: Radar },
      { to: '/library', label: '项目库', icon: FolderKanban }
    ]
  },
  {
    label: '自动化',
    items: [
      { to: '/alerts', label: '智能预警', icon: Bell, badge: 'alerts' },
      { to: '/assistant', label: 'AI 研究助手', icon: Sparkles, tag: 'RAG' }
    ]
  },
  {
    label: '系统',
    items: [{ to: '/sources', label: '数据源', icon: Database }]
  }
]

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 36 36" fill="none">
        <rect x="1" y="1" width="34" height="34" rx="10" fill="#0d1410" stroke="rgba(200,255,92,.24)" />
        <path d="M10 24V17M16 24V12M22 24V15M28 24V9" stroke="#c8ff5c" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="28" cy="9" r="2.7" fill="#c8ff5c" />
        <circle cx="28" cy="9" r="5.4" stroke="#c8ff5c" strokeOpacity=".25" />
      </svg>
    </span>
  )
}

export function Sidebar({
  sources,
  mobileOpen,
  onClose
}: {
  sources: SourcesResponse | null
  mobileOpen: boolean
  onClose: () => void
}) {
  const { unreadAlerts } = useApp()
  const github = sources?.github
  const statusLabel = github?.running
    ? '正在同步趋势'
    : github?.mode === 'live'
      ? 'GitHub 实时数据'
      : '趋势基线 · 演示'
  const statusTone = github?.running ? 'syncing' : github?.mode === 'live' ? 'live' : 'demo'

  return (
    <>
      <div
        className={`sidebar-scrim ${mobileOpen ? 'is-visible' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className={`sidebar ${mobileOpen ? 'is-open' : ''}`}>
        <div className="sidebar-top">
          <NavLink to="/" className="brand" onClick={onClose}>
            <BrandMark />
            <span className="brand-copy">
              <span className="brand-name">Git Trend</span>
              <span className="brand-sub">M O N I T O R</span>
            </span>
          </NavLink>
          <button className="mobile-close" type="button" onClick={onClose} aria-label="关闭导航">
            <X size={18} />
          </button>
        </div>

        <div className="workspace-card">
          <span className="workspace-avatar">L</span>
          <span className="workspace-copy">
            <strong>个人工作区</strong>
            <small>Trend Research · Pro</small>
          </span>
          <span className="workspace-dot" />
        </div>

        <nav className="sidebar-nav" aria-label="主导航">
          {navGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <div className="nav-group-label">{group.label}</div>
              {group.items.map((item) => {
                const Icon = item.icon
                const badge = item.badge === 'alerts' ? unreadAlerts : 0
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={onClose}
                    className={({ isActive }) => `nav-item ${isActive ? 'is-active' : ''}`}
                  >
                    <Icon size={17} strokeWidth={1.9} />
                    <span>{item.label}</span>
                    {item.tag && <span className="nav-tag">{item.tag}</span>}
                    {item.badge === 'alerts' && badge > 0 && (
                      <span className="nav-badge">{badge > 9 ? '9+' : badge}</span>
                    )}
                  </NavLink>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-spacer" />

        <NavLink to="/sources" className={`source-status tone-${statusTone}`}>
          <span className="source-status-head">
            <span className="status-orb" />
            <span>{statusLabel}</span>
            <ChevronRight size={14} />
          </span>
          <span className="source-status-meta">
            {github?.running
              ? '正在拉取最新仓库快照'
              : `${github ? `${github.intervalMinutes} 分钟自动同步` : '正在读取数据源状态'}`}
          </span>
          <span className="source-status-meta">
            {github?.lastSyncAt ? `上次同步 ${relativeTime(github.lastSyncAt)}` : '初始化中'}
          </span>
        </NavLink>

        <div className="sidebar-footer">
          <div className="user-chip">
            <span className="user-avatar">LT</span>
            <span className="user-meta">
              <strong>Lin Tao</strong>
              <small>趋势研究员</small>
            </span>
            <Bot size={16} className="sidebar-bot" />
          </div>
          <div className="build-note">
            <span>GTM / v1.0</span>
            <span className="build-dot" />
            <span>BUILD 1019</span>
          </div>
        </div>
      </aside>
    </>
  )
}
