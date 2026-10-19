import crypto from 'node:crypto'
import { addActivity, addAlertEvent, addSyncLog, getState, saveState } from './store.js'
import { rebuildIndex } from './rag.js'

const API_ROOT = 'https://api.github.com'
const TOKEN = process.env.GITHUB_TOKEN || ''
let running = false
let schedulerTimer = null

const CATEGORY_RULES = [
  {
    category: '智能体',
    words: ['agent', 'browser-use', 'browser automation', 'mcp', 'multi-agent', 'crew', 'autogen', 'computer use']
  },
  {
    category: '设计前端',
    words: ['react', 'vue', 'svelte', 'css', 'tailwind', 'component', 'ui library', 'frontend', 'astro', 'next.js']
  },
  {
    category: '数据与搜索',
    words: ['database', 'postgres', 'search engine', 'vector', 'knowledge base', 'rag', 'crawler', 'scraping', 'sql']
  },
  {
    category: '开发工具',
    words: ['editor', 'ide', 'cli', 'package manager', 'compiler', 'markdown', 'pdf', 'developer tool', 'terminal', 'runtime']
  },
  {
    category: '基础设施',
    words: ['kubernetes', 'docker', 'server', 'proxy', 'observability', 'inference', 'serving', 'storage', 'self-hosted', 'infrastructure']
  },
  {
    category: 'AI 应用',
    words: ['llm', 'ai', 'machine learning', 'diffusion', 'image generation', 'chatbot', 'model', 'deep learning']
  }
]

function classifyCategory(item) {
  const text = `${item.name} ${item.description || ''} ${(item.topics || []).join(' ')}`.toLowerCase()
  for (const rule of CATEGORY_RULES) {
    if (rule.words.some((word) => text.includes(word))) return rule.category
  }
  return item.language === 'TypeScript' || item.language === 'JavaScript' ? '设计前端' : '开发工具'
}

function isoDay(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function mergeHistory(project, latestStars) {
  const history = Array.isArray(project.history) ? project.history.slice(-60) : []
  const today = isoDay()
  if (history.length && history.at(-1).date === today) {
    history[history.length - 1] = { date: today, stars: latestStars }
  } else {
    history.push({ date: today, stars: latestStars })
  }
  const clean = []
  for (const point of history) {
    if (!clean.length || point.stars >= clean.at(-1).stars) clean.push(point)
  }
  return clean
}

function computeMetrics(project) {
  const history = project.history || []
  const latest = history.at(-1)?.stars || project.stars
  const previous = history.at(-2)?.stars || latest
  const weekBase = history[Math.max(0, history.length - 8)]?.stars || latest
  const weekly = Math.max(0, latest - weekBase)
  return {
    dailyGrowth: Math.max(0, latest - previous),
    weeklyGrowth: weekly,
    weeklyGrowthPct: Number(((weekly / Math.max(1, latest - weekly)) * 100).toFixed(1))
  }
}

function sourceFromApi(item, category, readme = '') {
  const fullName = item.full_name
  const [owner, name] = fullName.split('/')
  const topics = item.topics || []
  const stars = item.stargazers_count || 0
  const description = item.description || '社区近期关注度快速上升的开源项目。'
  const summary = `GitHub 近期新晋热门项目，聚焦 ${topics.slice(0, 3).join('、') || category}，当前已获得 ${stars.toLocaleString('en-US')} Stars。`
  const highlights = [
    `创建于 ${new Date(item.created_at).toISOString().slice(0, 10)}，仍处于快速迭代阶段`,
    topics.length ? `主题覆盖 ${topics.slice(0, 4).join(' / ')}` : `主要使用 ${item.language || '多种语言'} 构建`,
    `最近更新 ${new Date(item.pushed_at).toISOString().slice(0, 10)}，社区讨论持续活跃`
  ]

  return {
    id: `${owner}--${name}`.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    name,
    owner,
    fullName,
    description,
    descriptionEn: description,
    summary,
    highlights,
    category,
    language: item.language || 'Unknown',
    languageColor: '#8b949e',
    stars,
    weeklyGrowth: 0,
    weeklyGrowthPct: 0,
    dailyGrowth: 0,
    forks: item.forks_count || 0,
    issues: item.open_issues_count || 0,
    contributors: 0,
    license: item.license?.spdx_id || 'NOASSERTION',
    version: '最新快照',
    trendingScore: Math.min(96, Math.round(48 + Math.log10(Math.max(10, stars)) * 9)),
    topics,
    aliases: topics.join(' '),
    tags: topics.slice(0, 3).map((topic) => topic.toUpperCase()),
    tracked: false,
    status: null,
    origin: 'github',
    homepage: item.html_url,
    createdAt: item.created_at,
    pushedAt: item.pushed_at,
    releaseAt: item.pushed_at,
    syncedAt: new Date().toISOString(),
    readme,
    history: [{ date: isoDay(), stars }]
  }
}

async function githubFetch(path, { raw = false } = {}) {
  const response = await fetch(path.startsWith('http') ? path : `${API_ROOT}${path}`, {
    headers: {
      Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
      'User-Agent': 'git-trend-monitor',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {})
    },
    signal: AbortSignal.timeout(15_000)
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`GitHub API ${response.status}: ${text.slice(0, 160)}`)
  }
  return raw ? response.text() : response.json()
}

async function enrichReadme(project) {
  try {
    const readme = await githubFetch(`/repos/${project.fullName}/readme`, { raw: true })
    return String(readme).slice(0, 10_000)
  } catch {
    return ''
  }
}

function compare(value, operator, threshold) {
  if (operator === '>') return value > threshold
  if (operator === '>=') return value >= threshold
  if (operator === '<') return value < threshold
  if (operator === '=') return value === threshold
  return false
}

function deliverWebhook(rule, event, project) {
  const url = process.env.ALERT_WEBHOOK_URL
  if (!url || !rule.channels?.includes('webhook')) return
  const payload = {
    source: 'git-trend-monitor',
    rule: { id: rule.id, name: rule.name, metric: rule.metric },
    event: {
      id: event.id,
      title: event.title,
      message: event.message,
      severity: event.severity,
      createdAt: event.createdAt
    },
    project: project
      ? {
          fullName: project.fullName,
          category: project.category,
          stars: project.stars,
          weeklyGrowthPct: project.weeklyGrowthPct,
          url: project.homepage
        }
      : null
  }

  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'git-trend-monitor/1.0'
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(6_000)
  })
    .then(async (response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      addActivity({
        type: 'alert',
        title: 'Webhook 已送达',
        detail: `${rule.name} → ${event.title}`,
        projectId: project?.id
      })
      await saveState()
    })
    .catch(async (error) => {
      addActivity({
        type: 'alert',
        title: 'Webhook 送达失败',
        detail: `${rule.name}: ${String(error.message || error).slice(0, 120)}`,
        projectId: project?.id
      })
      await saveState()
    })
}

function evaluateRules() {
  const db = getState()
  const eventsCreated = []
  for (const rule of db.alerts.rules) {
    if (!rule.enabled) continue
    if (rule.metric === 'topicGrowth') {
      const scoped =
        rule.scope === '全部'
          ? db.projects
          : db.projects.filter((project) => project.category === rule.scope)
      if (!scoped.length) continue
      const avg = scoped.reduce((sum, project) => sum + project.weeklyGrowthPct, 0) / scoped.length
      if (!compare(Number(avg.toFixed(1)), rule.operator, rule.threshold)) continue
      const recent = db.alerts.events.find(
        (event) =>
          event.ruleId === rule.id &&
          Date.now() - new Date(event.createdAt).getTime() < 12 * 3_600_000
      )
      if (recent) continue
      const scopeName = rule.scope === '全部' ? '全站项目' : `${rule.scope}分类`
      const event = addAlertEvent({
        ruleId: rule.id,
        projectId: null,
        severity: 'medium',
        title: `${scopeName}话题热度达到 ${avg.toFixed(1)}%`,
        message: `${scoped.length} 个项目的周均增速越过规则阈值 ${rule.threshold}%，话题正在形成持续动量。`
      })
      rule.triggers = (rule.triggers || 0) + 1
      rule.lastTriggeredAt = event.createdAt
      eventsCreated.push({ rule, event, project: null })
      continue
    }

    const candidates = db.projects.filter((project) => {
      if (rule.scope === '全部') return project.tracked
      if (rule.scope === '重点关注') return project.tracked && project.status === '重点关注'
      return project.category === rule.scope
    })
    let ruleHits = 0
    for (const project of candidates) {
      if (ruleHits >= 2) break
      let value = 0
      let title = ''
      let message = ''
      if (rule.metric === 'dailyStars') {
        value = project.dailyGrowth || 0
        title = `${project.name} 单日新增 ${Number(value).toLocaleString('en-US')} Stars`
        message = `规则「${rule.name}」命中：当前总 Star 数 ${project.stars.toLocaleString('en-US')}，阈值 ${rule.threshold}。`
      } else if (rule.metric === 'weeklyGrowthPct') {
        value = project.weeklyGrowthPct
        title = `${project.name} 周增速达到 ${Number(value).toFixed(1)}%`
        message = `7 日新增 ${project.weeklyGrowth.toLocaleString('en-US')} Stars，高于规则阈值 ${rule.threshold}%，建议查看增长来源。`
      } else if (rule.metric === 'stars') {
        value = project.stars
        title = `${project.name} 突破 ${Math.round(value / 1000)}k Stars`
        message = `项目总 Stars 已达到 ${value.toLocaleString('en-US')}，触发里程碑规则。`
      } else if (rule.metric === 'release') {
        value = new Date(project.pushedAt).getTime()
        const windowDays = rule.window === '7d' ? 7 : rule.window === '30d' ? 30 : 1
        const recentPush = Date.now() - value < windowDays * 86_400_000
        if (!recentPush) continue
        title = `${project.name} 在 ${rule.window} 内有新的代码更新`
        message = '项目活跃度发生变化，可以查看最新提交与版本说明。'
      } else {
        continue
      }
      if (rule.metric !== 'release' && !compare(value, rule.operator, rule.threshold)) continue
      const recent = db.alerts.events.find(
        (event) =>
          event.ruleId === rule.id &&
          event.projectId === project.id &&
          (rule.metric === 'stars'
            ? true
            : Date.now() - new Date(event.createdAt).getTime() < 12 * 3_600_000)
      )
      if (recent) continue
      const event = addAlertEvent({
        ruleId: rule.id,
        projectId: project.id,
        severity: rule.metric === 'stars' ? 'medium' : 'high',
        title,
        message
      })
      rule.triggers = (rule.triggers || 0) + 1
      rule.lastTriggeredAt = event.createdAt
      eventsCreated.push({ rule, event, project })
      ruleHits += 1
    }
  }
  for (const item of eventsCreated) deliverWebhook(item.rule, item.event, item.project)
  return eventsCreated.length
}

function nextSyncTime(intervalMinutes) {
  return new Date(Date.now() + intervalMinutes * 60_000).toISOString()
}

export async function syncGithub({ trigger = 'manual' } = {}) {
  if (running) {
    return { ok: false, busy: true, message: '同步任务正在运行中，请稍后再试。' }
  }
  const db = getState()
  running = true
  db.meta.syncRunning = true
  const started = Date.now()
  await saveState()

  try {
    const createdAfter = new Date(Date.now() - 45 * 86_400_000).toISOString().slice(0, 10)
    const query = encodeURIComponent(`created:>=${createdAfter} stars:>500`)
    const payload = await githubFetch(
      `/search/repositories?q=${query}&sort=stars&order=desc&per_page=12`
    )
    const items = (payload.items || []).filter(
      (item) =>
        item.full_name &&
        !item.archived &&
        !item.fork &&
        typeof item.description === 'string' &&
        item.description.length > 12
    )
    if (!items.length) throw new Error('GitHub 搜索未返回项目')

    let added = 0
    let updated = 0
    const newProjects = []

    for (const item of items) {
      const existing = db.projects.find((project) => project.fullName.toLowerCase() === item.full_name.toLowerCase())
      if (existing) {
        existing.stars = item.stargazers_count
        existing.forks = item.forks_count
        existing.issues = item.open_issues_count
        existing.pushedAt = item.pushed_at
        existing.topics = item.topics?.length ? item.topics : existing.topics
        existing.descriptionEn = item.description || existing.descriptionEn
        existing.syncedAt = new Date().toISOString()
        existing.origin = 'github'
        existing.history = mergeHistory(existing, item.stargazers_count)
        Object.assign(existing, computeMetrics(existing))
        updated += 1
      } else if (added < 6) {
        const project = sourceFromApi(item, classifyCategory(item))
        db.projects.push(project)
        newProjects.push(project)
        added += 1
      }
    }

    for (const project of newProjects.slice(0, 3)) {
      project.readme = await enrichReadme(project)
    }

    const triggered = evaluateRules()

    db.projects.sort((a, b) => b.stars - a.stars)
    db.meta.lastSyncAt = new Date().toISOString()
    db.meta.lastSyncStatus = 'success'
    db.meta.dataMode = 'live'
    db.meta.nextSyncAt = nextSyncTime(db.meta.intervalMinutes)
    running = false
    db.meta.syncRunning = false

    const log = addSyncLog({
      at: new Date().toISOString(),
      status: 'success',
      source: TOKEN ? 'github-token' : 'github-public',
      message: `扫描 ${items.length} 个项目，触发 ${triggered} 条预警信号`,
      added,
      updated,
      duration: Date.now() - started
    })
    addActivity({
      type: 'sync',
      title: 'GitHub 趋势同步完成',
      detail: `更新 ${updated} 个项目，新增 ${added} 个项目，用时 ${((Date.now() - started) / 1000).toFixed(1)} 秒`,
      createdAt: new Date().toISOString()
    })
    rebuildIndex()
    await saveState()
    return {
      ok: true,
      added,
      updated,
      scanned: items.length,
      triggered,
      duration: Date.now() - started,
      log
    }
  } catch (error) {
    const db2 = getState()
    running = false
    db2.meta.syncRunning = false
    db2.meta.lastSyncStatus = 'error'
    db2.meta.lastSyncAt = new Date().toISOString()
    db2.meta.nextSyncAt = nextSyncTime(db2.meta.intervalMinutes)
    const log = addSyncLog({
      at: new Date().toISOString(),
      status: 'error',
      source: TOKEN ? 'github-token' : 'github-public',
      message: error.name === 'TimeoutError' ? 'GitHub API 连接超时' : error.message.slice(0, 220),
      added: 0,
      updated: 0,
      duration: Date.now() - started
    })
    await saveState()
    return {
      ok: false,
      error: error.name === 'TimeoutError' ? '连接 GitHub 超时，请检查网络后重试。' : error.message,
      log
    }
  } finally {
    running = false
  }
}

async function schedulerTick() {
  const db = getState()
  if (!db.meta.autoSync || running) return
  const interval = Math.max(5, Number(db.meta.intervalMinutes) || 30) * 60_000
  const last = new Date(db.meta.lastSyncAt || db.meta.createdAt).getTime()
  if (Date.now() - last < interval) return
  console.log('[scheduler] 开始自动同步 GitHub 趋势…')
  const result = await syncGithub({ trigger: 'auto' })
  console.log(
    `[scheduler] 同步${result.ok ? '完成' : '失败'}：${result.ok ? `新增 ${result.added} / 更新 ${result.updated}` : result.error}`
  )
}

export function startScheduler() {
  if (schedulerTimer) return
  setTimeout(schedulerTick, 120_000).unref?.()
  schedulerTimer = setInterval(schedulerTick, 60_000)
  schedulerTimer.unref?.()
}

export function stopScheduler() {
  if (schedulerTimer) clearInterval(schedulerTimer)
  schedulerTimer = null
}

export function getGithubStatus() {
  const db = getState()
  const interval = Math.max(5, Number(db.meta.intervalMinutes) || 30)
  return {
    connected: db.meta.dataMode === 'live',
    mode: db.meta.dataMode,
    authenticated: Boolean(TOKEN),
    tokenConfigured: Boolean(TOKEN),
    lastSyncAt: db.meta.lastSyncAt,
    nextSyncAt: db.meta.nextSyncAt || nextSyncTime(interval),
    autoSync: db.meta.autoSync,
    intervalMinutes: interval,
    running: Boolean(db.meta.syncRunning || running),
    lastStatus: db.meta.lastSyncStatus,
    api: 'GitHub REST API v3',
    rateLimit: TOKEN ? '5,000 requests / hour' : '60 requests / hour'
  }
}

export function makeSyncId() {
  return crypto.randomUUID()
}
