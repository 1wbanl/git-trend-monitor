import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
  BellRing,
  Bookmark,
  BookmarkCheck,
  ChevronRight,
  CircleAlert,
  Clock3,
  Plus,
  Radar,
  RefreshCw,
  Sparkles,
  Star,
  TrendingUp
} from 'lucide-react'
import { api } from '../lib/api'
import { useApiData } from '../lib/useApiData'
import { useApp } from '../context/AppContext'
import type { Mover, Overview as OverviewData, SignalEvent } from '../lib/types'
import {
  categoryColor,
  compactCount,
  dateLong,
  formatNumber,
  greeting,
  relativeTime,
  severityLabel,
  signedPct
} from '../lib/format'
import { CategoryPill, ProjectAvatar, Skeleton, Sparkline, Spinner } from '../components/ui'
import { GrowthPulse } from '../components/GrowthPulse'

function KpiCard({
  label,
  value,
  unit,
  icon,
  tone,
  footnote,
  visual
}: {
  label: string
  value: string
  unit?: string
  icon: ReactNode
  tone: string
  footnote: ReactNode
  visual?: ReactNode
}) {
  return (
    <article className={`kpi-card kpi-${tone}`}>
      <div className="kpi-top">
        <span className="kpi-icon">{icon}</span>
        <span className="kpi-label">{label}</span>
        <span className="kpi-corner">LIVE</span>
      </div>
      <div className="kpi-value">
        {value}
        {unit && <span className="kpi-unit">{unit}</span>}
      </div>
      <div className="kpi-bottom">
        <span className="kpi-note">{footnote}</span>
        <span className="kpi-visual">{visual}</span>
      </div>
    </article>
  )
}

function BriefingCard({
  data,
  onRefresh,
  refreshing
}: {
  data: OverviewData
  onRefresh: () => void
  refreshing: boolean
}) {
  const { askAi, openProject } = useApp()
  const briefing = data.briefing
  return (
    <section className="briefing-card">
      <div className="briefing-glow" aria-hidden="true" />
      <div className="briefing-grid-texture" aria-hidden="true" />
      <header className="briefing-head">
        <div className="briefing-mark">
          <Sparkles size={14} />
          <span>AI BRIEFING</span>
        </div>
        <button
          type="button"
          className={`briefing-refresh ${refreshing ? 'is-spinning' : ''}`}
          onClick={onRefresh}
          aria-label="刷新简报"
          title="基于最新快照重新聚合"
        >
          {refreshing ? <Spinner size={13} /> : <RefreshCw size={14} />}
        </button>
      </header>
      <div className="briefing-body">
        <span className="briefing-date">{dateLong()} · 趋势晨报</span>
        <h2>{briefing.headline}</h2>
        <p className="briefing-intro">{briefing.intro}</p>
        <div className="briefing-signals">
          {briefing.signals.map((signal, index) => (
            <button
              type="button"
              className={`briefing-signal ${signal.projectId ? 'is-linked' : ''}`}
              key={signal.title}
              onClick={() => signal.projectId && openProject(signal.projectId)}
            >
              <span className="briefing-index">{String(index + 1).padStart(2, '0')}</span>
              <span className="briefing-signal-copy">
                <span className="briefing-signal-label">{signal.label}</span>
                <strong>{signal.title}</strong>
                <span>{signal.body}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
      <footer className="briefing-footer">
        <span>{briefing.footnote}</span>
        <button
          type="button"
          className="briefing-chat"
          onClick={() =>
            askAi('帮我解读今天的开源趋势简报，哪些信号值得优先关注？请给出 3 个具体项目。')
          }
        >
          继续深聊
          <ArrowRight size={14} />
        </button>
      </footer>
    </section>
  )
}

function MoverRow({
  mover,
  pending,
  onTrack
}: {
  mover: Mover
  pending: boolean
  onTrack: (project: Mover) => void
}) {
  const { openProject } = useApp()
  const color = categoryColor(mover.category)
  return (
    <div
      className="mover-row"
      role="button"
      tabIndex={0}
      onClick={() => openProject(mover.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') openProject(mover.id)
      }}
    >
      <span className={`mover-rank ${mover.rank <= 3 ? 'is-top' : ''}`}>
        {String(mover.rank).padStart(2, '0')}
      </span>
      <ProjectAvatar name={mover.name} owner={mover.owner} size={38} />
      <div className="mover-identity">
        <div className="mover-name-line">
          <strong>{mover.name}</strong>
          <span>{mover.owner}</span>
        </div>
        <p>{mover.description}</p>
      </div>
      <span className="mover-category">
        <CategoryPill category={mover.category} subtle />
      </span>
      <span className="mover-spark">
        <Sparkline values={mover.sparkline} width={86} height={28} color={color} fill />
      </span>
      <div className="mover-growth">
        <strong style={{ color }}>{signedPct(mover.weeklyGrowthPct)}</strong>
        <span>+{compactCount(mover.weeklyGrowth)} ★</span>
      </div>
      <div className="mover-stars">
        <strong>{compactCount(mover.stars)}</strong>
        <span>STARS</span>
      </div>
      <button
        type="button"
        className={`mover-track ${mover.tracked ? 'is-tracked' : ''}`}
        onClick={(event) => {
          event.stopPropagation()
          onTrack(mover)
        }}
        disabled={pending}
        aria-label={mover.tracked ? '取消跟踪' : '加入跟踪'}
        title={mover.tracked ? '取消跟踪' : '加入跟踪'}
      >
        {pending ? <Spinner size={13} /> : mover.tracked ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
      </button>
    </div>
  )
}

function SignalRow({ signal }: { signal: SignalEvent }) {
  const { openProject } = useApp()
  return (
    <button
      type="button"
      className={`signal-row ${signal.read ? 'is-read' : ''}`}
      onClick={() => signal.projectId && openProject(signal.projectId)}
    >
      <span className={`signal-rail severity-bg-${signal.severity}`} />
      <span className={`signal-icon severity-${signal.severity}`}>
        {signal.severity === 'high' ? <CircleAlert size={15} /> : signal.severity === 'medium' ? <BellRing size={15} /> : <Clock3 size={15} />}
      </span>
      <span className="signal-copy">
        <span className="signal-meta">
          <span className={`severity-tag severity-${signal.severity}`}>{severityLabel(signal.severity)}</span>
          <span>{relativeTime(signal.createdAt)}</span>
        </span>
        <strong>{signal.title}</strong>
        <span className="signal-message">{signal.message}</span>
        {signal.projectName && <span className="signal-project">{signal.projectName}</span>}
      </span>
      <ChevronRight size={15} className="signal-arrow" />
    </button>
  )
}

function OverviewSkeleton() {
  return (
    <div className="page page-overview">
      <div className="page-header">
        <div>
          <Skeleton width={260} height={12} />
          <Skeleton width={420} height={42} style={{ marginTop: 18 }} />
          <Skeleton width={360} height={14} style={{ marginTop: 14 }} />
        </div>
      </div>
      <div className="kpi-grid">
        {[0, 1, 2, 3].map((item) => (
          <div className="kpi-card" key={item}>
            <Skeleton width={100} height={12} />
            <Skeleton width={150} height={34} style={{ marginTop: 18 }} />
            <Skeleton width={140} height={10} style={{ marginTop: 20 }} />
          </div>
        ))}
      </div>
      <div className="dashboard-grid">
        <div className="panel"><Skeleton width="100%" height={330} /></div>
        <div className="panel"><Skeleton width="100%" height={330} /></div>
      </div>
    </div>
  )
}

export default function OverviewPage() {
  const navigate = useNavigate()
  const { toast, refreshAlertCount, projectRevision, bumpProjects, askAi } = useApp()
  const [range, setRange] = useState<7 | 30>(7)
  const [pendingTrack, setPendingTrack] = useState<string | null>(null)
  const { data, loading, refreshing, error, reload } = useApiData(() => api.overview(), [projectRevision])

  const trendPoints = data?.trend.sevenDays || []
  const dailyTotals = useMemo(() => trendPoints.map((point) => Number(point.total) || 0), [trendPoints])
  const lastDay = dailyTotals.at(-1) || 0
  const previousDay = dailyTotals.at(-2) || 1
  const dayDelta = previousDay ? ((lastDay - previousDay) / previousDay) * 100 : 0
  const cumulative = useMemo(() => {
    let sum = 0
    return dailyTotals.map((value) => {
      sum += value
      return sum
    })
  }, [dailyTotals])
  const highPriorityUnread = useMemo(
    () => data?.signals.filter((signal) => !signal.read && signal.severity === 'high').length || 0,
    [data]
  )

  if (loading && !data) return <OverviewSkeleton />
  if (error && !data) {
    return (
      <div className="page page-error">
        <div className="error-panel">
          <CircleAlert size={22} />
          <h2>仪表盘暂时无法加载</h2>
          <p>{error}</p>
          <button type="button" className="button button-primary" onClick={reload}>
            重新加载
          </button>
        </div>
      </div>
    )
  }
  if (!data) return null

  const trackMove = async (mover: Mover) => {
    setPendingTrack(mover.id)
    try {
      await api.updateProject(mover.id, { tracked: !mover.tracked })
      toast(mover.tracked ? `已将 ${mover.name} 移出跟踪清单` : `已跟踪 ${mover.name}`, mover.tracked ? 'info' : 'success')
      bumpProjects()
      refreshAlertCount()
    } catch (err) {
      toast(err instanceof Error ? err.message : '操作失败', 'error')
    } finally {
      setPendingTrack(null)
    }
  }

  const categories = data.categories.slice().sort((a, b) => b.weeklyGrowth - a.weeklyGrowth)
  const topicMax = Math.max(1, ...data.topics.map((topic) => topic.weeklyGrowth))
  const selectedTrend = range === 7 ? data.trend.sevenDays : data.trend.thirtyDays

  return (
    <div className="page page-overview">
      <header className="page-header overview-header reveal">
        <div className="page-header-copy">
          <div className="page-eyebrow">
            <span className="eyebrow-pip" />
            TREND INTELLIGENCE
            <span className="eyebrow-sep">/</span>
            {dateLong()}
          </div>
          <h1>
            {greeting()}，Lin<span className="title-period">。</span>
            <span className="h1-secondary">这是今天的开源风向。</span>
          </h1>
          <p>
            系统正在追踪 <strong>{data.stats.totalProjects}</strong> 个高潜项目，AI 已从{' '}
            <strong>{data.meta.rag.documents}</strong> 个知识片段中整理出今日信号。
          </p>
        </div>
        <div className="page-actions">
          <button type="button" className="button button-secondary" onClick={() => navigate('/library')}>
            <Plus size={15} />
            管理清单
          </button>
          <Link className="button button-primary" to="/trends">
            <Radar size={15} />
            打开趋势雷达
            <ArrowUpRight size={14} />
          </Link>
        </div>
      </header>

      <div className="kpi-grid reveal reveal-delay-1">
        <KpiCard
          label="今日新增 Stars"
          value={formatNumber(data.stats.newToday)}
          icon={<Star size={15} />}
          tone="lime"
          footnote={
            <>
              <span className={dayDelta >= 0 ? 'delta positive' : 'delta negative'}>
                {signedPct(dayDelta)}
              </span>
              较昨日
            </>
          }
          visual={<Sparkline values={dailyTotals} width={88} height={29} color="#c8ff5c" fill />}
        />
        <KpiCard
          label="跟踪项目"
          value={String(data.stats.trackedCount)}
          unit="个"
          icon={<BookmarkCheck size={15} />}
          tone="blue"
          footnote={
            <>
              <span className="delta neutral">{data.categories.length} 个方向</span>
              持续观察中
            </>
          }
          visual={
            <span className="kpi-category-stack" aria-hidden="true">
              {categories.map((category) => (
                <i
                  key={category.name}
                  style={{
                    background: category.color,
                    width: `${Math.max(7, category.share)}%`,
                    opacity: category.name ? 0.9 : 0
                  }}
                  title={category.name}
                />
              ))}
            </span>
          }
        />
        <KpiCard
          label="待处理信号"
          value={String(data.stats.unreadAlerts)}
          unit="条"
          icon={<BellRing size={15} />}
          tone="amber"
          footnote={
            <>
              <span className="delta hot">{highPriorityUnread} 条高优先</span>
              {data.stats.activeRules} 条规则运行中
            </>
          }
          visual={
            <span className="kpi-signal-bars" aria-hidden="true">
              <i style={{ height: 8 }} />
              <i style={{ height: 17 }} />
              <i style={{ height: 12 }} />
              <i style={{ height: 22 }} />
              <i style={{ height: 15 }} />
            </span>
          }
        />
        <KpiCard
          label="7 日整体增速"
          value={signedPct(data.stats.weeklyGrowthPct)}
          icon={<TrendingUp size={15} />}
          tone="mint"
          footnote={
            <>
              <span className="delta positive">+{compactCount(data.stats.weeklyGrowth)} ★</span>
              过去一周
            </>
          }
          visual={<Sparkline values={cumulative} width={88} height={29} color="#65d9d4" fill />}
        />
      </div>

      <div className="dashboard-grid reveal reveal-delay-2">
        <GrowthPulse
          points={selectedTrend}
          categories={data.categories}
          range={range}
          onRangeChange={setRange}
        />
        <BriefingCard data={data} onRefresh={reload} refreshing={refreshing} />
      </div>

      <div className="dashboard-lower reveal reveal-delay-3">
        <section className="panel movers-panel">
          <header className="panel-head compact-head">
            <div className="panel-title-block">
              <div className="panel-kicker">
                <span className="kicker-line" />
                RISING NOW
              </div>
              <div className="inline-title-row">
                <h2>今日升浪</h2>
                <span className="title-chip">Top 5</span>
              </div>
              <p className="panel-subtitle">增速与趋势分综合排序，捕捉正在形成势能的项目</p>
            </div>
            <Link to="/trends" className="panel-link">
              全部趋势 <ArrowRight size={14} />
            </Link>
          </header>
          <div className="mover-list">
            {data.topMovers.map((mover) => (
              <MoverRow
                key={mover.id}
                mover={mover}
                pending={pendingTrack === mover.id}
                onTrack={trackMove}
              />
            ))}
          </div>
        </section>

        <section className="panel signals-panel">
          <header className="panel-head compact-head">
            <div className="panel-title-block">
              <div className="panel-kicker">
                <span className="kicker-line" />
                SIGNAL FEED
              </div>
              <div className="inline-title-row">
                <h2>实时信号</h2>
                {data.stats.unreadAlerts > 0 && <span className="notification-pill">{data.stats.unreadAlerts} 未读</span>}
              </div>
            </div>
            <Link to="/alerts" className="panel-link">
              全部信号 <ArrowRight size={14} />
            </Link>
          </header>
          <div className="signal-list">
            {data.signals.slice(0, 4).map((signal) => (
              <SignalRow signal={signal} key={signal.id} />
            ))}
          </div>
          <div className="signal-foot">
            <span className="status-orb" />
            <span>{data.stats.activeRules} 条规则正在后台巡检</span>
            <Link to="/alerts">管理规则</Link>
          </div>
        </section>
      </div>

      <div className="dashboard-bottom reveal reveal-delay-4">
        <section className="panel topics-panel">
          <header className="panel-head compact-head">
            <div className="panel-title-block">
              <div className="panel-kicker">
                <span className="kicker-line" />
                THEME MOMENTUM
              </div>
              <div className="inline-title-row">
                <h2>主题热度</h2>
              </div>
              <p className="panel-subtitle">过去 7 天，哪些技术叙事正在吸收注意力</p>
            </div>
            <Link to="/trends" className="panel-link">
              在雷达中浏览 <ArrowRight size={14} />
            </Link>
          </header>
          <div className="topic-list">
            {data.topics.map((topic, index) => (
              <button
                type="button"
                className="topic-row"
                key={topic.name}
                onClick={() => navigate(`/trends?q=${encodeURIComponent(topic.name)}`)}
              >
                <span className="topic-index">{String(index + 1).padStart(2, '0')}</span>
                <span className="topic-name">
                  <strong>{topic.name}</strong>
                  <small>{topic.description}</small>
                </span>
                <span className="topic-bar">
                  <span
                    className="topic-bar-fill"
                    style={{ width: `${Math.max(10, (topic.weeklyGrowth / topicMax) * 100)}%` }}
                  />
                </span>
                <span className="topic-count">{topic.projectCount} 个项目</span>
                <span className="topic-growth">+{compactCount(topic.weeklyGrowth)}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="assistant-teaser">
          <div className="teaser-orb" aria-hidden="true">
            <span className="orb-core" />
            <span className="orb-ring ring-one" />
            <span className="orb-ring ring-two" />
            <span className="orb-node node-one" />
            <span className="orb-node node-two" />
          </div>
          <div className="teaser-content">
            <div className="panel-kicker light">
              <span className="kicker-line" />
              RAG RESEARCH ASSISTANT
            </div>
            <h2>把趋势库，变成你的第二大脑。</h2>
            <p>
              已索引 {data.meta.rag.projects} 个项目、{data.meta.rag.documents} 个知识片段。回答先检索、再引用，不让模型凭空猜。
            </p>
            <div className="teaser-metrics">
              <span>
                <strong>{data.meta.rag.documents}</strong>
                知识片段
              </span>
              <span>
                <strong>{data.meta.rag.terms}</strong>
                检索词
              </span>
              <span>
                <strong>{data.meta.ai.mode === 'remote' ? 'LLM' : 'BM25'}</strong>
                {data.meta.ai.mode === 'remote' ? '生成模式' : '本地检索'}
              </span>
            </div>
            <div className="teaser-actions">
              <button
                type="button"
                className="button button-lime"
                onClick={() =>
                  askAi('有哪些适合本地部署、同时支持 RAG 的开源项目？请说明选择和取舍。')
                }
              >
                <Sparkles size={15} />
                问一个趋势问题
              </button>
              <Link to="/assistant" className="teaser-link">
                打开研究助手 <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>
        </section>
      </div>

      <footer className="page-footnote">
        <span>
          <span className="status-orb" />
          数据快照自动刷新 · 上次同步 {relativeTime(data.meta.github.lastSyncAt)}
        </span>
        <span>
          知识索引 {data.meta.rag.documents} chunks / {data.meta.rag.terms} terms
        </span>
        <span>GIT TREND MONITOR · OPEN SOURCE INTELLIGENCE</span>
      </footer>
    </div>
  )
}
