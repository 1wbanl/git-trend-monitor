import { getState } from './store.js'

const STOP_EN = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'for', 'with', 'on', 'at', 'by',
  'is', 'are', 'be', 'this', 'that', 'it', 'as', 'from', 'your', 'you', 'we', 'our',
  'what', 'which', 'how', 'why', 'can', 'could', 'should', 'would', 'do', 'does'
])

const STOP_ZH = new Set([
  '的', '了', '是', '在', '和', '与', '有', '我', '你', '他', '她', '它', '这', '那',
  '一个', '一下', '一些', '什么', '哪些', '如何', '怎么', '可以', '能否', '帮我', '请',
  '推荐', '适合', '项目', '工具', '开源', '比较', '还是', '或者', '以及', '现在', '最近'
])

const SYNONYMS = {
  '本地': ['local', 'offline', 'self-hosted', '自托管', '离线', '本地部署', '私有化'],
  '离线': ['local', 'offline', 'privacy', '离线', '本地部署'],
  '隐私': ['privacy', 'private', 'local', '自托管', '离线'],
  '私有化': ['self-hosted', 'local', 'privacy', '自托管'],
  '智能体': ['agent', 'agents', 'agentic', '多智能体', '自动化'],
  '代理': ['agent', 'agents', 'agentic'],
  '知识库': ['rag', 'knowledge-base', 'retrieval', '知识库', '检索'],
  '检索': ['rag', 'retrieval', 'search', '搜索'],
  '大模型': ['llm', 'model', '模型', '推理'],
  '模型': ['llm', 'model', 'inference', '推理'],
  '编程': ['coding', 'code', 'developer', '代码', '编辑器'],
  '前端': ['frontend', 'react', 'ui', 'css', '组件'],
  '组件': ['components', 'ui', 'design-system', '设计系统'],
  '爬虫': ['crawler', 'scraping', 'crawl', '抓取', '采集'],
  '搜索': ['search', 'retrieval', 'index', '检索'],
  '数据库': ['database', 'postgres', 'vector', '数据'],
  '自动化': ['automation', 'workflow', '工作流'],
  '工作流': ['workflow', 'automation', '编排'],
  '部署': ['deploy', 'serving', 'inference', '本地部署', 'self-hosted'],
  '新手': ['easy', 'simple', '个人', '入门'],
  '个人': ['personal', 'desktop', '本地', '个人开发者'],
  '企业': ['enterprise', 'team', 'rbac', '团队', '权限'],
  '图像': ['image', 'diffusion', '图像生成', 'aigc'],
  '中文': ['chinese', 'multilingual', '中文', 'qwen'],
  '安全': ['security', 'auth', 'privacy', '认证', '隐私']
}

let index = { docs: [], df: new Map(), avgLength: 0, builtAt: null, projectCount: 0 }

function tokenize(text) {
  const normalized = String(text || '')
    .toLowerCase()
    .replace(/[’']/g, '')
  const tokens = []
  const english = normalized.match(/[a-z0-9][a-z0-9.+#_-]*/g) || []
  for (const raw of english) {
    const word = raw.replace(/[._]+$/g, '')
    if (word.length > 1 && !STOP_EN.has(word)) tokens.push(word)
  }
  const chineseRuns = normalized.match(/[\u4e00-\u9fff]+/g) || []
  for (const run of chineseRuns) {
    if (run.length === 1) {
      tokens.push(run)
      continue
    }
    for (let i = 0; i < run.length - 1; i += 1) {
      const bigram = run.slice(i, i + 2)
      if (!STOP_ZH.has(bigram)) tokens.push(bigram)
    }
    if (run.length <= 6 && !STOP_ZH.has(run)) tokens.push(run)
  }
  return tokens
}

function expandQuery(query) {
  const base = tokenize(query)
  const extra = []
  for (const [key, values] of Object.entries(SYNONYMS)) {
    if (query.includes(key)) {
      for (const value of values) {
        extra.push(...tokenize(value))
      }
    }
  }
  return [...base, ...extra, ...extra]
}

function makeDocuments(project) {
  const baseMeta = [
    `项目名称：${project.owner}/${project.name}`,
    `分类：${project.category}`,
    `开发语言：${project.language}`,
    `开源许可：${project.license}`,
    `热度：${project.stars} stars，近 7 日新增 ${project.weeklyGrowth} stars，趋势分 ${project.trendingScore}`,
    `主题：${(project.topics || []).join('、')}`,
    `适用场景：${project.aliases || ''}`,
    `一句话定位：${project.description}`
  ].join('\n')

  const docs = [
    {
      id: `${project.id}::overview`,
      projectId: project.id,
      title: `${project.owner}/${project.name} · 项目概览`,
      section: '项目概览',
      weight: 1.15,
      content: `${baseMeta}\n\n项目摘要：${project.summary}`
    },
    {
      id: `${project.id}::capabilities`,
      projectId: project.id,
      title: `${project.owner}/${project.name} · 能力与适用场景`,
      section: '能力与场景',
      weight: 1,
      content: `${baseMeta}\n\n核心能力：${(project.highlights || []).join('；')}\n\n原文描述：${project.descriptionEn || ''}\n\n适用场景：${project.aliases || ''}`
    }
  ]

  if (project.readme) {
    docs.push({
      id: `${project.id}::readme`,
      projectId: project.id,
      title: `${project.owner}/${project.name} · README 摘要`,
      section: 'README',
      weight: 0.9,
      content: `${baseMeta}\n\nREADME：${String(project.readme).slice(0, 5000)}`
    })
  }
  return docs
}

export function rebuildIndex() {
  const db = getState()
  const docs = []
  for (const project of db.projects) {
    docs.push(...makeDocuments(project))
  }

  const df = new Map()
  let totalLength = 0
  const processed = docs.map((doc) => {
    const weighted = `${doc.title} ${doc.title} ${doc.title} ${doc.content}`
    const tokens = tokenize(weighted)
    const tf = new Map()
    for (const token of tokens) tf.set(token, (tf.get(token) || 0) + 1)
    for (const token of new Set(tokens)) df.set(token, (df.get(token) || 0) + 1)
    totalLength += tokens.length
    return { ...doc, tf, length: tokens.length, searchable: weighted }
  })

  index = {
    docs: processed,
    df,
    avgLength: processed.length ? totalLength / processed.length : 1,
    builtAt: new Date().toISOString(),
    projectCount: db.projects.length
  }
  return getIndexStats()
}

export function getIndexStats() {
  return {
    documents: index.docs.length,
    projects: index.projectCount || getState().projects.length,
    terms: index.df.size,
    builtAt: index.builtAt,
    method: 'BM25 · 中英双语分词',
    avgTokens: Math.round(index.avgLength)
  }
}

function ensureIndex() {
  if (!index.docs.length) rebuildIndex()
}

export function retrieve(query, limit = 5) {
  ensureIndex()
  const db = getState()
  const tokens = expandQuery(query)
  if (!tokens.length) {
    return db.projects
      .slice()
      .sort((a, b) => b.trendingScore - a.trendingScore)
      .slice(0, limit)
      .map((project, i) => buildResult(project, 0.8 - i * 0.03, i + 1, '趋势热度'))
  }

  const qtf = new Map()
  for (const token of tokens) qtf.set(token, (qtf.get(token) || 0) + 1)
  const N = index.docs.length
  const k1 = 1.35
  const b = 0.72
  const scored = []

  for (const doc of index.docs) {
    let score = 0
    for (const [token, qCount] of qtf) {
      const freq = doc.tf.get(token)
      if (!freq) continue
      const df = index.df.get(token) || 0
      const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5))
      const norm = 1 - b + b * (doc.length / index.avgLength)
      score += idf * ((freq * (k1 + 1)) / (freq + k1 * norm)) * (1 + Math.log(qCount))
    }
    if (score > 0) scored.push({ doc, score: score * doc.weight })
  }

  scored.sort((a, b2) => b2.score - a.score)
  const bestByProject = new Map()
  for (const entry of scored) {
    if (!bestByProject.has(entry.doc.projectId)) bestByProject.set(entry.doc.projectId, entry)
  }

  let entries = [...bestByProject.values()]
  let fallback = false
  if (!entries.length) {
    fallback = true
    entries = db.projects
      .slice()
      .sort((a, b2) => b2.trendingScore - a.trendingScore)
      .slice(0, limit)
      .map((project, i) => ({ doc: { projectId: project.id }, score: 0.8 - i * 0.04 }))
  }

  const results = []
  for (const entry of entries.slice(0, limit)) {
    const project = db.projects.find((p) => p.id === entry.doc.projectId)
    if (!project) continue
    results.push(buildResult(project, entry.score, results.length + 1, fallback ? '趋势热度' : '知识库匹配'))
  }
  return results
}

export function projectAsSource(project, order, reason = '趋势热度') {
  return buildResult(project, 0.9, order, reason)
}

function buildResult(project, score, order, reason) {
  return {
    index: order,
    projectId: project.id,
    fullName: project.fullName,
    owner: project.owner,
    name: project.name,
    title: project.fullName,
    category: project.category,
    language: project.language,
    languageColor: project.languageColor,
    stars: project.stars,
    weeklyGrowth: project.weeklyGrowth,
    weeklyGrowthPct: project.weeklyGrowthPct,
    trendingScore: project.trendingScore,
    snippet: project.summary,
    highlights: (project.highlights || []).slice(0, 2),
    url: `https://github.com/${project.fullName}`,
    score: Number(score.toFixed(3)),
    reason
  }
}

export function buildContext(results) {
  return results
    .map(
      (item, i) =>
        `[${i + 1}] ${item.fullName}｜${item.category}｜${item.language}｜${item.stars} stars｜近7日 +${item.weeklyGrowth}\n${item.snippet}\n核心能力：${item.highlights.join('；')}`
    )
    .join('\n\n')
}
