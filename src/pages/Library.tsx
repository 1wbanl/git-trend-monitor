import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowUpRight,
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FolderKanban,
  Search,
  X
} from 'lucide-react'
import { api } from '../lib/api'
import { useApiData } from '../lib/useApiData'
import { useApp } from '../context/AppContext'
import type { Project } from '../lib/types'
import {
  categoryColor,
  compactCount,
  relativeTime,
  signedPct,
  statusTone
} from '../lib/format'
import {
  CategoryPill,
  EmptyState,
  ProjectAvatar,
  Skeleton,
  Sparkline,
  Spinner,
  Toggle
} from '../components/ui'

const statusTabs = [
  { key: 'all', label: '全部状态' },
  { key: '重点关注', label: '重点关注' },
  { key: '观察中', label: '观察中' },
  { key: '评估中', label: '评估中' },
  { key: 'untracked', label: '未跟踪' }
]

const PAGE_SIZE = 15

function csvCell(value: string | number | null | undefined): string {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

function LibrarySkeleton() {
  return (
    <div className="page page-library">
      <div className="page-header">
        <div>
          <Skeleton width={250} height={12} />
          <Skeleton width={380} height={42} style={{ marginTop: 17 }} />
        </div>
      </div>
      <div className="library-summary">
        <Skeleton width={220} height={55} />
        <Skeleton width={160} height={55} />
        <Skeleton width={160} height={55} />
      </div>
      <Skeleton width="100%" height={620} style={{ marginTop: 22 }} />
    </div>
  )
}

export default function LibraryPage() {
  const { toast, projectRevision, bumpProjects, openProject } = useApp()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState('trending')
  const [page, setPage] = useState(1)
  const [pending, setPending] = useState<string | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 220)
    return () => window.clearTimeout(timer)
  }, [search])

  const { data, loading, error, reload } = useApiData(
    () => api.projects({ query: debouncedSearch, category, sort }),
    [debouncedSearch, category, sort, projectRevision]
  )

  const items = useMemo(() => {
    if (!data) return []
    if (statusFilter === 'all') return data.items
    if (statusFilter === 'untracked') return data.items.filter((project) => !project.tracked)
    return data.items.filter((project) => project.status === statusFilter)
  }, [data, statusFilter])

  const statusCounts = useMemo(() => {
    const map = new Map<string, number>()
    data?.facets.statuses.forEach((item) => {
      map.set(item.name || 'untracked', item.count)
    })
    return map
  }, [data])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, statusFilter, category, sort])

  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const pageItems = items.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const firstRow = items.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0
  const lastRow = Math.min(currentPage * PAGE_SIZE, items.length)

  const updateProject = async (
    project: Project,
    payload: { tracked?: boolean; status?: string | null },
    successMessage: string
  ) => {
    setPending(project.id)
    try {
      await api.updateProject(project.id, payload)
      toast(successMessage, payload.tracked === false ? 'info' : 'success')
      bumpProjects()
    } catch (err) {
      toast(err instanceof Error ? err.message : '操作失败，请稍后重试', 'error')
    } finally {
      setPending(null)
    }
  }

  const handleTrack = (project: Project) => {
    const next = !project.tracked
    updateProject(
      project,
      { tracked: next },
      next ? `已将 ${project.name} 加入跟踪` : `已将 ${project.name} 移出跟踪`
    )
  }

  const handleStatus = (project: Project, status: string) => {
    if (status === project.status) return
    updateProject(project, { status }, `已把 ${project.name} 标记为「${status}」`)
  }

  const exportCsv = () => {
    if (!items.length) return
    const header = ['full_name', 'category', 'language', 'stars', 'weekly_growth', 'weekly_growth_pct', 'trending_score', 'status', 'github']
    const rows = items.map((project) => [
      project.fullName,
      project.category,
      project.language,
      project.stars,
      project.weeklyGrowth,
      `${project.weeklyGrowthPct}%`,
      project.trendingScore,
      project.status || '未跟踪',
      project.homepage
    ])
    const csv = `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `git-trend-monitor-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    toast(`已导出 ${items.length} 个项目`)
  }

  if (loading && !data) return <LibrarySkeleton />

  const trackedCount = data?.trackedTotal || 0
  const totalCount = data?.allTotal || 0
  const trackedRatio = totalCount ? Math.round((trackedCount / totalCount) * 100) : 0

  return (
    <div className="page page-library">
      <header className="page-header reveal">
        <div className="page-header-copy">
          <div className="page-eyebrow">
            <span className="eyebrow-pip" />
            RESEARCH LIBRARY · {totalCount} PROJECTS
          </div>
          <h1>
            项目库<span className="title-period">。</span>
            <span className="h1-secondary">把注意力留给值得长期观察的项目。</span>
          </h1>
          <p>统一管理跟踪状态、研究标签与观察备注，建立属于你的开源项目记忆。</p>
        </div>
        <div className="page-actions">
          <button type="button" className="button button-secondary" onClick={exportCsv} disabled={!items.length}>
            <Download size={15} />
            导出 CSV
          </button>
          <Link className="button button-primary" to="/trends">
            <FolderKanban size={15} />
            从趋势中添加
            <ArrowUpRight size={14} />
          </Link>
        </div>
      </header>

      <section className="library-summary reveal reveal-delay-1">
        <div className="library-pool">
          <span className="library-icon">
            <BookmarkCheck size={18} />
          </span>
          <div>
            <span className="library-label">跟踪池</span>
            <div className="library-value">
              {trackedCount}
              <span>/ {totalCount}</span>
            </div>
            <div className="library-progress">
              <span style={{ width: `${trackedRatio}%` }} />
            </div>
          </div>
        </div>
        <div className="library-stat">
          <span>跟踪池总 Stars</span>
          <strong>{compactCount(data?.trackedWeeklyStars || 0)}</strong>
          <small>长期观察体量</small>
        </div>
        <div className="library-stat">
          <span>跟踪池 7 日新增</span>
          <strong className="positive">+{compactCount(data?.trackedWeeklyGrowth || 0)}</strong>
          <small>较上周持续更新</small>
        </div>
        <div className="library-statuses">
          {[
            { name: '重点关注', tone: 'focus' },
            { name: '观察中', tone: 'watch' },
            { name: '评估中', tone: 'evaluate' }
          ].map((item) => (
            <div className="status-summary" key={item.name}>
              <span className={`status-dot status-${item.tone}`} />
              <span>{item.name}</span>
              <strong>{statusCounts.get(item.name) || 0}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="library-panel panel reveal reveal-delay-2">
        <div className="library-toolbar">
          <div className="library-search">
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="在项目库中搜索…"
              aria-label="搜索项目库"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} aria-label="清空搜索">
                <X size={14} />
              </button>
            )}
          </div>
          <div className="library-toolbar-right">
            <label className="select-wrap">
              <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="分类筛选">
                <option value="all">全部分类</option>
                {data?.facets.categories.map((item) => (
                  <option value={item.name} key={item.name}>
                    {item.name} · {item.count}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} />
            </label>
            <label className="select-wrap">
              <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="排序">
                <option value="trending">趋势分排序</option>
                <option value="growth">7 日增量</option>
                <option value="stars">总 Stars</option>
                <option value="name">按名称</option>
              </select>
              <ChevronDown size={13} />
            </label>
          </div>
        </div>

        <div className="status-tabs">
          {statusTabs.map((tab) => (
            <button
              type="button"
              key={tab.key}
              className={statusFilter === tab.key ? 'is-active' : ''}
              onClick={() => setStatusFilter(tab.key)}
            >
              {tab.label}
              {tab.key !== 'all' && <span>{statusCounts.get(tab.key) || 0}</span>}
            </button>
          ))}
          <span className="status-tabs-note">{items.length} 个结果</span>
        </div>

        {error && !data ? (
          <EmptyState
            icon={<FolderKanban size={20} />}
            title="项目库暂时不可用"
            description={error}
            action={
              <button type="button" className="button button-primary" onClick={reload}>
                重新加载
              </button>
            }
          />
        ) : items.length ? (
          <>
          <div className="table-scroll">
            <table className="project-table">
              <thead>
                <tr>
                  <th className="project-col">项目</th>
                  <th>分类</th>
                  <th>语言</th>
                  <th className="numeric">Stars</th>
                  <th className="numeric">7 日增长</th>
                  <th className="trend-col">走势</th>
                  <th>状态</th>
                  <th>跟踪</th>
                  <th aria-label="打开" />
                </tr>
              </thead>
              <tbody>
                {pageItems.map((project) => (
                  <tr
                    key={project.id}
                    className="project-table-row"
                    onClick={() => openProject(project.id)}
                  >
                    <td className="project-col">
                      <div className="table-project">
                        <ProjectAvatar name={project.name} owner={project.owner} size={34} />
                        <div className="table-project-copy">
                          <strong>{project.name}</strong>
                          <span>{project.owner}</span>
                          <small>{project.description}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <CategoryPill category={project.category} subtle />
                    </td>
                    <td>
                      <span className="table-language">
                        <i style={{ background: project.languageColor }} />
                        {project.language}
                      </span>
                    </td>
                    <td className="numeric">
                      <strong>{compactCount(project.stars)}</strong>
                      <span className="table-sub">stars</span>
                    </td>
                    <td className="numeric">
                      <strong className="positive">+{compactCount(project.weeklyGrowth)}</strong>
                      <span className="table-sub">{signedPct(project.weeklyGrowthPct)}</span>
                    </td>
                    <td className="trend-col">
                      <Sparkline
                        values={project.sparkline}
                        width={82}
                        height={26}
                        color={categoryColor(project.category)}
                        fill
                      />
                    </td>
                    <td>
                      {project.tracked ? (
                        <span className={`status-select-wrap status-${statusTone(project.status)}`}>
                          <i />
                          <select
                            value={project.status || '观察中'}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) => handleStatus(project, event.target.value)}
                            aria-label={`设置 ${project.name} 的跟踪状态`}
                          >
                            <option value="重点关注">重点关注</option>
                            <option value="观察中">观察中</option>
                            <option value="评估中">评估中</option>
                          </select>
                          <ChevronDown size={12} />
                        </span>
                      ) : (
                        <span className="status-muted">未跟踪</span>
                      )}
                    </td>
                    <td onClick={(event) => event.stopPropagation()}>
                      <div className="table-toggle-cell">
                        {pending === project.id ? (
                          <Spinner size={15} />
                        ) : (
                          <Toggle
                            checked={project.tracked}
                            onChange={() => handleTrack(project)}
                            label={project.tracked ? '取消跟踪' : '加入跟踪'}
                          />
                        )}
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="table-open"
                        aria-label={`查看 ${project.fullName}`}
                        onClick={(event) => {
                          event.stopPropagation()
                          openProject(project.id)
                        }}
                      >
                        <ArrowUpRight size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mobile-project-list">
            {pageItems.map((project) => (
              <article className="mobile-project-card" key={project.id}>
                <button
                  type="button"
                  className="mobile-project-open"
                  onClick={() => openProject(project.id)}
                  aria-label={`查看 ${project.fullName}`}
                >
                  <ProjectAvatar name={project.name} owner={project.owner} size={36} />
                  <span className="mobile-project-copy">
                    <strong>{project.name}</strong>
                    <span>{project.owner}</span>
                    <small>{project.description}</small>
                  </span>
                  <ChevronRight size={15} />
                </button>
                <div className="mobile-project-controls">
                  <CategoryPill category={project.category} subtle />
                  <span className="mobile-project-stars">
                    <strong>{compactCount(project.stars)}</strong> ★
                  </span>
                  <span className="mobile-project-growth">{signedPct(project.weeklyGrowthPct)}</span>
                  <div className="mobile-project-actions">
                    {project.tracked ? (
                      <span className={`status-select-wrap status-${statusTone(project.status)}`}>
                        <i />
                        <select
                          value={project.status || '观察中'}
                          onChange={(event) => handleStatus(project, event.target.value)}
                          aria-label={`设置 ${project.name} 的跟踪状态`}
                        >
                          <option value="重点关注">重点关注</option>
                          <option value="观察中">观察中</option>
                          <option value="评估中">评估中</option>
                        </select>
                        <ChevronDown size={11} />
                      </span>
                    ) : (
                      <span className="status-muted">未跟踪</span>
                    )}
                    {pending === project.id ? (
                      <Spinner size={14} />
                    ) : (
                      <Toggle
                        checked={project.tracked}
                        onChange={() => handleTrack(project)}
                        label={project.tracked ? '取消跟踪' : '加入跟踪'}
                      />
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
          </>
        ) : (
          <EmptyState
            icon={<Bookmark size={21} />}
            title="这里还没有项目"
            description="调整筛选条件，或者去趋势雷达把高潜项目加入跟踪清单。"
            action={
              <Link to="/trends" className="button button-primary">
                去趋势雷达看看
              </Link>
            }
          />
        )}

        <div className="table-footer">
          <span>
            显示 {firstRow}–{lastRow} / {items.length} 个项目 · 数据更新于{' '}
            {relativeTime(data?.items[0]?.syncedAt)}
          </span>
          {pageCount > 1 ? (
            <div className="table-pagination">
              <button
                type="button"
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                disabled={currentPage === 1}
                aria-label="上一页"
              >
                <ChevronLeft size={13} />
              </button>
              <span>
                第 {currentPage} / {pageCount} 页
              </span>
              <button
                type="button"
                onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
                disabled={currentPage === pageCount}
                aria-label="下一页"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          ) : (
            <span>状态与标签在所有页面实时同步</span>
          )}
        </div>
      </section>
    </div>
  )
}
