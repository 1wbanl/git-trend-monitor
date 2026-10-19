import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import {
  Activity,
  Bell,
  BellRing,
  Check,
  CircleAlert,
  Clock3,
  Link2,
  Plus,
  Radio,
  Sparkles,
  Star,
  Trash2,
  TrendingUp,
  X,
  Zap
} from 'lucide-react'
import { api } from '../lib/api'
import { useApiData } from '../lib/useApiData'
import { useApp } from '../context/AppContext'
import type { AlertRule, SignalEvent } from '../lib/types'
import {
  dateTime,
  relativeTime,
  severityLabel
} from '../lib/format'
import { EmptyState, Skeleton, Spinner, Toggle } from '../components/ui'

const metricOptions = [
  { value: 'dailyStars', label: '单日新增 Stars', unit: 'stars', icon: Zap },
  { value: 'weeklyGrowthPct', label: '7 日增速', unit: '%', icon: TrendingUp },
  { value: 'stars', label: '总 Stars 里程碑', unit: 'stars', icon: Star },
  { value: 'topicGrowth', label: '话题热度周环比', unit: '%', icon: Radio },
  { value: 'release', label: '项目活跃更新', unit: '次', icon: Sparkles }
]

const metricLabels: Record<string, string> = {
  dailyStars: '单日新增 Stars',
  weeklyGrowthPct: '7 日增速',
  stars: 'Stars 总量',
  topicGrowth: '话题热度',
  release: '项目活跃更新'
}

const channelMeta: Record<string, { label: string; icon: typeof Bell }> = {
  inapp: { label: '站内信号', icon: Bell },
  webhook: { label: 'Webhook', icon: Link2 }
}

const scopeOptions = ['全部', 'AI 应用', '智能体', '开发工具', '基础设施', '数据与搜索', '设计前端']

function RuleCard({
  rule,
  onToggle,
  onDelete,
  pending
}: {
  rule: AlertRule
  onToggle: (rule: AlertRule) => void
  onDelete: (rule: AlertRule) => void
  pending: boolean
}) {
  const option = metricOptions.find((item) => item.value === rule.metric)
  const Icon = option?.icon || Activity
  return (
    <article className={`rule-card ${rule.enabled ? 'is-enabled' : 'is-disabled'}`}>
      <div className="rule-card-top">
        <span className={`rule-icon ${rule.enabled ? 'is-active' : ''}`}>
          <Icon size={17} />
        </span>
        <div className="rule-card-title">
          <div>
            <strong>{rule.name}</strong>
            <span className={`rule-state ${rule.enabled ? 'is-on' : ''}`}>
              {rule.enabled ? '运行中' : '已暂停'}
            </span>
          </div>
          <p>{rule.description}</p>
        </div>
        <button
          type="button"
          className="rule-delete"
          onClick={() => onDelete(rule)}
          aria-label={`删除规则 ${rule.name}`}
          title="删除规则"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="rule-condition">
        <span className="rule-metric">{metricLabels[rule.metric] || rule.metric}</span>
        {rule.metric === 'release' ? (
          <strong className="rule-release-value">出现新的代码更新</strong>
        ) : (
          <strong>
            {rule.operator} {rule.threshold.toLocaleString('en-US')}
            {rule.metric === 'weeklyGrowthPct' || rule.metric === 'topicGrowth' ? '%' : ''}
          </strong>
        )}
        <span className="rule-window">/ {rule.window}</span>
      </div>

      <div className="rule-chips">
        <span className="rule-scope">{rule.scopeLabel}</span>
        {rule.channels.map((channel) => {
          const meta = channelMeta[channel] || channelMeta.inapp
          const ChannelIcon = meta.icon
          return (
            <span className="rule-channel" key={channel}>
              <ChannelIcon size={11} />
              {meta.label}
            </span>
          )
        })}
      </div>

      <div className="rule-card-foot">
        <span>
          上次触发 <strong>{rule.lastTriggeredAt ? relativeTime(rule.lastTriggeredAt) : '尚未触发'}</strong>
        </span>
        <span>累计 {rule.triggers} 次</span>
        <div className="rule-toggle-wrap">
          {pending ? <Spinner size={14} /> : <Toggle checked={rule.enabled} onChange={() => onToggle(rule)} label="启用规则" />}
        </div>
      </div>
    </article>
  )
}

function AlertRuleModal({
  open,
  onClose,
  onCreated
}: {
  open: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const { toast, refreshAlertCount } = useApp()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [metric, setMetric] = useState('weeklyGrowthPct')
  const [operator, setOperator] = useState('>')
  const [threshold, setThreshold] = useState('5')
  const [windowValue, setWindowValue] = useState('7d')
  const [scope, setScope] = useState('全部')
  const [channels, setChannels] = useState<string[]>(['inapp'])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    document.body.classList.add('modal-open')
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.classList.remove('modal-open')
    }
  }, [open, onClose])

  useEffect(() => {
    if (open) {
      setName('')
      setDescription('')
      setMetric('weeklyGrowthPct')
      setOperator('>')
      setThreshold('5')
      setWindowValue('7d')
      setScope('全部')
      setChannels(['inapp'])
    }
  }, [open])

  if (!open) return null

  const selectedMetric = metricOptions.find((item) => item.value === metric)
  const unit = selectedMetric?.unit || ''
  const conditionText =
    metric === 'release'
      ? '出现新的代码更新'
      : `${metricLabels[metric]} ${operator} ${threshold || '—'}${
          metric === 'weeklyGrowthPct' || metric === 'topicGrowth' ? '%' : ''
        }`
  const preview = `当${scope === '全部' ? '全部跟踪项目' : `${scope}分类项目`}在 ${windowValue} 内${conditionText}时，向${
    channels.map((channel) => channelMeta[channel]?.label || channel).join('、') || '站内'
  }发送信号。`

  const toggleChannel = (channel: string) => {
    setChannels((current) =>
      current.includes(channel) ? current.filter((item) => item !== channel) : [...current, channel]
    )
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) {
      toast('请给规则起个名字', 'error')
      return
    }
    const numeric = Number(threshold)
    if (!Number.isFinite(numeric) || numeric < 0) {
      toast('阈值需要是一个有效数字', 'error')
      return
    }
    if (!channels.length) {
      toast('至少选择一个通知通道', 'error')
      return
    }
    setSubmitting(true)
    try {
      await api.createAlert({
        name: name.trim(),
        description: description.trim() || `监控${scope === '全部' ? '全部项目' : scope}的${metricLabels[metric]}`,
        metric,
        operator,
        threshold: numeric,
        window: windowValue,
        scope,
        channels
      })
      toast('新预警规则已开始运行')
      await refreshAlertCount()
      onCreated()
      onClose()
    } catch (error) {
      toast(error instanceof Error ? error.message : '创建失败，请稍后重试', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="rule-modal"
        role="dialog"
        aria-modal="true"
        aria-label="新建预警规则"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="rule-modal-head">
          <div>
            <span className="eyebrow-mini">AUTOMATION · ALERT RULE</span>
            <h2>新建智能预警</h2>
            <p>定义你关心的变化，规则引擎会持续巡检并在命中时留下证据。</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="关闭">
            <X size={17} />
          </button>
        </header>

        <form onSubmit={submit}>
          <div className="rule-modal-body">
            <div className="form-row">
              <label className="form-field">
                <span>规则名称</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="例如：AI 应用增速异动"
                  maxLength={60}
                  autoFocus
                />
              </label>
              <label className="form-field">
                <span>监控范围</span>
                <select value={scope} onChange={(event) => setScope(event.target.value)}>
                  {scopeOptions.map((option) => (
                    <option value={option} key={option}>
                      {option === '全部' ? '全部跟踪项目' : option}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="form-field">
              <span>一句话描述 <em>可选</em></span>
              <input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="这条规则为什么重要？"
                maxLength={180}
              />
            </label>

            <div className="form-section-label">
              <span>触发条件</span>
              <i />
            </div>
            <div className={`form-row condition-row ${metric === 'release' ? 'is-release' : ''}`}>
              <label className="form-field">
                <span>监控指标</span>
                <select value={metric} onChange={(event) => setMetric(event.target.value)}>
                  {metricOptions.map((option) => (
                    <option value={option.value} key={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              {metric !== 'release' && (
                <>
                  <label className="form-field operator-field">
                    <span>比较</span>
                    <select value={operator} onChange={(event) => setOperator(event.target.value)}>
                      <option value=">">大于 &gt;</option>
                      <option value=">=">大于等于 ≥</option>
                      <option value="<">小于 &lt;</option>
                      <option value="=">等于 =</option>
                    </select>
                  </label>
                  <label className="form-field threshold-field">
                    <span>阈值</span>
                    <div className="input-suffix">
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={threshold}
                        onChange={(event) => setThreshold(event.target.value)}
                      />
                      <span>{unit}</span>
                    </div>
                  </label>
                </>
              )}
              <label className="form-field window-field">
                <span>统计窗口</span>
                <select value={windowValue} onChange={(event) => setWindowValue(event.target.value)}>
                  <option value="24h">24 小时</option>
                  <option value="7d">7 天</option>
                  <option value="30d">30 天</option>
                  <option value="即时">即时</option>
                </select>
              </label>
            </div>

            <div className="form-section-label">
              <span>通知通道</span>
              <i />
            </div>
            <div className="channel-options">
              {Object.entries(channelMeta).map(([key, meta]) => {
                const Icon = meta.icon
                const checked = channels.includes(key)
                return (
                  <button
                    type="button"
                    key={key}
                    className={`channel-option ${checked ? 'is-checked' : ''}`}
                    onClick={() => toggleChannel(key)}
                  >
                    <span className="channel-check">{checked && <Check size={11} />}</span>
                    <Icon size={15} />
                    {meta.label}
                  </button>
                )
              })}
            </div>

            <div className="rule-preview">
              <span className="rule-preview-icon">
                <BellRing size={16} />
              </span>
              <div>
                <span>规则预览</span>
                <p>{preview}</p>
              </div>
            </div>
          </div>

          <footer className="rule-modal-foot">
            <span>规则保存后立即生效，可在预警中心随时暂停。</span>
            <div>
              <button type="button" className="button button-quiet" onClick={onClose}>
                取消
              </button>
              <button type="submit" className="button button-primary" disabled={submitting}>
                {submitting ? <Spinner size={14} /> : <Zap size={14} />}
                {submitting ? '正在创建…' : '创建并启用'}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>,
    document.body
  )
}

function AlertsSkeleton() {
  return (
    <div className="page page-alerts">
      <div className="page-header">
        <div>
          <Skeleton width={230} height={12} />
          <Skeleton width={330} height={42} style={{ marginTop: 17 }} />
        </div>
      </div>
      <div className="alert-stat-grid">
        {[0, 1, 2, 3].map((item) => (
          <Skeleton width="100%" height={105} key={item} />
        ))}
      </div>
      <div className="rule-grid">
        {[0, 1, 2, 3].map((item) => (
          <Skeleton width="100%" height={210} key={item} />
        ))}
      </div>
    </div>
  )
}

export default function AlertsPage() {
  const { toast, refreshAlertCount, openProject, projectRevision } = useApp()
  const [searchParams, setSearchParams] = useSearchParams()
  const [modalOpen, setModalOpen] = useState(false)
  const [filter, setFilter] = useState<'all' | 'unread' | 'high'>('all')
  const [pendingRule, setPendingRule] = useState<string | null>(null)
  const { data, loading, error, reload } = useApiData(() => api.alerts(), [projectRevision])

  useEffect(() => {
    if (searchParams.get('new') === '1') setModalOpen(true)
  }, [searchParams])

  const closeModal = () => {
    setModalOpen(false)
    if (searchParams.get('new')) {
      const next = new URLSearchParams(searchParams)
      next.delete('new')
      setSearchParams(next, { replace: true })
    }
  }

  const events = useMemo(() => {
    if (!data) return []
    if (filter === 'unread') return data.events.filter((event) => !event.read)
    if (filter === 'high') return data.events.filter((event) => event.severity === 'high')
    return data.events
  }, [data, filter])

  const toggleRule = async (rule: AlertRule) => {
    setPendingRule(rule.id)
    try {
      await api.updateAlert(rule.id, { enabled: !rule.enabled })
      toast(rule.enabled ? `已暂停「${rule.name}」` : `已启用「${rule.name}」`, rule.enabled ? 'info' : 'success')
      reload()
    } catch (err) {
      toast(err instanceof Error ? err.message : '操作失败', 'error')
    } finally {
      setPendingRule(null)
    }
  }

  const deleteRule = async (rule: AlertRule) => {
    if (!window.confirm(`确定删除预警规则「${rule.name}」吗？已有信号记录不会被删除。`)) return
    setPendingRule(rule.id)
    try {
      await api.deleteAlert(rule.id)
      toast('预警规则已删除')
      reload()
    } catch (err) {
      toast(err instanceof Error ? err.message : '删除失败', 'error')
    } finally {
      setPendingRule(null)
    }
  }

  const markAllRead = async () => {
    try {
      await api.markEventsRead()
      toast('全部信号已标记为已读')
      reload()
      await refreshAlertCount()
    } catch {
      toast('操作失败，请稍后重试', 'error')
    }
  }

  const markRead = async (event: SignalEvent) => {
    if (event.read) return
    try {
      await api.markEventsRead([event.id])
      reload()
      await refreshAlertCount()
    } catch {
      toast('标记已读失败', 'error')
    }
  }

  if (loading && !data) return <AlertsSkeleton />

  return (
    <div className="page page-alerts">
      <header className="page-header reveal">
        <div className="page-header-copy">
          <div className="page-eyebrow">
            <span className="eyebrow-pip" />
            ALERT ENGINE · {data?.stats.activeRules || 0} RULES ACTIVE
          </div>
          <h1>
            智能预警<span className="title-period">。</span>
            <span className="h1-secondary">让系统替你盯住拐点。</span>
          </h1>
          <p>把增速、里程碑与话题变化写成规则，在值得注意的时刻收到一条有证据的信号。</p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={markAllRead}
            disabled={!data?.stats.unread}
          >
            <Check size={15} />
            全部已读
          </button>
          <button type="button" className="button button-primary" onClick={() => setModalOpen(true)}>
            <Plus size={15} />
            新建规则
          </button>
        </div>
      </header>

      {error && !data ? (
        <EmptyState
          icon={<CircleAlert size={20} />}
          title="预警中心暂时不可用"
          description={error}
          action={
            <button type="button" className="button button-primary" onClick={reload}>
              重新加载
            </button>
          }
        />
      ) : (
        <>
          <div className="alert-stat-grid reveal reveal-delay-1">
            <div className="alert-stat">
              <span className="alert-stat-icon tone-lime"><Activity size={16} /></span>
              <span className="alert-stat-label">运行中的规则</span>
              <strong>{data?.stats.activeRules || 0}<small> / {data?.stats.totalRules || 0}</small></strong>
              <span className="alert-stat-foot">
                <span className="status-orb" /> 引擎每 30 分钟巡检
              </span>
            </div>
            <div className="alert-stat">
              <span className="alert-stat-icon tone-amber"><BellRing size={16} /></span>
              <span className="alert-stat-label">未读信号</span>
              <strong>{data?.stats.unread || 0}</strong>
              <span className="alert-stat-foot">需要你的判断</span>
            </div>
            <div className="alert-stat">
              <span className="alert-stat-icon tone-blue"><TrendingUp size={16} /></span>
              <span className="alert-stat-label">本周触发</span>
              <strong>{data?.stats.triggeredThisWeek || 0}</strong>
              <span className="alert-stat-foot">含规则启用通知</span>
            </div>
            <div className="alert-stat">
              <span className="alert-stat-icon tone-coral"><CircleAlert size={16} /></span>
              <span className="alert-stat-label">高优先信号</span>
              <strong>{data?.stats.highPriority || 0}</strong>
              <span className="alert-stat-foot">建议优先查看</span>
            </div>
          </div>

          <section className="alerts-rules-section reveal reveal-delay-2">
            <div className="section-head">
              <div>
                <div className="panel-kicker">
                  <span className="kicker-line" />
                  MONITORING RULES
                </div>
                <div className="inline-title-row">
                  <h2>预警规则</h2>
                  <span className="title-chip">{data?.rules.length || 0} 条</span>
                </div>
              </div>
              <span className="section-head-note">暂停规则会保留所有历史信号</span>
            </div>

            <div className="rule-grid">
              {data?.rules.map((rule) => (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  onToggle={toggleRule}
                  onDelete={deleteRule}
                  pending={pendingRule === rule.id}
                />
              ))}
              <button type="button" className="new-rule-card" onClick={() => setModalOpen(true)}>
                <span className="new-rule-icon">
                  <Plus size={20} />
                </span>
                <strong>添加一条新规则</strong>
                <span>从增速、里程碑或话题热度开始</span>
              </button>
            </div>
          </section>

          <section className="panel signal-timeline-panel reveal reveal-delay-3">
            <header className="signal-timeline-head">
              <div>
                <div className="panel-kicker">
                  <span className="kicker-line" />
                  SIGNAL EVIDENCE LOG
                </div>
                <div className="inline-title-row">
                  <h2>信号时间线</h2>
                  <span className="result-count">{events.length} 条记录</span>
                </div>
              </div>
              <div className="timeline-actions">
                <div className="mini-segment">
                  <button type="button" className={filter === 'all' ? 'is-active' : ''} onClick={() => setFilter('all')}>
                    全部
                  </button>
                  <button type="button" className={filter === 'unread' ? 'is-active' : ''} onClick={() => setFilter('unread')}>
                    未读
                  </button>
                  <button type="button" className={filter === 'high' ? 'is-active' : ''} onClick={() => setFilter('high')}>
                    高优先
                  </button>
                </div>
                <button
                  type="button"
                  className="text-link small"
                  onClick={markAllRead}
                  disabled={!data?.stats.unread}
                >
                  全部已读
                </button>
              </div>
            </header>

            {events.length ? (
              <div className="signal-timeline">
                {events.map((event) => (
                  <div
                    className={`timeline-item ${event.read ? 'is-read' : ''}`}
                    key={event.id}
                  >
                    <div className="timeline-time">
                      <strong>{relativeTime(event.createdAt)}</strong>
                      <span>{dateTime(event.createdAt)}</span>
                    </div>
                    <div className="timeline-line">
                      <span className={`timeline-node severity-bg-${event.severity}`}>
                        <span />
                      </span>
                    </div>
                    <div className="timeline-content">
                      <div className="timeline-meta">
                        <span className={`severity-tag severity-${event.severity}`}>
                          {severityLabel(event.severity)}
                        </span>
                        {!event.read && <span className="unread-dot">未读</span>}
                        {event.projectName && (
                          <button
                            type="button"
                            className="timeline-project"
                            onClick={() => event.projectId && openProject(event.projectId)}
                          >
                            {event.projectName}
                          </button>
                        )}
                      </div>
                      <h3>{event.title}</h3>
                      <p>{event.message}</p>
                      <div className="timeline-foot">
                        <span>
                          <Clock3 size={12} /> {dateTime(event.createdAt)}
                        </span>
                        {!event.read && (
                          <button type="button" onClick={() => markRead(event)}>
                            标为已读
                          </button>
                        )}
                        {event.projectId && (
                          <button type="button" onClick={() => openProject(event.projectId as string)}>
                            查看项目信号
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Bell size={21} />}
                title={filter === 'all' ? '还没有信号记录' : '此筛选下没有信号'}
                description={
                  filter === 'all'
                    ? '规则命中后会在这里留下完整证据，包括项目、指标与触发时间。'
                    : '切换筛选条件，或等待下一次规则巡检。'
                }
              />
            )}

            <footer className="timeline-footer">
              <span>
                <span className="status-orb" /> 规则引擎在线
              </span>
              <span>最多保留最近 50 条信号记录</span>
            </footer>
          </section>
        </>
      )}

      <AlertRuleModal open={modalOpen} onClose={closeModal} onCreated={reload} />
    </div>
  )
}
