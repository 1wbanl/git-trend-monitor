import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  ArrowUpRight,
  Check,
  ExternalLink,
  FileText,
  GitFork,
  Plus,
  Sparkles,
  Star,
  Tag,
  TrendingUp,
  X
} from 'lucide-react'
import { api } from '../lib/api'
import type { ProjectDetailResponse } from '../lib/types'
import {
  categoryColor,
  categoryColors,
  compactCount,
  dateTime,
  formatNumber,
  relativeTime,
  signedPct
} from '../lib/format'
import { areaPath, createChartPoints, smoothPath } from '../lib/chart'
import { useApp } from '../context/AppContext'
import { CategoryPill, ProjectAvatar, Spinner, StatusBadge } from './ui'

const statusOptions = ['重点关注', '观察中', '评估中'] as const

function HistoryChart({ project }: { project: ProjectDetailResponse['project'] }) {
  const [range, setRange] = useState<14 | 30>(14)
  const history = (project.history || []).slice(-range)
  const values = history.map((point) => point.stars)
  if (!values.length) return <div className="drawer-chart-empty">暂无历史快照</div>

  const width = 620
  const height = 208
  const { points } = createChartPoints(values, {
    width,
    height,
    paddingTop: 18,
    paddingBottom: 30,
    paddingLeft: 12,
    paddingRight: 12
  })
  const color = categoryColor(project.category)
  const line = smoothPath(points)
  const area = areaPath(points, height - 28)
  const delta = values.at(-1)! - values[0]
  const labels = [0, Math.floor((history.length - 1) / 2), history.length - 1]
  const gradientId = `drawer-area-${project.id}`

  return (
    <div className="drawer-chart">
      <div className="drawer-chart-head">
        <div>
          <span className="chart-kicker">STARS TRAJECTORY</span>
          <div className="drawer-chart-value">
            {formatNumber(project.stars)}
            <span className={delta >= 0 ? 'positive' : 'negative'}>
              {delta >= 0 ? '+' : ''}
              {formatNumber(delta)} / {range}D
            </span>
          </div>
        </div>
        <div className="range-toggle">
          {[14, 30].map((value) => (
            <button
              key={value}
              type="button"
              className={range === value ? 'is-active' : ''}
              onClick={() => setRange(value as 14 | 30)}
            >
              {value}D
            </button>
          ))}
        </div>
      </div>
      <svg
        className="drawer-chart-svg"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${project.fullName} 最近 ${range} 天 Stars 趋势`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.26" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((ratio) => (
          <line
            key={ratio}
            x1="0"
            x2={width}
            y1={18 + ratio * (height - 46)}
            y2={18 + ratio * (height - 46)}
            stroke="rgba(255,255,255,.055)"
            strokeDasharray="3 6"
          />
        ))}
        <path d={area} fill={`url(#${gradientId})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
        <circle
          cx={points.at(-1)!.x}
          cy={points.at(-1)!.y}
          r="4"
          fill="#080c10"
          stroke={color}
          strokeWidth="2.2"
        />
        {labels.map((index) => (
          <text
            key={index}
            x={points[index].x}
            y={height - 7}
            fill="#67737f"
            fontSize="10"
            textAnchor={index === 0 ? 'start' : index === history.length - 1 ? 'end' : 'middle'}
          >
            {history[index].date.slice(5).replace('-', '/')}
          </text>
        ))}
      </svg>
    </div>
  )
}

export function ProjectDrawer() {
  const {
    activeProjectId,
    closeProject,
    openProject,
    askAi,
    toast,
    bumpProjects
  } = useApp()
  const [data, setData] = useState<ProjectDetailResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [tagDraft, setTagDraft] = useState('')
  const [note, setNote] = useState('')
  const [noteDirty, setNoteDirty] = useState(false)

  useEffect(() => {
    if (!activeProjectId) return
    let cancelled = false
    setLoading(true)
    setData(null)
    setTagDraft('')
    api
      .project(activeProjectId)
      .then((response) => {
        if (cancelled) return
        setData(response)
        setNote(response.project.note || '')
        setNoteDirty(false)
      })
      .catch(() => {
        if (!cancelled) {
          toast('项目详情读取失败', 'error')
          closeProject()
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeProjectId, closeProject, toast])

  useEffect(() => {
    if (!activeProjectId) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeProject()
    }
    document.addEventListener('keydown', onKey)
    document.body.classList.add('drawer-open')
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.classList.remove('drawer-open')
    }
  }, [activeProjectId, closeProject])

  const project = data?.project
  const related = data?.related || []
  const chartColor = project ? categoryColor(project.category) : '#c8ff5c'

  const appliedTags = useMemo(() => project?.tags || [], [project])

  const patchProject = async (payload: {
    tracked?: boolean
    status?: string | null
    tags?: string[]
    note?: string
  }) => {
    if (!project) return null
    setSaving(true)
    try {
      const response = await api.updateProject(project.id, payload)
      setData((current) =>
        current ? { ...current, project: { ...current.project, ...response.project } } : current
      )
      setNote(response.project.note || '')
      setNoteDirty(false)
      bumpProjects()
      return response.project
    } catch (error) {
      toast(error instanceof Error ? error.message : '更新失败，请稍后重试', 'error')
      return null
    } finally {
      setSaving(false)
    }
  }

  const toggleTracking = async () => {
    if (!project) return null
    const next = !project.tracked
    const updated = await patchProject({ tracked: next })
    if (updated) {
      toast(next ? `已跟踪 ${project.fullName}` : `已将 ${project.name} 移出跟踪清单`, next ? 'success' : 'info')
    }
    return updated
  }

  const addTag = async () => {
    const tag = tagDraft.trim().replace(/^#/, '').slice(0, 18)
    if (!tag || !project) return
    if (appliedTags.includes(tag)) {
      setTagDraft('')
      return
    }
    if (appliedTags.length >= 8) {
      toast('最多添加 8 个标签', 'info')
      return
    }
    const updated = await patchProject({ tags: [...appliedTags, tag] })
    if (updated) {
      setTagDraft('')
      toast(`已添加标签「${tag}」`)
    }
  }

  const removeTag = async (tag: string) => {
    const updated = await patchProject({ tags: appliedTags.filter((item) => item !== tag) })
    if (updated) toast(`已移除标签「${tag}」`, 'info')
  }

  const saveNote = async () => {
    if (!project) return
    const updated = await patchProject({ note })
    if (updated) toast('项目备注已保存')
  }

  if (!activeProjectId) return null

  return (
    <div className="drawer-layer">
      <div className="drawer-scrim" onClick={closeProject} aria-hidden="true" />
      <aside className="project-drawer" role="dialog" aria-modal="true" aria-label="项目详情">
        <div className="drawer-topline">
          <span className="drawer-eyebrow">
            <Activity size={13} />
            PROJECT SIGNAL
          </span>
          <div className="drawer-top-actions">
            {project && (
              <a
                className="drawer-icon-button"
                href={project.homepage}
                target="_blank"
                rel="noreferrer"
                aria-label="在 GitHub 打开"
                title="在 GitHub 打开"
              >
                <ExternalLink size={16} />
              </a>
            )}
            <button
              type="button"
              className="drawer-icon-button"
              onClick={closeProject}
              aria-label="关闭详情"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {loading || !project ? (
          <div className="drawer-loading">
            <div className="drawer-loading-head">
              <span className="skeleton skeleton-avatar" />
              <div>
                <span className="skeleton" style={{ width: 180, height: 19 }} />
                <span className="skeleton" style={{ width: 260, height: 12, marginTop: 10 }} />
              </div>
            </div>
            <span className="skeleton" style={{ width: '100%', height: 112, marginTop: 28 }} />
            <span className="skeleton" style={{ width: '100%', height: 220, marginTop: 20 }} />
            <div className="drawer-loading-note">
              <Spinner size={15} /> 正在读取项目快照与知识卡…
            </div>
          </div>
        ) : (
          <div className="drawer-scroll">
            <div className="drawer-project-head">
              <ProjectAvatar name={project.name} owner={project.owner} size={56} />
              <div className="drawer-project-title">
                <div className="drawer-owner">{project.owner} /</div>
                <h2>{project.name}</h2>
                <div className="drawer-meta-row">
                  <CategoryPill category={project.category} />
                  <span className="drawer-lang">
                    <span style={{ background: project.languageColor }} />
                    {project.language}
                  </span>
                  {project.tracked && <StatusBadge status={project.status} />}
                </div>
              </div>
            </div>

            <p className="drawer-description">{project.description}</p>

            <div className="drawer-cta-row">
              {project.tracked ? (
                <span className="button button-ghost tracked-pill">
                  <Check size={15} />
                  已在跟踪
                </span>
              ) : (
                <button
                  type="button"
                  className="button button-primary"
                  onClick={toggleTracking}
                  disabled={saving}
                >
                  {saving ? <Spinner size={14} /> : <Plus size={15} />}
                  加入跟踪
                </button>
              )}
              <button
                type="button"
                className="button button-secondary"
                onClick={() =>
                  askAi(
                    `帮我详细分析 ${project.fullName}：它解决什么问题，当前趋势如何，适合什么场景？`
                  )
                }
              >
                <Sparkles size={15} />
                问问 AI
              </button>
              <a
                className="button button-quiet drawer-github-button"
                href={project.homepage}
                target="_blank"
                rel="noreferrer"
              >
                GitHub
                <ArrowUpRight size={14} />
              </a>
            </div>

            <div className="drawer-metrics">
              <div className="drawer-metric">
                <span className="drawer-metric-icon"><Star size={14} /></span>
                <strong>{compactCount(project.stars)}</strong>
                <small>Total stars</small>
              </div>
              <div className="drawer-metric">
                <span className="drawer-metric-icon"><TrendingUp size={14} /></span>
                <strong className="positive">+{compactCount(project.weeklyGrowth)}</strong>
                <small>7 日新增</small>
              </div>
              <div className="drawer-metric">
                <span className="drawer-metric-icon"><Activity size={14} /></span>
                <strong>{signedPct(project.weeklyGrowthPct)}</strong>
                <small>周增速</small>
              </div>
              <div className="drawer-metric">
                <span className="drawer-metric-icon"><GitFork size={14} /></span>
                <strong>{compactCount(project.forks)}</strong>
                <small>Forks</small>
              </div>
            </div>

            <HistoryChart project={project} />

            <section className="drawer-ai-card">
              <div className="drawer-section-heading">
                <span className="ai-mark">
                  <Sparkles size={13} />
                </span>
                <span>AI 速读</span>
                <span className="ai-local-tag">RAG · 本地索引</span>
              </div>
              <p>{project.summary}</p>
              <div className="drawer-highlights">
                {project.highlights.slice(0, 3).map((item, index) => (
                  <div className="drawer-highlight" key={item}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <p>{item}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="drawer-manage">
              <div className="drawer-section-heading plain">
                <span>项目管理</span>
                <span className="drawer-updated">同步于 {relativeTime(project.syncedAt)}</span>
              </div>

              <div className="manage-field">
                <label>跟踪状态</label>
                {project.tracked ? (
                  <div className="status-options">
                    {statusOptions.map((status) => (
                      <button
                        key={status}
                        type="button"
                        className={project.status === status ? 'is-active' : ''}
                        style={
                          project.status === status
                            ? { borderColor: `${chartColor}66`, color: chartColor }
                            : undefined
                        }
                        onClick={() => patchProject({ status })}
                        disabled={saving}
                      >
                        {project.status === status && <span className="status-choice-dot" style={{ background: chartColor }} />}
                        {status}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="manage-hint">加入跟踪后，可以为项目设置关注级别与标签。</p>
                )}
              </div>

              <div className="manage-field">
                <label>
                  <Tag size={13} /> 标签
                </label>
                <div className="tag-editor">
                  {appliedTags.map((tag) => (
                    <span className="tag-chip" key={tag}>
                      {tag}
                      <button type="button" onClick={() => removeTag(tag)} aria-label={`移除标签 ${tag}`} disabled={saving}>
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                  <input
                    value={tagDraft}
                    onChange={(event) => setTagDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        addTag()
                      }
                    }}
                    placeholder={appliedTags.length ? '添加标签…' : '输入标签后回车'}
                    maxLength={18}
                  />
                </div>
              </div>

              <div className="manage-field">
                <label>
                  <FileText size={13} /> 研究备注
                </label>
                <textarea
                  value={note}
                  onChange={(event) => {
                    setNote(event.target.value)
                    setNoteDirty(true)
                  }}
                  placeholder="为什么关注它？适合哪个场景？记下判断依据…"
                  rows={3}
                  maxLength={800}
                />
                {noteDirty && (
                  <div className="note-actions">
                    <button type="button" className="button button-primary button-small" onClick={saveNote} disabled={saving}>
                      {saving ? <Spinner size={13} /> : <Check size={13} />}
                      保存备注
                    </button>
                  </div>
                )}
              </div>

              <div className="manage-footer">
                <span>
                  创建于 {dateTime(project.createdAt)} · {project.license}
                </span>
                {project.tracked && (
                  <button
                    type="button"
                    className="danger-text"
                    onClick={() => {
                      toggleTracking()
                    }}
                  >
                    取消跟踪
                  </button>
                )}
              </div>
            </section>

            {related.length > 0 && (
              <section className="drawer-related">
                <div className="drawer-section-heading plain">
                  <span>同类项目</span>
                  <span className="drawer-updated">按趋势分排序</span>
                </div>
                <div className="related-list">
                  {related.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className="related-item"
                      onClick={() => openProject(item.id)}
                    >
                      <ProjectAvatar name={item.name} owner={item.owner} size={30} />
                      <span className="related-copy">
                        <strong>{item.fullName}</strong>
                        <small>{compactCount(item.stars)} stars</small>
                      </span>
                      <span className="related-growth" style={{ color: categoryColors[item.category] }}>
                        {signedPct(item.weeklyGrowthPct)}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            <div className="drawer-endnote">
              <span>SOURCE · {project.origin === 'github' ? 'GITHUB API SNAPSHOT' : 'DEMO BASELINE'}</span>
              <span>TREND SCORE {project.trendingScore}/100</span>
            </div>
          </div>
        )}
      </aside>
    </div>
  )
}
