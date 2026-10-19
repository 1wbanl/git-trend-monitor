import { getState } from './store.js'
import { retrieve, projectAsSource, buildContext, getIndexStats } from './rag.js'

const API_KEY =
  process.env.DEEPSEEK_API_KEY || process.env.AI_API_KEY || process.env.OPENAI_API_KEY || ''
const BASE_URL = (
  process.env.DEEPSEEK_BASE_URL ||
  process.env.AI_BASE_URL ||
  process.env.OPENAI_BASE_URL ||
  'https://api.deepseek.com'
).replace(/\/+$/, '')
const MODEL = process.env.DEEPSEEK_MODEL || process.env.AI_MODEL || 'deepseek-chat'
const PROVIDER = process.env.AI_PROVIDER_NAME || (process.env.DEEPSEEK_API_KEY ? 'DeepSeek' : '自定义模型')

const GLOSSARY = {
  rag: {
    title: 'RAG（检索增强生成）',
    definition:
      'RAG 是 Retrieval-Augmented Generation 的缩写。它会先到外部知识库里检索相关片段，再把检索结果作为上下文交给大模型生成答案。相比直接让模型凭记忆回答，RAG 更容易更新知识、提供引用，也能显著降低幻觉。',
    why: '一个可用的 RAG 系统通常包含文档清洗、切片、索引/向量化、混合检索、重排与带引用的生成。难点往往不在模型，而在数据质量和检索效果。'
  },
  mcp: {
    title: 'MCP（模型上下文协议）',
    definition:
      'MCP 是 Model Context Protocol 的缩写，是一套让模型应用以统一方式连接外部工具和数据源的开放协议。可以把它理解为 Agent 世界的 USB-C 接口：客户端只需要实现一次协议，就能接入不断增长的服务器生态。',
    why: '它把「每个模型应用分别接一遍工具」变成「工具按标准暴露一次」。文件系统、数据库、浏览器和内部 API 都能包装成 MCP Server。'
  },
  agent: {
    title: 'AI Agent（智能体）',
    definition:
      'Agent 是能够感知环境、制定步骤并调用工具完成目标的 AI 系统。与单轮问答不同，它通常具备规划、记忆、工具调用和反馈循环，能处理需要多步执行的任务。',
    why: '工程上，Agent 的可靠性取决于工具设计、上下文管理、错误恢复和可观测性，而不只是底层模型。浏览器操作和软件工程是目前落地最快的两个方向。'
  },
  bm25: {
    title: 'BM25',
    definition:
      'BM25 是一种经典的词法相关性排序算法，综合考虑词频、逆文档频率和文档长度。它不依赖向量模型，召回可解释、部署成本低，常用于混合检索的第一阶段。',
    why: '对项目名、技术名词和精确关键词，BM25 往往比纯向量检索更稳。Git Trend Monitor 的本地知识检索就采用了它。'
  }
}

function number(value) {
  return new Intl.NumberFormat('en-US').format(Math.round(value))
}

function shortNumber(value) {
  if (value >= 10000) return `${(value / 10000).toFixed(1)} 万`
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`
  return number(value)
}

function signedPct(value) {
  return `${value >= 0 ? '+' : ''}${Number(value).toFixed(1)}%`
}

function dateLabel() {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  }).format(new Date())
}

function matchCategoryAdvice(category) {
  return (
    {
      'AI 应用': '想直接构建 AI 应用、知识库或工作流',
      '智能体': '想编排 Agent、浏览器任务或跨系统自动化',
      '开发工具': '想改善日常研发工作流与工具链体验',
      '基础设施': '关注推理部署、自托管底座与资源效率',
      '数据与搜索': '需要搭建数据层、检索层或知识基础设施',
      '设计前端': '关注界面组件、设计系统与前端架构'
    }[category] || '想解决对应场景的问题'
  )
}

function findMentionedProjects(query) {
  const db = getState()
  const q = query.toLowerCase()
  const matches = []
  for (const project of db.projects) {
    const candidates = [
      { value: project.fullName.toLowerCase(), exact: true },
      { value: project.name.toLowerCase(), exact: false },
      { value: project.owner.toLowerCase(), exact: false }
    ]
    for (const candidate of candidates) {
      if (!candidate.value || candidate.value.length < 2) continue
      const index = q.indexOf(candidate.value)
      if (index === -1) continue
      const before = q[index - 1] || ''
      const after = q[index + candidate.value.length] || ''
      const boundarySafe =
        candidate.value.length >= 4 || (!/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after))
      if (boundarySafe) {
        matches.push({ project, index: candidate.exact ? index - 0.5 : index })
        break
      }
    }
  }
  return matches.sort((a, b) => a.index - b.index).map((item) => item.project)
}

function sourcesForProject(project, order = 1) {
  return projectAsSource(project, order, '直接匹配')
}

function detailAnswer(project) {
  const otherSimilar = getState().projects
    .filter((p) => p.category === project.category && p.id !== project.id)
    .sort((a, b) => b.weeklyGrowth - a.weeklyGrowth)
    .slice(0, 2)

  const sources = [sourcesForProject(project)]
  otherSimilar.forEach((p, i) => sources.push(projectAsSource(p, i + 2, '同类候选')))

  const text = `**${project.owner}/${project.name}** 位于 **${project.category}** 分类，目前有 **${number(project.stars)}** stars，近 7 日新增 **+${number(project.weeklyGrowth)}**（${signedPct(project.weeklyGrowthPct)}），趋势分 **${project.trendingScore}/100**。[1]

### 一句话理解
${project.summary}

### 值得关注的能力
${project.highlights.map((item, i) => `${i + 1}. ${item}`).join('\n')}

### 适合的场景
${(project.aliases || project.description).split(/\s+/).filter(Boolean).join(' · ')}

### 当前状态
- 开发语言：${project.language}　·　许可：${project.license}
- 最新版本：${project.version}　·　社区贡献者：${number(project.contributors)}
- 当前${project.tracked ? `已加入「${project.status || '观察中'}」` : '还未加入跟踪清单'}，${project.tracked ? '有新的增速或发版信号会进入预警时间线。' : '可在项目库一键跟踪，或为它单独创建一条增速规则。'}

同类项目中，${otherSimilar.map((p, i) => `**${p.name}** [${i + 2}]`).join(' 与 ')} 也值得一起比较。

> 回答基于 Git Trend Monitor 的项目知识卡与最近一次趋势快照，未访问外部网页。`

  return { text, sources }
}

function compareAnswer(projects) {
  const [first, second] = projects
  const sources = projects.slice(0, 2).map((p, i) => projectAsSource(p, i + 1, '对比项目'))
  const text = `下面从定位、能力重心和热度三个角度对比 **${first.name}** 与 **${second.name}**。

### ${first.name} [1]
- 定位：${first.description}
- 能力重心：${first.highlights[0]}
- 热度：${number(first.stars)} stars，近 7 日 +${number(first.weeklyGrowth)}（${signedPct(first.weeklyGrowthPct)}）
- 更适合：${matchCategoryAdvice(first.category)}

### ${second.name} [2]
- 定位：${second.description}
- 能力重心：${second.highlights[0]}
- 热度：${number(second.stars)} stars，近 7 日 +${number(second.weeklyGrowth)}（${signedPct(second.weeklyGrowthPct)}）
- 更适合：${matchCategoryAdvice(second.category)}

### 怎么选
- 两个项目并不完全在同一个赛道：**${first.category}** 与 **${second.category}** 解决的问题不同。
- 如果你更关心「${first.summary.replace(/。$/, '')}」，先深入 ${first.name}。
- 如果你更关心「${second.summary.replace(/。$/, '')}」，先深入 ${second.name}。
- 真正落地前，建议把两者接入同一个最小场景做一次 PoC，而不是只比较 Star 数。

> 对比基于知识库中的项目摘要、标签与能力清单，热度为最近快照数据。`

  return { text, sources }
}

function glossaryAnswer(entry, sources) {
  const examples = sources
    .slice(0, 3)
    .map(
      (source, i) =>
        `- **${source.fullName}** [${i + 1}]：${source.snippet}\n  当前 ${number(source.stars)} stars，近 7 日 +${number(source.weeklyGrowth)}。`
    )
    .join('\n')

  return {
    text: `### ${entry.title}
${entry.definition}

${entry.why}

### 在真实项目里怎么落地
${examples}

如果你告诉我具体场景（本地部署、企业知识库、个人工具或团队协作），我可以继续把候选范围缩小到 2–3 个，并给出对比维度。

> 概念解释为通用知识；项目推荐来自 Git Trend Monitor 知识库检索。`
  }
}

function recommendationAnswer(query, sources) {
  const intro = `围绕「${query.length > 46 ? `${query.slice(0, 46)}…` : query}」，我从 ${getState().projects.length} 个项目知识卡中检索并比对了 ${sources.length} 个相关度最高的项目。`

  const blocks = sources
    .map((source, i) => {
      const project = getState().projects.find((p) => p.id === source.projectId)
      return `### ${i + 1}. ${source.fullName} [${i + 1}]
\`${source.category}\` · ${source.language} · ${number(source.stars)} stars · 近 7 日 ${signedPct(source.weeklyGrowthPct)}

${source.snippet}

- **能力信号**：${source.highlights[0]}
- **热度信号**：7 日新增 ${number(source.weeklyGrowth)} stars，趋势分 ${source.trendingScore}/100。
- **适合**：${matchCategoryAdvice(project.category)}。`
    })
    .join('\n\n')

  const mostMature = sources.slice().sort((a, b) => b.stars - a.stars)[0]
  const fastest = sources.slice().sort((a, b) => b.weeklyGrowthPct - a.weeklyGrowthPct)[0]

  const text = `${intro}

${blocks}

### 我的选择建议
- 优先看 **${sources[0].fullName}**：它和你的问题匹配度最高，建议先从它入手验证场景。
- 如果更看重生态与成熟度，**${mostMature.fullName}** 的社区规模更大。
- 如果更看重近期动量，**${fastest.fullName}** 的 7 日增速更突出（${signedPct(fastest.weeklyGrowthPct)}）。
- 这些指标只能判断「值不值得研究」，不能替代 PoC。把项目放进项目库后，可以用增速规则持续观察它们的后续表现。

> 回答由本地 RAG 检索生成：先检索项目知识卡，再基于摘要、能力标签和趋势快照组织答案。`

  return { text }
}

function trendAnswer(sources) {
  const db = getState()
  const projects = db.projects
  const totalWeekly = projects.reduce((sum, p) => sum + p.weeklyGrowth, 0)
  const categories = Object.entries(
    projects.reduce((acc, project) => {
      if (!acc[project.category]) acc[project.category] = { weekly: 0, count: 0, pctSum: 0 }
      acc[project.category].weekly += project.weeklyGrowth
      acc[project.category].count += 1
      acc[project.category].pctSum += project.weeklyGrowthPct
      return acc
    }, {})
  )
    .map(([name, data]) => ({
      name,
      weekly: data.weekly,
      count: data.count,
      avgPct: data.pctSum / data.count
    }))
    .sort((a, b) => b.weekly - a.weekly)

  const leader = categories[0]
  const leaderShare = Math.round((leader.weekly / totalWeekly) * 100)
  const selfHosted = projects.filter((p) =>
    /本地|离线|自托管|私有化|privacy|self-hosted|offline/.test(`${p.aliases} ${p.topics.join(' ')}`)
  )
  const selfHostedGrowth = selfHosted.reduce((sum, p) => sum + p.weeklyGrowth, 0)
  const fast = projects.slice().sort((a, b) => b.weeklyGrowthPct - a.weeklyGrowthPct).slice(0, 3)

  const topBlocks = sources
    .map(
      (source, i) =>
        `${i + 1}. **${source.fullName}** [${i + 1}] — 7 日 +${number(source.weeklyGrowth)} stars（${signedPct(source.weeklyGrowthPct)}），${source.category} / ${source.language}。${source.highlights[0]}`
    )
    .join('\n')

  const text = `截至 ${dateLabel()}，知识库中的 **${projects.length}** 个项目近 7 日合计新增 **${number(totalWeekly)}** stars。增长最集中的分类是 **${leader.name}**，贡献了约 **${leaderShare}%** 的增量。

### 本周新增 Stars 最多的项目
${topBlocks}

### 三条可读信号
- **${leader.name}仍是主增长极**：${leader.count} 个项目合计新增 ${number(leader.weekly)} stars，周均增速 ${signedPct(leader.avgPct)}。
- **自托管继续升温**：与本地、离线或私有化相关的 ${selfHosted.length} 个项目，近 7 日合计新增 ${number(selfHostedGrowth)} stars，占全量增量的 ${Math.round((selfHostedGrowth / totalWeekly) * 100)}%。
- **增速弹性来自更小的项目**：${fast.map((p) => `**${p.name}**（${signedPct(p.weeklyGrowthPct)}）`).join('、')} 的周增速领先，但它们是否可持续还需要再看 2–3 个快照周期。

### 下一步怎么读
先看分类，再看单个项目。当一个分类连续两周贡献超过 30% 的增量时，通常意味着新的工具链正在形成，而不是单点事件。你可以为这个分类创建一条「话题升温」预警，让系统替你盯住拐点。

> 以上数据来自当前趋势快照；AI 摘要基于知识库检索与聚合，不构成投资建议。`

  return { text }
}

function generalAnswer(query, sources) {
  const blocks = sources
    .slice(0, 3)
    .map(
      (source, i) =>
        `### ${i + 1}. ${source.fullName} [${i + 1}]
${source.snippet}

${source.highlights.map((item) => `- ${item}`).join('\n')}
- 热度：${number(source.stars)} stars，近 7 日 ${signedPct(source.weeklyGrowthPct)}。`
    )
    .join('\n\n')

  return {
    text: `我检索了 ${getIndexStats().documents} 个知识片段，和你的问题最相关的是下面 ${sources.length} 个项目。

${blocks}

### 可以继续这样问
- 「这些项目里哪个更适合本地部署？」
- 「把 ${sources[0].name} 和 ${sources[1]?.name || '同类项目'} 做个对比」
- 「最近 7 天智能体分类有哪些值得关注的信号？」

> 这次回答使用本地 RAG（BM25 检索 + 项目知识卡），未把问题发送到外部模型。`
  }
}

function chooseSources(query) {
  const projects = findMentionedProjects(query)
  const isCompare = /对比|区别|差异|vs\.?|还是|选哪个|哪个更/i.test(query)
  if (isCompare && projects.length >= 2) {
    return { intent: 'compare', projects: projects.slice(0, 2), sources: [] }
  }
  if (projects.length) {
    return { intent: 'detail', projects: [projects[0]], sources: [] }
  }
  if (/趋势|风向|升温|本周|最近|增长最快|热门|值得关注|风口|热度|排名|榜/i.test(query)) {
    const top = getState().projects
      .slice()
      .sort((a, b) => b.weeklyGrowth - a.weeklyGrowth)
      .slice(0, 4)
    return {
      intent: 'trend',
      projects: top,
      sources: top.map((project, i) => projectAsSource(project, i + 1, '增长榜单'))
    }
  }
  const glossaryKey = ['rag', 'mcp', 'agent', 'bm25'].find(
    (key) => query.toLowerCase().includes(key) && /什么是|是什么|含义|解释|科普|怎么理解/.test(query)
  )
  if (glossaryKey) {
    return { intent: 'glossary', glossaryKey, projects: [], sources: retrieve(query, 3) }
  }
  const sources = retrieve(query, 4)
  const recommend = /推荐|适合|有哪些|帮我找|找几个|选择|方案|搭建|构建|部署|想做|想要|入手|好用/i.test(query)
  return { intent: recommend ? 'recommend' : 'general', projects: [], sources }
}

export function getAiConfig() {
  return {
    mode: API_KEY ? 'remote' : 'local',
    configured: Boolean(API_KEY),
    provider: API_KEY ? PROVIDER : '本地 RAG',
    model: API_KEY ? MODEL : 'BM25 + 知识卡',
    baseUrl: API_KEY ? BASE_URL.replace(/\/\/([^/]+).*/, '//$1') : null
  }
}

async function callRemote(query, sources, history) {
  const context = buildContext(sources)
  const db = getState()
  const system = `你是 Git Trend Monitor 的开源趋势研究助手。今天是 ${new Date().toISOString().slice(0, 10)}。

你只能依据下面提供的项目知识库上下文回答，不要编造项目、数据或不存在的功能。每个关键结论后用 [编号] 标注来源。若上下文不足以回答，直接说明缺什么，并建议用户如何调整问题。

回答使用简体中文，结构清晰但不冗长。数据分析要克制，不要给出投资建议。涉及推荐时，给出取舍理由。

当前知识库共 ${db.projects.length} 个项目。

--- 上下文开始 ---
${context}
--- 上下文结束 ---`

  const messages = [
    { role: 'system', content: system },
    ...history
      .filter((item) => item && (item.role === 'user' || item.role === 'assistant') && item.content)
      .slice(-6)
      .map((item) => ({ role: item.role, content: String(item.content).slice(0, 1500) })),
    { role: 'user', content: query }
  ]

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.35,
      max_tokens: 1100,
      stream: false
    }),
    signal: AbortSignal.timeout(35_000)
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`模型接口返回 ${response.status}: ${detail.slice(0, 240)}`)
  }
  const payload = await response.json()
  const text = payload?.choices?.[0]?.message?.content
  if (!text) throw new Error('模型返回了空内容')
  return text.trim()
}

export async function answerQuestion({ query, history = [] }) {
  const selected = chooseSources(query)
  let sources = selected.sources || []

  if (selected.intent === 'detail') {
    const result = detailAnswer(selected.projects[0])
    sources = result.sources
    return {
      text: result.text,
      sources,
      mode: 'local',
      provider: '本地 RAG',
      model: 'BM25 + 知识卡'
    }
  }

  if (selected.intent === 'compare') {
    const result = compareAnswer(selected.projects)
    sources = result.sources
    return {
      text: result.text,
      sources,
      mode: 'local',
      provider: '本地 RAG',
      model: 'BM25 + 知识卡'
    }
  }

  if (selected.intent === 'trend') {
    return {
      text: trendAnswer(sources).text,
      sources,
      mode: 'local',
      provider: '本地 RAG',
      model: '趋势聚合 + 知识库'
    }
  }

  if (selected.intent === 'glossary') {
    const result = glossaryAnswer(GLOSSARY[selected.glossaryKey], sources)
    return {
      text: result.text,
      sources,
      mode: 'local',
      provider: '本地 RAG',
      model: '概念知识 + BM25'
    }
  }

  sources = sources.length ? sources : retrieve(query, 4)
  const local =
    selected.intent === 'recommend' ? recommendationAnswer(query, sources) : generalAnswer(query, sources)
  const config = getAiConfig()

  if (config.mode === 'remote') {
    try {
      const text = await callRemote(query, sources, history)
      return { text, sources, mode: 'remote', provider: config.provider, model: config.model }
    } catch (error) {
      console.warn(`[assistant] 远程模型调用失败，回退到本地 RAG：${error.message}`)
      return {
        text: `> 远程模型暂时不可用，已自动切换到本地 RAG。\n\n${local.text}`,
        sources,
        mode: 'local-fallback',
        provider: '本地 RAG',
        model: 'BM25 + 知识卡'
      }
    }
  }

  return {
    text: local.text,
    sources,
    mode: 'local',
    provider: '本地 RAG',
    model: 'BM25 + 知识卡'
  }
}
