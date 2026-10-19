import { useState, type CSSProperties } from 'react'
import {
  Activity,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  Copy,
  Database,
  Github,
  Key,
  RefreshCw,
  Server,
  ShieldCheck,
  Sparkles,
  Wifi,
  WifiOff
} from 'lucide-react'
import { api } from '../lib/api'
import { useApiData } from '../lib/useApiData'
import { useApp } from '../context/AppContext'
import type { SourcesResponse } from '../lib/types'
import {
  dateTime,
  formatDuration,
  relativeTime
} from '../lib/format'
import { EmptyState, Skeleton, Spinner, Toggle } from '../components/ui'

const envExample = `# GitHub 数据源（可选，配置后提升 API 配额）
GITHUB_TOKEN=ghp_xxxxxxxxxxxx

# 远程模型（可选；留空时使用本地 RAG）
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxx
DEEPSEEK_MODEL=deepseek-chat
# DEEPSEEK_BASE_URL=https://api.deepseek.com

# 预警 Webhook（可选；规则勾选 Webhook 时生效）
ALERT_WEBHOOK_URL=

# 服务端口
PORT=8787`

const intervalOptions = [5, 15, 30, 60, 120, 360, 720, 1440]

function sourceLabel(source: string): string {
  if (source === 'seed') return '演示基线'
  if (source === 'github-token') return 'GitHub Token'
  if (source === 'github-public') return 'GitHub 公共 API'
  return source
}

function SourcesSkeleton() {
  return (
    <div className="page page-sources">
      <div className="page-header">
        <div>
          <Skeleton width={230} height={12} />
          <Skeleton width={360} height={42} style={{ marginTop: 17 }} />
        </div>
      </div>
      <div className="source-card-grid">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} width="100%" height={280} />
        ))}
      </div>
      <Skeleton width="100%" height={260} style={{ marginTop: 22 }} />
    </div>
  )
}

export default function SourcesPage() {
  const { toast, refreshAlertCount } = useApp()
  const { data, loading, error, reload } = useApiData(() => api.sources(), [])
  const [syncing, setSyncing] = useState(false)
  const [reindexing, setReindexing] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [showEnv, setShowEnv] = useState(false)

  if (loading && !data) return <SourcesSkeleton />
  if (error && !data) {
    return (
      <div className="page page-sources">
        <EmptyState
          icon={<Database size={20} />}
          title="数据源状态无法读取"
          description={error}
          action={
            <button type="button" className="button button-primary" onClick={reload}>
              重新读取
            </button>
          }
        />
      </div>
    )
  }
  if (!data) return null

  const { github, ai, rag } = data
  const isLive = github.mode === 'live'

  const runSync = async () => {
    if (syncing) return
    setSyncing(true)
    try {
      const result = await api.sync()
      if (result.ok) {
        toast(`同步完成 · 扫描 ${result.scanned ?? 0} 个项目，新增 ${result.added ?? 0} / 更新 ${result.updated ?? 0}`)
        window.dispatchEvent(new Event('gtm:sync'))
        await refreshAlertCount()
      } else {
        toast(result.error || result.message || '同步失败，请检查网络或 GitHub Token', 'error')
      }
      await reload()
    } catch (err) {
      toast(err instanceof Error ? err.message : '同步失败，请稍后重试', 'error')
      await reload()
    } finally {
      setSyncing(false)
    }
  }

  const rebuild = async () => {
    setReindexing(true)
    try {
      const result = await api.reindex()
      toast(`知识索引已重建 · ${result.stats.documents} 个片段 / ${result.stats.terms} 个检索词`)
      await reload()
    } catch (err) {
      toast(err instanceof Error ? err.message : '重建索引失败', 'error')
    } finally {
      setReindexing(false)
    }
  }

  const updateSettings = async (payload: { autoSync?: boolean; intervalMinutes?: number }) => {
    if (savingSettings) return
    setSavingSettings(true)
    try {
      await api.updateSettings(payload)
      toast(
        typeof payload.autoSync === 'boolean'
          ? payload.autoSync
            ? '已开启自动同步'
            : '已暂停自动同步'
          : '同步频率已更新'
      )
      await reload()
    } catch (err) {
      toast(err instanceof Error ? err.message : '设置保存失败', 'error')
    } finally {
      setSavingSettings(false)
    }
  }

  const copyEnv = async () => {
    try {
      await navigator.clipboard.writeText(envExample)
      toast('环境变量示例已复制')
    } catch {
      toast('复制失败，请手动选择文本', 'error')
    }
  }

  const minimumDocuments = Math.max(1, rag.projects * 2)
  const indexHealth = Math.min(100, Math.round((rag.documents / minimumDocuments) * 100))

  return (
    <div className="page page-sources">
      <header className="page-header reveal">
        <div className="page-header-copy">
          <div className="page-eyebrow">
            <span className="eyebrow-pip" />
            DATA PIPELINE · CONNECTIONS
          </div>
          <h1>
            数据源<span className="title-period">。</span>
            <span className="h1-secondary">管理信号从哪里来，又用什么回答问题。</span>
          </h1>
          <p>连接 GitHub 实时数据、配置远程模型，或让整套系统完全运行在本地。</p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={runSync}
            disabled={syncing || github.running}
          >
            {syncing || github.running ? <Spinner size={14} /> : <RefreshCw size={15} />}
            {syncing || github.running ? '同步中…' : '立即同步'}
          </button>
          <button type="button" className="button button-primary" onClick={rebuild} disabled={reindexing}>
            {reindexing ? <Spinner size={14} /> : <Sparkles size={15} />}
            重建知识索引
          </button>
        </div>
      </header>

      {!isLive && (
        <div className="data-notice reveal">
          <span className="data-notice-icon"><CircleAlert size={16} /></span>
          <p>
            <strong>当前使用演示基线。</strong>
            项目数据来自 30 个真实开源项目的初始快照。点击「立即同步」通过 GitHub 公共 API 拉取最新趋势；配置 Token 可获得更高配额。
          </p>
          <button type="button" className="text-link small" onClick={() => setShowEnv(true)}>
            查看配置方式
          </button>
        </div>
      )}

      <div className="source-card-grid reveal reveal-delay-1">
        <article className="source-card github-card">
          <div className="source-card-head">
            <span className="source-brand github">
              <Github size={20} />
            </span>
            <span className={`connection-badge ${isLive ? 'is-live' : 'is-demo'}`}>
              <span />
              {isLive ? '实时数据已连接' : '演示基线'}
            </span>
          </div>
          <div className="source-card-title">
            <span className="panel-kicker">GITHUB REST API</span>
            <h2>GitHub 趋势源</h2>
            <p>持续发现近期创建、正在快速获得关注的开源项目，并更新 Stars、Forks 与活跃度。</p>
          </div>
          <div className="source-detail-list">
            <div>
              <span>鉴权方式</span>
              <strong>{github.authenticated ? 'Personal Access Token' : '公共 API（无 Token）'}</strong>
            </div>
            <div>
              <span>速率上限</span>
              <strong>{github.rateLimit}</strong>
            </div>
            <div>
              <span>上次同步</span>
              <strong>{github.lastSyncAt ? dateTime(github.lastSyncAt) : '尚未同步'}</strong>
            </div>
          </div>
          <div className="source-card-footer">
            <span className={`status-inline ${isLive ? 'is-live' : 'is-demo'}`}>
              {isLive ? <Wifi size={13} /> : <WifiOff size={13} />}
              {isLive ? '数据管线在线' : '等待首次实时同步'}
            </span>
            <button type="button" className="source-action" onClick={runSync} disabled={syncing}>
              {syncing ? <Spinner size={13} /> : '同步数据'}
              <span>↗</span>
            </button>
          </div>
        </article>

        <article className="source-card ai-card">
          <div className="source-card-head">
            <span className="source-brand ai">
              <Sparkles size={20} />
            </span>
            <span className={`connection-badge ${ai.mode === 'remote' ? 'is-live' : 'is-local'}`}>
              <span />
              {ai.mode === 'remote' ? '远程模型' : '本地模式'}
            </span>
          </div>
          <div className="source-card-title">
            <span className="panel-kicker">AI GENERATION LAYER</span>
            <h2>研究助手模型</h2>
            <p>
              {ai.mode === 'remote'
                ? '检索在本地完成，仅将命中的项目上下文发送给远程模型生成答案。'
                : '未配置远程模型。回答由 BM25 检索、趋势聚合与本地生成器完成，数据不出本机。'}
            </p>
          </div>
          <div className="source-detail-list">
            <div>
              <span>运行模式</span>
              <strong>{ai.mode === 'remote' ? 'Remote LLM + Local RAG' : 'Local RAG'}</strong>
            </div>
            <div>
              <span>模型 / 方法</span>
              <strong>{ai.model}</strong>
            </div>
            <div>
              <span>服务端点</span>
              <strong>{ai.baseUrl || '仅本地进程'}</strong>
            </div>
          </div>
          <div className="source-card-footer">
            <span className={`status-inline ${ai.mode === 'remote' ? 'is-live' : 'is-local'}`}>
              <ShieldCheck size={13} />
              {ai.mode === 'remote' ? '仅发送检索上下文' : '数据不外发'}
            </span>
            <button type="button" className="source-action" onClick={() => setShowEnv(true)}>
              配置模型 <span>↗</span>
            </button>
          </div>
        </article>

        <article className="source-card rag-card">
          <div className="source-card-head">
            <span className="source-brand rag">
              <Database size={20} />
            </span>
            <div className="health-ring" style={{ '--health': `${indexHealth * 3.6}deg` } as CSSProperties}>
              <span>{indexHealth}%</span>
            </div>
          </div>
          <div className="source-card-title">
            <span className="panel-kicker">RETRIEVAL INDEX</span>
            <h2>本地知识索引</h2>
            <p>每个项目拆成概览、能力场景与 README 三类片段，使用中英双语分词与 BM25 排序。</p>
          </div>
          <div className="rag-stat-row">
            <div>
              <strong>{rag.documents}</strong>
              <span>知识片段</span>
            </div>
            <div>
              <strong>{rag.projects}</strong>
              <span>项目</span>
            </div>
            <div>
              <strong>{rag.terms}</strong>
              <span>检索词</span>
            </div>
          </div>
          <div className="source-card-footer">
            <span className="status-inline is-local">
              <CheckCircle2 size={13} />
              {rag.method}
            </span>
            <button type="button" className="source-action" onClick={rebuild} disabled={reindexing}>
              {reindexing ? <Spinner size={13} /> : '重新索引'}
              <span>↗</span>
            </button>
          </div>
        </article>
      </div>

      <div className="source-lower-grid reveal reveal-delay-2">
        <section className="panel sync-settings-card">
          <header className="panel-head compact-head">
            <div className="panel-title-block">
              <div className="panel-kicker">
                <span className="kicker-line" />
                INGESTION SCHEDULE
              </div>
              <h2>同步策略</h2>
              <p className="panel-subtitle">控制趋势快照的更新节奏</p>
            </div>
            <span className={`schedule-state ${github.autoSync ? 'is-on' : ''}`}>
              <span />
              {github.autoSync ? '自动同步运行中' : '自动同步已暂停'}
            </span>
          </header>

          <div className="settings-list">
            <div className="settings-row">
              <span className="settings-icon"><Clock3 size={16} /></span>
              <div className="settings-copy">
                <strong>自动同步</strong>
                <span>按照设定频率访问 GitHub，并在数据变化时触发规则检查。</span>
              </div>
              <Toggle
                checked={github.autoSync}
                onChange={(value) => updateSettings({ autoSync: value })}
                label="自动同步"
              />
            </div>
            <div className="settings-row">
              <span className="settings-icon"><Activity size={16} /></span>
              <div className="settings-copy">
                <strong>同步频率</strong>
                <span>高频同步会消耗更多 API 配额；有 Token 时建议 15–30 分钟。</span>
              </div>
              <label className="select-wrap settings-select">
                <select
                  value={github.intervalMinutes}
                  disabled={!github.autoSync || savingSettings}
                  onChange={(event) => updateSettings({ intervalMinutes: Number(event.target.value) })}
                >
                  {intervalOptions.map((value) => (
                    <option value={value} key={value}>
                      {value < 60 ? `${value} 分钟` : `${value / 60} 小时`}
                    </option>
                  ))}
                </select>
                <ChevronDown size={13} />
              </label>
            </div>
            <div className="settings-row">
              <span className="settings-icon"><Server size={16} /></span>
              <div className="settings-copy">
                <strong>下次计划同步</strong>
                <span>服务运行时由后台任务执行，关闭页面也不会停止。</span>
              </div>
              <span className="settings-value">
                {github.autoSync && github.nextSyncAt ? dateTime(github.nextSyncAt) : '已暂停'}
              </span>
            </div>
            <div className="settings-row">
              <span className="settings-icon"><Key size={16} /></span>
              <div className="settings-copy">
                <strong>GitHub Token</strong>
                <span>密钥只由本地服务读取，不会暴露给浏览器前端。</span>
              </div>
              <span className={`settings-value ${github.tokenConfigured ? 'positive' : ''}`}>
                {github.tokenConfigured ? '已配置' : '未配置'}
              </span>
            </div>
          </div>
        </section>

        <section className="panel pipeline-card">
          <header className="panel-head compact-head">
            <div className="panel-title-block">
              <div className="panel-kicker">
                <span className="kicker-line" />
                PIPELINE STATUS
              </div>
              <h2>管线状态</h2>
            </div>
          </header>
          <div className="pipeline-list">
            <div className="pipeline-step is-done">
              <span className="pipeline-node"><CheckCircle2 size={14} /></span>
              <div>
                <strong>数据采集</strong>
                <span>{isLive ? 'GitHub API 在线' : '演示快照已载入'}</span>
              </div>
              <span className="pipeline-time">{relativeTime(github.lastSyncAt)}</span>
            </div>
            <div className="pipeline-step is-done">
              <span className="pipeline-node"><CheckCircle2 size={14} /></span>
              <div>
                <strong>知识切片</strong>
                <span>{rag.documents} 个片段 · {rag.method}</span>
              </div>
              <span className="pipeline-time">{rag.builtAt ? relativeTime(rag.builtAt) : '—'}</span>
            </div>
            <div className="pipeline-step is-done">
              <span className="pipeline-node"><CheckCircle2 size={14} /></span>
              <div>
                <strong>预警引擎</strong>
                <span>{github.autoSync ? '规则巡检在线' : '仅手动触发'}</span>
              </div>
              <span className="pipeline-time">{github.autoSync ? '自动' : '暂停'}</span>
            </div>
            <div className="pipeline-step is-done">
              <span className="pipeline-node"><Sparkles size={14} /></span>
              <div>
                <strong>研究助手</strong>
                <span>{ai.mode === 'remote' ? '远程模型 + 本地检索' : '本地 RAG 就绪'}</span>
              </div>
              <span className="pipeline-time">在线</span>
            </div>
          </div>
          <div className="pipeline-foot">
            <span className="status-orb" />
            服务健康 · 最近 24 小时无异常
          </div>
        </section>
      </div>

      <section className="panel sync-log-card reveal reveal-delay-3">
        <header className="panel-head compact-head">
          <div className="panel-title-block">
            <div className="panel-kicker">
              <span className="kicker-line" />
              SYNC ACTIVITY
            </div>
            <div className="inline-title-row">
              <h2>同步记录</h2>
              <span className="result-count">{data.syncLogs.length} 条</span>
            </div>
          </div>
          <span className="panel-subtitle">保留最近 25 次任务</span>
        </header>

        <div className="table-scroll">
          <table className="sync-log-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>状态</th>
                <th>任务</th>
                <th>来源</th>
                <th className="numeric">新增</th>
                <th className="numeric">更新</th>
                <th className="numeric">耗时</th>
              </tr>
            </thead>
            <tbody>
              {data.syncLogs.map((log) => (
                <tr key={log.id}>
                  <td title={log.at}>
                    <span className="sync-time-cell">{relativeTime(log.at)}</span>
                    <small>{dateTime(log.at)}</small>
                  </td>
                  <td>
                    <span className={`log-status log-${log.status}`}>
                      {log.status === 'success' ? <CheckCircle2 size={12} /> : <CircleAlert size={12} />}
                      {log.status === 'success' ? '成功' : '失败'}
                    </span>
                  </td>
                  <td>
                    <span className="log-message">{log.message}</span>
                  </td>
                  <td>
                    <span className="log-source">{sourceLabel(log.source)}</span>
                  </td>
                  <td className="numeric">{log.added || '—'}</td>
                  <td className="numeric">{log.updated || '—'}</td>
                  <td className="numeric">{formatDuration(log.duration)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <footer className="table-footer">
          <span>同步任务由本地 Node.js 服务执行</span>
          <span>时序：采集 → 规则检查 → 知识索引重建</span>
        </footer>
      </section>

      <section className="env-card reveal reveal-delay-4">
        <div className="env-card-head" onClick={() => setShowEnv((value) => !value)} role="button" tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') setShowEnv((value) => !value)
          }}
        >
          <span className="env-icon"><ShieldCheck size={18} /></span>
          <div>
            <span className="panel-kicker">OPTIONAL CONFIGURATION</span>
            <h2>接入实时数据与远程模型</h2>
            <p>所有配置通过项目根目录的 .env 完成。不配置也能使用完整的演示、RAG 与预警能力。</p>
          </div>
          <div className="env-actions">
            {showEnv && (
              <button
                type="button"
                className="button button-quiet button-small"
                onClick={(event) => {
                  event.stopPropagation()
                  copyEnv()
                }}
              >
                <Copy size={13} />
                复制配置
              </button>
            )}
            <ChevronDown size={17} className={`env-chevron ${showEnv ? 'is-open' : ''}`} />
          </div>
        </div>
        {showEnv && (
          <div className="env-body">
            <pre><code>{envExample}</code></pre>
            <div className="env-notes">
              <div>
                <span><Github size={13} /> GitHub Token</span>
                <p>在 GitHub Settings → Developer settings 创建 fine-grained token，只需 public repo 读取权限。</p>
              </div>
              <div>
                <span><Sparkles size={13} /> 远程模型</span>
                <p>兼容 OpenAI Chat Completions 接口。配置成功后会显示模型来源，并仅在生成阶段发送检索上下文。</p>
              </div>
              <div>
                <span><RefreshCw size={13} /> 生效方式</span>
                <p>修改 .env 后重启 Node 服务。浏览器端不会接触任何密钥。</p>
              </div>
            </div>
          </div>
        )}
      </section>

      <footer className="page-footnote">
        <span>
          <span className="status-orb" />
          数据管线健康
        </span>
        <span>本地服务 · 127.0.0.1:8787</span>
        <span>GIT TREND MONITOR · DATA LAYER</span>
      </footer>
    </div>
  )
}
