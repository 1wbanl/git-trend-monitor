import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  CornerDownLeft,
  Database,
  FolderKanban,
  LayoutDashboard,
  Radar,
  Search,
  Sparkles
} from 'lucide-react'
import { api } from '../lib/api'
import { compactCount, categoryColor } from '../lib/format'
import { useApp } from '../context/AppContext'

const quickLinks = [
  { to: '/', label: '总览', hint: '趋势全景仪表盘', icon: LayoutDashboard },
  { to: '/trends', label: '趋势雷达', hint: '机会象限与项目发现', icon: Radar },
  { to: '/library', label: '项目库', hint: '跟踪与项目管理', icon: FolderKanban },
  { to: '/alerts', label: '智能预警', hint: '规则与信号记录', icon: Bell },
  { to: '/assistant', label: 'AI 研究助手', hint: 'RAG 知识库问答', icon: Sparkles },
  { to: '/sources', label: '数据源', hint: 'GitHub 同步与索引状态', icon: Database }
]

const suggestions = ['本地部署的 AI 项目', 'Agent 框架', 'RAG 知识库工具', '最近增长最快的项目']

export function CommandPalette() {
  const navigate = useNavigate()
  const { commandOpen, setCommandOpen, openProject } = useApp()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<
    { id: string; fullName: string; category: string; stars: number; languageColor: string }[]
  >([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!commandOpen) return
    setQuery('')
    setResults([])
    const timer = window.setTimeout(() => inputRef.current?.focus(), 40)
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCommandOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    document.body.classList.add('modal-open')
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('keydown', handleKey)
      document.body.classList.remove('modal-open')
    }
  }, [commandOpen, setCommandOpen])

  useEffect(() => {
    if (!commandOpen) return
    const trimmed = query.trim()
    if (!trimmed) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    const timer = window.setTimeout(async () => {
      try {
        const response = await api.search(trimmed)
        setResults(response.items)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 180)
    return () => window.clearTimeout(timer)
  }, [query, commandOpen])

  if (!commandOpen) return null

  const go = (to: string) => {
    setCommandOpen(false)
    navigate(to)
  }

  const openFirst = () => {
    if (results[0]) {
      setCommandOpen(false)
      openProject(results[0].id)
    } else if (query.trim()) {
      setCommandOpen(false)
      navigate(`/trends?q=${encodeURIComponent(query.trim())}`)
    }
  }

  return (
    <div className="command-backdrop" onMouseDown={() => setCommandOpen(false)}>
      <div
        className="command-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="全局搜索"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="command-input-row">
          <Search size={19} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') openFirst()
            }}
            placeholder="搜索项目、技术主题或快速前往…"
            aria-label="搜索"
          />
          <kbd>ESC</kbd>
        </div>

        <div className="command-content">
          {!query.trim() ? (
            <>
              <div className="command-label">快速前往</div>
              <div className="command-grid">
                {quickLinks.map((link) => {
                  const Icon = link.icon
                  return (
                    <button type="button" className="command-link" key={link.to} onClick={() => go(link.to)}>
                      <span className="command-link-icon">
                        <Icon size={16} />
                      </span>
                      <span>
                        <strong>{link.label}</strong>
                        <small>{link.hint}</small>
                      </span>
                      <CornerDownLeft size={13} className="command-enter" />
                    </button>
                  )
                })}
              </div>
              <div className="command-label">试着搜搜看</div>
              <div className="command-suggestions">
                {suggestions.map((item) => (
                  <button type="button" key={item} onClick={() => setQuery(item)}>
                    {item}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="command-label">
                {loading ? '正在检索…' : results.length ? `匹配到 ${results.length} 个项目` : '没有找到匹配项目'}
              </div>
              {results.length > 0 ? (
                <div className="command-results">
                  {results.map((project) => (
                    <button
                      type="button"
                      className="command-result"
                      key={project.id}
                      onClick={() => {
                        setCommandOpen(false)
                        openProject(project.id)
                      }}
                    >
                      <span
                        className="command-result-dot"
                        style={{ background: categoryColor(project.category) }}
                      />
                      <span className="command-result-name">{project.fullName}</span>
                      <span className="command-result-category">{project.category}</span>
                      <span className="command-result-stars">{compactCount(project.stars)} ★</span>
                    </button>
                  ))}
                </div>
              ) : (
                <button type="button" className="command-empty" onClick={openFirst}>
                  在趋势雷达中搜索「{query}」
                </button>
              )}
            </>
          )}
        </div>

        <div className="command-footer">
          <span>
            <CornerDownLeft size={12} /> 打开第一项
          </span>
          <span>ESC 关闭</span>
          <span className="command-footer-brand">GIT TREND MONITOR</span>
        </div>
      </div>
    </div>
  )
}
