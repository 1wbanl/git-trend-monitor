import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowUpRight,
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  ListFilter,
  Plus,
  Search,
  X
} from 'lucide-react'
import { api } from '../lib/api'
import { useApiData } from '../lib/useApiData'
import { useApp } from '../context/AppContext'
import type { Category, Opportunity, Project } from '../lib/types'
import {
  categoryColor,
  compactCount,
  momentumLabel,
  signedPct
} from '../lib/format'
import {
  CategoryPill,
  EmptyState,
  ProjectAvatar,
  Skeleton,
  Sparkline,
  Spinner
} from '../components/ui'
import { OpportunityMap } from '../components/OpportunityMap'

const languageOptions = ['all', 'TypeScript', 'Python', 'Go', 'Rust', 'JavaScript', 'Java', 'Svelte', 'Zig']

function ProjectCard({
  project,
  onTrack,
  pending
}: {
  project: Project
  onTrack: (project: Project) => void
  pending: boolean
}) {
  const { openProject } = useApp()
  const color = categoryColor(project.category)
  const momentum = momentumLabel(project.weeklyGrowthPct)

  return (
    <article
      className="project-card"
      role="button"
      tabIndex={0}
      onClick={() => openProject(project.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') openProject(project.id)
      }}
    >
      <div className="project-card-top">
        <ProjectAvatar name={project.name} owner={project.owner} size={39} />
        <div className="project-identity">
          <strong>{project.name}</strong>
          <span>{project.owner}</span>
        </div>
        <button
          type="button"
          className={`card-track ${project.tracked ? 'is-tracked' : ''}`}
          aria-label={project.tracked ? '取消跟踪' : '加入跟踪'}
          title={project.tracked ? '取消跟踪' : '加入跟踪'}
          disabled={pending}
          onClick={(event) => {
            event.stopPropagation()
            onTrack(project)
          }}
        >
          {pending ? <Spinner size={13} /> : project.tracked ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
        </button>
      </div>

      <p className="project-description">{project.description}</p>

      <div className="project-tags">
        {project.tags.slice(0, 2).map((tag) => (
          <span className="tag-mini" key={tag}>
            {tag}
          </span>
        ))}
        <span className="project-language">
          <i style={{ background: project.languageColor }} />
          {project.language}
        </span>
        <span className="project-card-version">{project.version}</span>
      </div>

      <div className="project-card-chart">
        <div className="project-card-numbers">
          <span>
            <strong>{compactCount(project.stars)}</strong> stars
          </span>
          <span>
            <strong>+{compactCount(project.weeklyGrowth)}</strong> / 7d
          </span>
        </div>
        <Sparkline values={project.sparkline} width={126} height={35} color={color} fill strokeWidth={1.8} />
      </div>

      <footer className="project-card-foot">
        <CategoryPill category={project.category} subtle />
        <span className={`momentum-tag momentum-${momentum.tone}`}>
          <i />
          {momentum.label} {signedPct(project.weeklyGrowthPct)}
        </span>
        <span className="project-open">
          查看信号
          <ArrowUpRight size={13} />
        </span>
      </footer>
    </article>
  )
}

function RadarSkeleton() {
  return (
    <div className="page page-trends">
      <div className="page-header">
        <div>
          <Skeleton width={220} height={12} />
          <Skeleton width={300} height={42} style={{ marginTop: 17 }} />
        </div>
      </div>
      <Skeleton width="100%" height={86} />
      <Skeleton width="100%" height={440} style={{ marginTop: 20 }} />
      <div className="project-grid">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <div className="project-card" key={index}>
            <Skeleton width={160} height={24} />
            <Skeleton width="100%" height={36} style={{ marginTop: 22 }} />
            <Skeleton width="100%" height={84} style={{ marginTop: 22 }} />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function TrendsPage() {
  const { toast, projectRevision, bumpProjects } = useApp()
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState(searchParams.get('q') || '')
  const [debouncedSearch, setDebouncedSearch] = useState(search)
  const [category, setCategory] = useState('all')
  const [language, setLanguage] = useState('all')
  const [trackedOnly, setTrackedOnly] = useState(false)
  const [sort, setSort] = useState('trending')
  const [visibleCount, setVisibleCount] = useState(12)
  const [pendingTrack, setPendingTrack] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const editing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable
      if (event.key === '/' && !editing) {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', focusSearch)
    return () => window.removeEventListener('keydown', focusSearch)
  }, [])

  useEffect(() => {
    const queryParam = searchParams.get('q')
    if (queryParam) {
      setSearch(queryParam)
      setDebouncedSearch(queryParam)
    }
  }, [searchParams])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 220)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setVisibleCount(12)
  }, [debouncedSearch, category, language, trackedOnly, sort])

  const { data, loading, refreshing, error, reload } = useApiData(
    () =>
      api.projects({
        query: debouncedSearch,
        category,
        language,
        tracked: trackedOnly ? 'true' : 'all',
        sort
      }),
    [debouncedSearch, category, language, trackedOnly, sort, projectRevision]
  )

  const opportunities = useMemo<Opportunity[]>(() => {
    if (!data) return []
    return data.items
      .slice()
      .sort((a, b) => b.trendingScore - a.trendingScore)
      .slice(0, 22)
      .map((project) => ({
        id: project.id,
        fullName: project.fullName,
        name: project.name,
        category: project.category,
        stars: project.stars,
        weeklyGrowth: project.weeklyGrowth,
        weeklyGrowthPct: project.weeklyGrowthPct,
        forks: project.forks,
        trendingScore: project.trendingScore,
        color: categoryColor(project.category)
      }))
  }, [data])

  const trackProject = async (project: Project) => {
    setPendingTrack(project.id)
    try {
      await api.updateProject(project.id, { tracked: !project.tracked })
      toast(
        project.tracked ? `已将 ${project.name} 移出跟踪清单` : `已跟踪 ${project.name}`,
        project.tracked ? 'info' : 'success'
      )
      bumpProjects()
    } catch (err) {
      toast(err instanceof Error ? err.message : '操作失败', 'error')
    } finally {
      setPendingTrack(null)
    }
  }

  const resetFilters = () => {
    setSearch('')
    setDebouncedSearch('')
    setCategory('all')
    setLanguage('all')
    setTrackedOnly(false)
    setSort('trending')
  }

  const activeFilters = Boolean(search || category !== 'all' || language !== 'all' || trackedOnly || sort !== 'trending')
  const categoryCount = (name: string) =>
    name === 'all'
      ? data?.allTotal || 0
      : data?.facets.categories.find((item) => item.name === (name as Category))?.count || 0

  if (loading && !data) return <RadarSkeleton />

  return (
    <div className="page page-trends">
      <header className="page-header reveal">
        <div className="page-header-copy">
          <div className="page-eyebrow">
            <span className="eyebrow-pip" />
            TREND RADAR · DISCOVERY
          </div>
          <h1>
            趋势雷达<span className="title-period">。</span>
            <span className="h1-secondary">在噪声出现之前，先看到信号。</span>
          </h1>
          <p>把项目的增速、体量与话题放到同一张地图上，寻找高潜机会。</p>
        </div>
        <div className="page-actions">
          <Link className="button button-secondary" to="/alerts?new=1">
            <Plus size={15} />
            新建预警
          </Link>
          <button type="button" className="button button-ghost" onClick={reload} disabled={refreshing}>
            {refreshing ? <Spinner size={14} /> : <ListFilter size={15} />}
            刷新视图
          </button>
        </div>
      </header>

      <section className="radar-toolbar panel reveal reveal-delay-1">
        <div className="radar-search-row">
          <div className="radar-search">
            <Search size={17} />
            <input
              ref={searchRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索项目名、技术主题或使用场景…"
              aria-label="搜索项目"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} aria-label="清空搜索">
                <X size={14} />
              </button>
            )}
            <kbd>/</kbd>
          </div>
          <div className="radar-filter-actions">
            <button
              type="button"
              className={`filter-toggle ${trackedOnly ? 'is-active' : ''}`}
              onClick={() => setTrackedOnly((value) => !value)}
            >
              <Bookmark size={14} />
              只看跟踪
              {trackedOnly && <span className="filter-dot" />}
            </button>
            <label className="select-wrap">
              <select value={language} onChange={(event) => setLanguage(event.target.value)} aria-label="语言筛选">
                <option value="all">全部语言</option>
                {languageOptions.slice(1).map((option) => (
                  <option value={option} key={option}>
                    {option}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} />
            </label>
            <label className="select-wrap">
              <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="排序方式">
                <option value="trending">趋势分排序</option>
                <option value="growth">7 日增量</option>
                <option value="momentum">7 日增速</option>
                <option value="stars">总 Stars</option>
                <option value="newest">最新创建</option>
              </select>
              <ChevronDown size={13} />
            </label>
            {activeFilters && (
              <button type="button" className="clear-filters" onClick={resetFilters}>
                重置
              </button>
            )}
          </div>
        </div>

        <div className="category-tabs" role="tablist" aria-label="项目分类">
          <button
            type="button"
            className={category === 'all' ? 'is-active' : ''}
            onClick={() => setCategory('all')}
          >
            全部
            <span>{categoryCount('all')}</span>
          </button>
          {data?.facets.categories.map((item) => (
            <button
              type="button"
              key={item.name}
              className={category === item.name ? 'is-active' : ''}
              style={category === item.name ? { borderColor: `${item.color}55` } : undefined}
              onClick={() => setCategory(item.name)}
            >
              <i style={{ background: item.color }} />
              {item.name}
              <span>{item.count}</span>
            </button>
          ))}
        </div>
      </section>

      {error && !data ? (
        <EmptyState
          icon={<Search size={20} />}
          title="趋势数据暂时不可用"
          description={error}
          action={
            <button type="button" className="button button-primary" onClick={reload}>
              重新加载
            </button>
          }
        />
      ) : (
        <>
          {opportunities.length > 4 && (
            <div className="reveal reveal-delay-2">
              <OpportunityMap opportunities={opportunities} />
            </div>
          )}

          <section className="discovery-section reveal reveal-delay-3">
            <header className="discovery-head">
              <div>
                <div className="panel-kicker">
                  <span className="kicker-line" />
                  PROJECT DISCOVERY
                </div>
                <div className="inline-title-row">
                  <h2>项目发现</h2>
                  <span className="result-count">
                    {data?.total || 0} 个结果
                    {activeFilters ? ' · 已筛选' : ''}
                  </span>
                </div>
              </div>
              <span className="discovery-note">
                {trackedOnly ? `跟踪池 ${data?.trackedTotal || 0} 个项目` : '从全部趋势项目中筛选'}
              </span>
            </header>

            {data?.items.length ? (
              <>
                <div className="project-grid">
                  {data.items.slice(0, visibleCount).map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      onTrack={trackProject}
                      pending={pendingTrack === project.id}
                    />
                  ))}
                </div>
                {data.items.length > visibleCount && (
                  <div className="load-more-wrap">
                    <button
                      type="button"
                      className="button button-secondary load-more"
                      onClick={() => setVisibleCount((count) => count + 9)}
                    >
                      加载更多项目
                      <span>{data.items.length - visibleCount}</span>
                    </button>
                  </div>
                )}
              </>
            ) : (
              <EmptyState
                icon={<Search size={21} />}
                title="没有找到符合筛选条件的项目"
                description="试试更宽泛的关键词，或清空语言与跟踪状态筛选。"
                action={
                  <button type="button" className="button button-secondary" onClick={resetFilters}>
                    清空全部筛选
                  </button>
                }
              />
            )}
          </section>
        </>
      )}
    </div>
  )
}
