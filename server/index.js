import 'dotenv/config'
import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { CATEGORY_META } from './seed.js'
import {
  addActivity,
  addAlertEvent,
  addSyncLog,
  getState,
  initStore,
  saveState
} from './store.js'
import { getGithubStatus, startScheduler, syncGithub } from './ingest.js'
import { getIndexStats, rebuildIndex } from './rag.js'
import { answerQuestion, getAiConfig } from './assistant.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DIST = path.join(ROOT, 'dist')
const PORT = Number(process.env.PORT) || 8787
const HOST = process.env.HOST || '127.0.0.1'

initStore()
rebuildIndex()
startScheduler()

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '1mb' }))

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function formatCompact(value) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 10_000) return `${(value / 10_000).toFixed(1)} 万`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return String(Math.round(value))
}

function historyMap(project) {
  return new Map((project.history || []).map((point) => [point.date, point.stars]))
}

function localDateKey(date) {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function buildTrendPoints(days) {
  const db = getState()
  const points = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date(now.getTime() - i * 86_400_000)
    const key = localDateKey(day)
    const point = {
      date: key,
      label: `${day.getMonth() + 1}/${day.getDate()}`,
      total: 0
    }
    for (const category of Object.keys(CATEGORY_META)) point[category] = 0

    for (const project of db.projects) {
      const map = historyMap(project)
      if (!map.has(key)) continue
      const keys = [...map.keys()].filter((k) => k <= key).sort()
      if (keys.length < 2) continue
      const latest = map.get(keys.at(-1))
      const previous = map.get(keys.at(-2))
      const growth = Math.max(0, latest - previous)
      if (growth > 0) {
        point[project.category] = (point[project.category] || 0) + growth
        point.total += growth
      }
    }
    points.push(point)
  }
  return points
}

function getCategoryStats() {
  const db = getState()
  const totalWeekly = db.projects.reduce((sum, p) => sum + p.weeklyGrowth, 0)
  return Object.entries(CATEGORY_META).map(([name, meta]) => {
    const items = db.projects.filter((p) => p.category === name)
    const weekly = items.reduce((sum, p) => sum + p.weeklyGrowth, 0)
    const pct = items.length ? items.reduce((sum, p) => sum + p.weeklyGrowthPct, 0) / items.length : 0
    return {
      name,
      color: meta.color,
      soft: meta.soft,
      count: items.length,
      weeklyGrowth: weekly,
      weeklyGrowthPct: Number(pct.toFixed(1)),
      share: totalWeekly ? Math.round((weekly / totalWeekly) * 100) : 0,
      stars: items.reduce((sum, p) => sum + p.stars, 0)
    }
  })
}

function buildTopics() {
  const db = getState()
  const groups = [
    { name: 'Agent', test: /agent|智能体|multi-agent/i, desc: '智能体与任务编排' },
    { name: 'RAG', test: /rag|retrieval|knowledge-base|知识库/i, desc: '检索增强生成' },
    { name: '自托管', test: /self-hosted|本地|离线|offline|privacy|隐私|私有化/i, desc: '数据留在自己手里' },
    { name: '工作流', test: /workflow|automation|工作流|自动化/i, desc: '把步骤连接起来' },
    { name: 'MCP', test: /mcp|model context protocol/i, desc: '模型连接外部工具' },
    { name: '开发者体验', test: /editor|cli|tooling|runtime|developer|编辑器|包管理/i, desc: '更顺手的研发工具' },
    { name: '向量检索', test: /vector|search|retrieval|embedding/i, desc: '语义搜索与索引' },
    { name: '生成式媒体', test: /image|diffusion|multimodal|图像|aigc/i, desc: '图像与多模态生成' }
  ]

  return groups
    .map((group) => {
      const projects = db.projects.filter((project) =>
        group.test.test(`${project.topics.join(' ')} ${project.tags.join(' ')} ${project.aliases} ${project.description}`)
      )
      const weekly = projects.reduce((sum, p) => sum + p.weeklyGrowth, 0)
      return {
        name: group.name,
        description: group.desc,
        projectCount: projects.length,
        weeklyGrowth: weekly,
        avgGrowthPct: projects.length
          ? Number((projects.reduce((sum, p) => sum + p.weeklyGrowthPct, 0) / projects.length).toFixed(1))
          : 0,
        projectIds: projects.slice(0, 4).map((p) => p.id)
      }
    })
    .filter((item) => item.projectCount > 0)
    .sort((a, b) => b.weeklyGrowth - a.weeklyGrowth)
    .slice(0, 6)
}

function buildBriefing(stats, categories) {
  const db = getState()
  const leader = categories.slice().sort((a, b) => b.weeklyGrowth - a.weeklyGrowth)[0]
  const fastest = db.projects
    .slice()
    .sort((a, b) => b.weeklyGrowthPct - a.weeklyGrowthPct)[0]
  const selfHosted = db.projects.filter((p) =>
    /self-hosted|本地|离线|offline|privacy|隐私|私有化|自托管/i.test(
      `${p.topics.join(' ')} ${p.tags.join(' ')} ${p.aliases}`
    )
  )
  const selfHostedGrowth = selfHosted.reduce((sum, p) => sum + p.weeklyGrowth, 0)
  const selfHostedShare = stats.weeklyGrowth
    ? Math.round((selfHostedGrowth / stats.weeklyGrowth) * 100)
    : 0
  const tracked = db.projects.filter((p) => p.tracked)

  return {
    headline: `${leader.name}正在吸收本周 ${leader.share}% 的新增关注`,
    intro: `过去 7 天，${db.projects.length} 个跟踪项目合计新增 ${formatCompact(stats.weeklyGrowth)} Stars。${fastest.name} 的增速最高，${selfHosted.length} 个自托管项目贡献了约 ${selfHostedShare}% 的增量。`,
    signals: [
      {
        label: '增长集中度',
        title: `${leader.name} · ${leader.share}% 周增量`,
        body: `${leader.count} 个项目合计新增 ${formatCompact(leader.weeklyGrowth)} Stars，平均周增速 ${leader.weeklyGrowthPct}%。`,
        projectId: null
      },
      {
        label: '最快动量',
        title: `${fastest.fullName} · +${fastest.weeklyGrowthPct}%`,
        body: `近 7 日新增 ${fastest.weeklyGrowth.toLocaleString('en-US')} Stars，当前趋势分 ${fastest.trendingScore}/100。`,
        projectId: fastest.id
      },
      {
        label: '结构性信号',
        title: `自托管标签覆盖 ${selfHosted.length} 个项目`,
        body: `这些项目本周合计新增 ${formatCompact(selfHostedGrowth)} Stars，占比 ${selfHostedShare}%，“数据自主”仍是重要购买理由。`,
        projectId: null
      }
    ],
    footnote: `基于 ${db.projects.length} 个项目、${getIndexStats().documents} 个知识片段生成 · ${tracked.length} 个项目处于跟踪状态`,
    generatedAt: new Date().toISOString()
  }
}

function listProject(project) {
  const { readme, descriptionEn, ...rest } = project
  return {
    ...rest,
    sparkline: (project.history || []).slice(-14).map((point) => point.stars)
  }
}

function detailProject(project) {
  return {
    ...project,
    sparkline: (project.history || []).slice(-14).map((point) => point.stars)
  }
}

function buildOverview() {
  const db = getState()
  const categories = getCategoryStats()
  const trendPoints = buildTrendPoints(30)
  const trend7 = trendPoints.slice(-7)
  const totalWeekly = db.projects.reduce((sum, p) => sum + p.weeklyGrowth, 0)
  const totalStars = db.projects.reduce((sum, p) => sum + p.stars, 0)
  const weeklyPct = Number(((totalWeekly / Math.max(1, totalStars - totalWeekly)) * 100).toFixed(1))
  // Only count projects with at least two snapshots. A newly discovered project's
  // first snapshot is its baseline, not a day of growth.
  const newToday = db.projects.reduce((sum, project) => {
    const history = project.history || []
    if (history.length < 2) return sum
    return sum + Math.max(0, (history.at(-1)?.stars || 0) - (history.at(-2)?.stars || 0))
  }, 0)
  const unread = db.alerts.events.filter((event) => !event.read).length
  const tracked = db.projects.filter((project) => project.tracked)

  const stats = {
    totalProjects: db.projects.length,
    totalStars,
    weeklyGrowth: totalWeekly,
    weeklyGrowthPct: weeklyPct,
    newToday,
    trackedCount: tracked.length,
    activeRules: db.alerts.rules.filter((rule) => rule.enabled).length,
    unreadAlerts: unread,
    averageScore: Math.round(
      db.projects.reduce((sum, p) => sum + p.trendingScore, 0) / Math.max(1, db.projects.length)
    )
  }

  const topMovers = db.projects
    .slice()
    .sort((a, b) => b.weeklyGrowthPct * 6 + b.trendingScore * 0.4 - (a.weeklyGrowthPct * 6 + a.trendingScore * 0.4))
    .slice(0, 5)
    .map((project, index) => ({
      rank: index + 1,
      id: project.id,
      owner: project.owner,
      name: project.name,
      fullName: project.fullName,
      description: project.description,
      category: project.category,
      language: project.language,
      languageColor: project.languageColor,
      stars: project.stars,
      weeklyGrowth: project.weeklyGrowth,
      weeklyGrowthPct: project.weeklyGrowthPct,
      dailyGrowth: project.dailyGrowth,
      trendingScore: project.trendingScore,
      tracked: project.tracked,
      sparkline: (project.history || []).slice(-12).map((point) => point.stars)
    }))

  const opportunities = db.projects
    .slice()
    .sort((a, b) => b.trendingScore - a.trendingScore)
    .slice(0, 20)
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
      color: CATEGORY_META[project.category]?.color || '#c8ff5c'
    }))

  const signals = db.alerts.events.slice(0, 5).map((event) => {
    const project = db.projects.find((p) => p.id === event.projectId)
    return {
      ...event,
      projectName: project?.fullName || null,
      projectCategory: project?.category || null,
      projectTracked: project?.tracked || false
    }
  })

  return {
    stats,
    trend: {
      sevenDays: trend7,
      thirtyDays: trendPoints,
      categories
    },
    topMovers,
    topics: buildTopics(),
    categories,
    briefing: buildBriefing(stats, categories),
    opportunities,
    signals,
    activity: db.activity.slice(0, 6),
    meta: {
      ...db.meta,
      github: getGithubStatus(),
      ai: getAiConfig(),
      rag: getIndexStats()
    }
  }
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'git-trend-monitor', time: new Date().toISOString() })
})

app.get('/api/overview', (req, res) => {
  res.json(buildOverview())
})

app.get('/api/projects', (req, res) => {
  const db = getState()
  const { query = '', category = 'all', language = 'all', tracked = 'all', sort = 'trending' } = req.query
  const q = String(query).trim().toLowerCase()

  let items = db.projects.filter((project) => {
    if (category !== 'all' && project.category !== category) return false
    if (language !== 'all' && project.language !== language) return false
    if (tracked === 'true' && !project.tracked) return false
    if (tracked === 'false' && project.tracked) return false
    if (!q) return true
    const haystack = `${project.fullName} ${project.name} ${project.owner} ${project.description} ${project.summary} ${project.topics.join(' ')} ${project.tags.join(' ')} ${project.aliases}`.toLowerCase()
    return q.split(/\s+/).every((token) => haystack.includes(token))
  })

  const sorters = {
    trending: (a, b) => b.trendingScore - a.trendingScore,
    growth: (a, b) => b.weeklyGrowth - a.weeklyGrowth,
    momentum: (a, b) => b.weeklyGrowthPct - a.weeklyGrowthPct,
    stars: (a, b) => b.stars - a.stars,
    newest: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    name: (a, b) => a.fullName.localeCompare(b.fullName)
  }
  items = items.slice().sort(sorters[sort] || sorters.trending)

  const trackedProjects = db.projects.filter((project) => project.tracked)
  const facets = {
    categories: Object.keys(CATEGORY_META).map((name) => ({
      name,
      count: db.projects.filter((p) => p.category === name).length,
      color: CATEGORY_META[name].color
    })),
    languages: [...new Set(db.projects.map((p) => p.language))]
      .sort()
      .map((name) => ({ name, count: db.projects.filter((p) => p.language === name).length })),
    statuses: ['重点关注', '观察中', '评估中', null].map((name) => ({
      name,
      count: db.projects.filter((p) => (name ? p.status === name : !p.tracked)).length
    }))
  }

  res.json({
    items: items.map(listProject),
    total: items.length,
    allTotal: db.projects.length,
    trackedTotal: trackedProjects.length,
    trackedWeeklyGrowth: trackedProjects.reduce((sum, project) => sum + project.weeklyGrowth, 0),
    trackedWeeklyStars: trackedProjects.reduce((sum, project) => sum + project.stars, 0),
    facets
  })
})

app.get('/api/projects/:id', (req, res) => {
  const db = getState()
  const project = db.projects.find((p) => p.id === req.params.id)
  if (!project) return res.status(404).json({ error: '项目不存在' })
  const related = db.projects
    .filter((p) => p.category === project.category && p.id !== project.id)
    .sort((a, b) => b.trendingScore - a.trendingScore)
    .slice(0, 3)
    .map(listProject)
  res.json({ project: detailProject(project), related })
})

app.patch('/api/projects/:id', async (req, res) => {
  const db = getState()
  const project = db.projects.find((p) => p.id === req.params.id)
  if (!project) return res.status(404).json({ error: '项目不存在' })
  const { tracked, status, tags, note } = req.body || {}
  const wasTracked = project.tracked
  if (typeof tracked === 'boolean') project.tracked = tracked
  if (typeof status === 'string' && ['重点关注', '观察中', '评估中', null].includes(status)) {
    project.status = status
  }
  if (Array.isArray(tags)) project.tags = tags.slice(0, 8).map(String)
  if (typeof note === 'string') project.note = note.slice(0, 800)
  if (project.tracked && !project.status) project.status = '观察中'
  if (!project.tracked) project.status = null

  if (project.tracked !== wasTracked) {
    addActivity({
      type: project.tracked ? 'track' : 'untrack',
      title: project.tracked ? '新增跟踪项目' : '移出跟踪清单',
      detail: `${project.fullName} · ${project.tracked ? project.status : '已取消跟踪'}`,
      projectId: project.id
    })
  }
  await saveState()
  res.json({ ok: true, project: detailProject(project) })
})

app.post('/api/projects/:id/ask', (req, res) => {
  const db = getState()
  const project = db.projects.find((p) => p.id === req.params.id)
  if (!project) return res.status(404).json({ error: '项目不存在' })
  res.json({
    prompt: `帮我详细分析 ${project.fullName}：它解决什么问题，当前趋势如何，适合什么场景？`
  })
})

app.get('/api/alerts', (req, res) => {
  const db = getState()
  const events = db.alerts.events.map((event) => {
    const project = db.projects.find((p) => p.id === event.projectId)
    return {
      ...event,
      projectName: project?.fullName || null,
      category: project?.category || null,
      stars: project?.stars || null
    }
  })
  const activeRules = db.alerts.rules.filter((rule) => rule.enabled)
  res.json({
    rules: db.alerts.rules,
    events,
    stats: {
      activeRules: activeRules.length,
      totalRules: db.alerts.rules.length,
      unread: events.filter((event) => !event.read).length,
      triggeredThisWeek: events.filter(
        (event) => Date.now() - new Date(event.createdAt).getTime() < 7 * 86_400_000
      ).length,
      highPriority: events.filter((event) => event.severity === 'high').length
    }
  })
})

app.post('/api/alerts', async (req, res) => {
  const db = getState()
  const body = req.body || {}
  if (!body.name || String(body.name).trim().length < 2) {
    return res.status(400).json({ error: '请填写规则名称' })
  }
  const threshold = Number(body.threshold)
  if (!Number.isFinite(threshold)) return res.status(400).json({ error: '阈值必须是数字' })
  const scope = ['AI 应用', '智能体', '开发工具', '基础设施', '数据与搜索', '设计前端'].includes(body.scope)
    ? body.scope
    : '全部'
  const rule = {
    id: crypto.randomUUID(),
    name: String(body.name).trim().slice(0, 60),
    description: String(body.description || '').trim().slice(0, 180) || `当${scope}项目达到设定阈值时提醒`,
    enabled: body.enabled !== false,
    metric: ['dailyStars', 'weeklyGrowthPct', 'stars', 'topicGrowth', 'release'].includes(body.metric)
      ? body.metric
      : 'dailyStars',
    operator: ['>', '<', '=', '>='].includes(body.operator) ? body.operator : '>',
    threshold,
    window: ['24h', '7d', '30d', '即时'].includes(body.window) ? body.window : '24h',
    scope,
    scopeLabel: `${scope === '全部' ? '全部跟踪项目' : `${scope} · 全部项目`}`,
    channels: Array.isArray(body.channels) && body.channels.length ? body.channels.slice(0, 3) : ['inapp'],
    triggers: 0,
    lastTriggeredAt: null,
    createdAt: new Date().toISOString()
  }
  db.alerts.rules.unshift(rule)
  addAlertEvent({
    ruleId: rule.id,
    projectId: null,
    severity: 'low',
    title: `规则「${rule.name}」已启用`,
    message: `开始监视${rule.scopeLabel}，阈值为 ${rule.threshold}。这是一条规则启用通知。`
  })
  addActivity({
    type: 'alert',
    title: '新建智能预警',
    detail: `${rule.name} · ${rule.scopeLabel}`,
    createdAt: new Date().toISOString()
  })
  await saveState()
  res.status(201).json({ ok: true, rule })
})

app.patch('/api/alerts/:id', async (req, res) => {
  const db = getState()
  const rule = db.alerts.rules.find((item) => item.id === req.params.id)
  if (!rule) return res.status(404).json({ error: '预警规则不存在' })
  if (typeof req.body?.enabled === 'boolean') rule.enabled = req.body.enabled
  if (typeof req.body?.name === 'string' && req.body.name.trim()) rule.name = req.body.name.trim().slice(0, 60)
  if (typeof req.body?.description === 'string') rule.description = req.body.description.slice(0, 180)
  if (Number.isFinite(Number(req.body?.threshold))) rule.threshold = Number(req.body.threshold)
  await saveState()
  res.json({ ok: true, rule })
})

app.delete('/api/alerts/:id', async (req, res) => {
  const db = getState()
  const index = db.alerts.rules.findIndex((item) => item.id === req.params.id)
  if (index === -1) return res.status(404).json({ error: '预警规则不存在' })
  db.alerts.rules.splice(index, 1)
  await saveState()
  res.json({ ok: true })
})

app.post('/api/alerts/events/read', async (req, res) => {
  const db = getState()
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : null
  for (const event of db.alerts.events) {
    if (!ids || ids.includes(event.id)) event.read = true
  }
  await saveState()
  res.json({ ok: true })
})

app.get('/api/activity', (req, res) => {
  const db = getState()
  res.json({ items: db.activity })
})

app.get('/api/sources', (req, res) => {
  const db = getState()
  res.json({
    github: getGithubStatus(),
    ai: getAiConfig(),
    rag: getIndexStats(),
    syncLogs: db.syncLogs,
    meta: {
      lastSyncAt: db.meta.lastSyncAt,
      dataMode: db.meta.dataMode,
      createdAt: db.meta.createdAt
    }
  })
})

app.post('/api/sync', async (req, res) => {
  const result = await syncGithub({ trigger: 'manual' })
  if (!result.ok && !result.busy) return res.status(502).json(result)
  res.json(result)
})

app.patch('/api/settings', async (req, res) => {
  const db = getState()
  const { autoSync, intervalMinutes } = req.body || {}
  if (typeof autoSync === 'boolean') db.meta.autoSync = autoSync
  if (Number.isFinite(Number(intervalMinutes))) {
    db.meta.intervalMinutes = clamp(Math.round(Number(intervalMinutes)), 5, 1440)
  }
  db.meta.nextSyncAt = new Date(Date.now() + db.meta.intervalMinutes * 60_000).toISOString()
  await saveState()
  res.json({ ok: true, meta: db.meta, github: getGithubStatus() })
})

app.post('/api/rag/reindex', async (req, res) => {
  const stats = rebuildIndex()
  res.json({ ok: true, stats })
})

app.get('/api/search', (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase()
  if (!q) return res.json({ items: [] })
  const db = getState()
  const items = db.projects
    .filter((project) =>
      `${project.fullName} ${project.description} ${project.topics.join(' ')} ${project.tags.join(' ')}`
        .toLowerCase()
        .includes(q)
    )
    .slice(0, 6)
    .map((project) => ({
      id: project.id,
      fullName: project.fullName,
      category: project.category,
      stars: project.stars,
      languageColor: project.languageColor
    }))
  res.json({ items })
})

function sseSend(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

app.post(
  '/api/chat',
  asyncRoute(async (req, res) => {
    const message = String(req.body?.message || '').trim()
    if (!message) return res.status(400).json({ error: '请输入问题' })
    if (message.length > 2000) return res.status(400).json({ error: '问题过长，请控制在 2000 字以内' })
    const history = Array.isArray(req.body?.history) ? req.body.history.slice(-8) : []

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders?.()

    try {
      sseSend(res, 'retrieving', { message: '正在检索项目知识库…' })
      const answer = await answerQuestion({ query: message, history })
      sseSend(res, 'meta', {
        mode: answer.mode,
        provider: answer.provider,
        model: answer.model,
        sources: answer.sources,
        retrieval: getIndexStats()
      })

      const chunks = answer.text.match(/[\s\S]{1,14}/g) || [answer.text]
      for (const chunk of chunks) {
        if (res.writableEnded) return
        sseSend(res, 'delta', { text: chunk })
        await new Promise((resolve) => setTimeout(resolve, 12))
      }
      sseSend(res, 'done', {
        conversationId: crypto.randomUUID(),
        sources: answer.sources,
        mode: answer.mode
      })
      res.end()
    } catch (error) {
      console.error('[chat]', error)
      sseSend(res, 'error', { message: '生成回答时遇到问题，请稍后重试。' })
      res.end()
    }
  })
)

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API 不存在' })
})

if (fs.existsSync(DIST)) {
  app.use(express.static(DIST, { maxAge: '1h', index: false }))
  app.get('*', (req, res) => {
    res.sendFile(path.join(DIST, 'index.html'))
  })
}

app.use((error, req, res, next) => {
  console.error('[api]', error)
  if (res.headersSent) return next(error)
  res.status(500).json({ error: '服务暂时不可用，请稍后重试。' })
})

const server = app.listen(PORT, HOST, () => {
  console.log(`\n  Git Trend Monitor API`)
  console.log(`  → http://${HOST}:${PORT}`)
  console.log(`  → AI: ${getAiConfig().mode === 'remote' ? `${getAiConfig().provider} / ${getAiConfig().model}` : '本地 RAG（未配置远程模型）'}`)
  console.log(`  → GitHub: ${getGithubStatus().tokenConfigured ? 'Token 已配置' : '公共 API（演示基线）'}\n`)
})

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`端口 ${PORT} 已被占用，请设置 PORT 环境变量后重试。`)
    process.exit(1)
  }
  throw error
})

function shutdown() {
  server.close(() => process.exit(0))
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
