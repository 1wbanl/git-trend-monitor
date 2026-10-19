export type Category =
  | 'AI 应用'
  | '智能体'
  | '开发工具'
  | '基础设施'
  | '数据与搜索'
  | '设计前端'

export type ProjectStatus = '重点关注' | '观察中' | '评估中' | null

export interface HistoryPoint {
  date: string
  stars: number
}

export interface Project {
  id: string
  name: string
  owner: string
  fullName: string
  description: string
  descriptionEn?: string
  summary: string
  highlights: string[]
  category: Category
  language: string
  languageColor: string
  stars: number
  weeklyGrowth: number
  weeklyGrowthPct: number
  dailyGrowth: number
  forks: number
  issues: number
  contributors: number
  license: string
  version: string
  trendingScore: number
  topics: string[]
  aliases: string
  tags: string[]
  tracked: boolean
  status: ProjectStatus
  origin: 'seed' | 'github'
  homepage: string
  createdAt: string
  pushedAt: string
  releaseAt: string
  syncedAt: string
  note?: string
  readme?: string
  history?: HistoryPoint[]
  sparkline: number[]
}

export interface TrendPoint {
  date: string
  label: string
  total: number
  [category: string]: string | number
}

export interface CategoryStat {
  name: Category
  color: string
  soft: string
  count: number
  weeklyGrowth: number
  weeklyGrowthPct: number
  share: number
  stars: number
}

export interface Mover {
  rank: number
  id: string
  owner: string
  name: string
  fullName: string
  description: string
  category: Category
  language: string
  languageColor: string
  stars: number
  weeklyGrowth: number
  weeklyGrowthPct: number
  dailyGrowth: number
  trendingScore: number
  tracked: boolean
  sparkline: number[]
}

export interface Topic {
  name: string
  description: string
  projectCount: number
  weeklyGrowth: number
  avgGrowthPct: number
  projectIds: string[]
}

export interface Opportunity {
  id: string
  fullName: string
  name: string
  category: Category
  stars: number
  weeklyGrowth: number
  weeklyGrowthPct: number
  forks: number
  trendingScore: number
  color: string
}

export interface SignalEvent {
  id: string
  ruleId: string
  projectId: string | null
  projectName: string | null
  projectCategory: Category | null
  projectTracked?: boolean
  category?: Category | null
  stars?: number | null
  severity: 'high' | 'medium' | 'low'
  title: string
  message: string
  read: boolean
  createdAt: string
}

export interface Activity {
  id: string
  type: 'alert' | 'sync' | 'track' | 'untrack' | 'insight'
  title: string
  detail: string
  projectId?: string
  createdAt: string
}

export interface Briefing {
  headline: string
  intro: string
  signals: {
    label: string
    title: string
    body: string
    projectId: string | null
  }[]
  footnote: string
  generatedAt: string
}

export interface GithubStatus {
  connected: boolean
  mode: 'demo' | 'live' | string
  authenticated: boolean
  tokenConfigured: boolean
  lastSyncAt: string
  nextSyncAt: string
  autoSync: boolean
  intervalMinutes: number
  running: boolean
  lastStatus: string
  api: string
  rateLimit: string
}

export interface AiConfig {
  mode: 'local' | 'remote'
  configured: boolean
  provider: string
  model: string
  baseUrl: string | null
}

export interface RagStats {
  documents: number
  projects: number
  terms: number
  builtAt: string | null
  method: string
  avgTokens: number
}

export interface Overview {
  stats: {
    totalProjects: number
    totalStars: number
    weeklyGrowth: number
    weeklyGrowthPct: number
    newToday: number
    trackedCount: number
    activeRules: number
    unreadAlerts: number
    averageScore: number
  }
  trend: {
    sevenDays: TrendPoint[]
    thirtyDays: TrendPoint[]
    categories: CategoryStat[]
  }
  topMovers: Mover[]
  topics: Topic[]
  categories: CategoryStat[]
  briefing: Briefing
  opportunities: Opportunity[]
  signals: SignalEvent[]
  activity: Activity[]
  meta: {
    lastSyncAt: string
    lastSyncStatus: string
    dataMode: string
    autoSync: boolean
    intervalMinutes: number
    github: GithubStatus
    ai: AiConfig
    rag: RagStats
  }
}

export interface ProjectsResponse {
  items: Project[]
  total: number
  allTotal: number
  trackedTotal: number
  trackedWeeklyGrowth: number
  trackedWeeklyStars: number
  facets: {
    categories: { name: Category; count: number; color: string }[]
    languages: { name: string; count: number }[]
    statuses: { name: string | null; count: number }[]
  }
}

export interface ProjectDetailResponse {
  project: Project
  related: Project[]
}

export interface AlertRule {
  id: string
  name: string
  description: string
  enabled: boolean
  metric: string
  operator: string
  threshold: number
  window: string
  scope: string
  scopeLabel: string
  channels: string[]
  triggers: number
  lastTriggeredAt: string | null
  createdAt: string
}

export interface AlertsResponse {
  rules: AlertRule[]
  events: SignalEvent[]
  stats: {
    activeRules: number
    totalRules: number
    unread: number
    triggeredThisWeek: number
    highPriority: number
  }
}

export interface SyncLog {
  id: string
  at: string
  status: 'success' | 'error' | 'partial' | string
  source: string
  message: string
  added: number
  updated: number
  duration: number
}

export interface SourcesResponse {
  github: GithubStatus
  ai: AiConfig
  rag: RagStats
  syncLogs: SyncLog[]
  meta: {
    lastSyncAt: string
    dataMode: string
    createdAt: string
  }
}

export interface ChatSource {
  index: number
  projectId: string
  fullName: string
  owner: string
  name: string
  title: string
  category: Category
  language: string
  languageColor: string
  stars: number
  weeklyGrowth: number
  weeklyGrowthPct: number
  trendingScore: number
  snippet: string
  highlights: string[]
  url: string
  score: number
  reason: string
}

export interface ChatMeta {
  mode: 'local' | 'remote' | 'local-fallback'
  provider: string
  model: string
  sources: ChatSource[]
  retrieval: RagStats
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: ChatSource[]
  meta?: Pick<ChatMeta, 'mode' | 'provider' | 'model'>
  createdAt: string
  streaming?: boolean
}
