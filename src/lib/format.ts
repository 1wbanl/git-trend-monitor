import type { Category, ProjectStatus } from './types'

const numberFormatter = new Intl.NumberFormat('en-US')

export function formatNumber(value: number): string {
  return numberFormatter.format(Math.round(value || 0))
}

export function compactCount(value: number): string {
  if (!Number.isFinite(value)) return '0'
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`
  if (value >= 100_000) return `${(value / 1_000).toFixed(1)}k`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return String(Math.round(value))
}

export function compactWan(value: number): string {
  if (value >= 10_000) return `${(value / 10_000).toFixed(1)} 万`
  return formatNumber(value)
}

export function signedPct(value: number, digits = 1): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${Number(value).toFixed(digits)}%`
}

export function signedNumber(value: number): string {
  return `${value > 0 ? '+' : ''}${formatNumber(value)}`
}

export function relativeTime(iso?: string | null): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(diff)) return '—'
  if (diff < 0) {
    const ahead = Math.abs(diff)
    if (ahead < 60_000) return '即将'
    if (ahead < 3_600_000) return `${Math.round(ahead / 60_000)} 分钟后`
    return `${Math.round(ahead / 3_600_000)} 小时后`
  }
  if (diff < 45_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.max(1, Math.round(diff / 60_000))} 分钟前`
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)} 小时前`
  if (diff < 7 * 86_400_000) return `${Math.round(diff / 86_400_000)} 天前`
  const date = new Date(iso)
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日`
}

export function dateLong(date = new Date()): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  }).format(date)
}

export function dateTime(iso?: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date(iso))
}

export function timeOnly(iso?: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date(iso))
}

export function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 6) return '夜深了'
  if (hour < 11) return '早上好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

export const categoryColors: Record<Category, string> = {
  'AI 应用': '#c8ff5c',
  '智能体': '#7aa7ff',
  '开发工具': '#ffb86b',
  '基础设施': '#65d9d4',
  '数据与搜索': '#c4a7ff',
  '设计前端': '#ff8fa3'
}

export function categoryColor(category?: string | null): string {
  return categoryColors[category as Category] || '#8a97a4'
}

export function categoryShort(category?: string | null): string {
  if (!category) return '未知'
  return category
}

export function statusTone(status: ProjectStatus | string | null): string {
  if (status === '重点关注') return 'focus'
  if (status === '观察中') return 'watch'
  if (status === '评估中') return 'evaluate'
  return 'idle'
}

export function momentumLabel(value: number): { label: string; tone: string } {
  if (value >= 6) return { label: '强动量', tone: 'hot' }
  if (value >= 3) return { label: '升温', tone: 'warm' }
  if (value >= 1) return { label: '平稳', tone: 'steady' }
  return { label: '低波动', tone: 'quiet' }
}

export function severityLabel(value: string): string {
  if (value === 'high') return '高优先'
  if (value === 'medium') return '需关注'
  return '提示'
}

export function formatDuration(ms?: number | null): string {
  if (!ms && ms !== 0) return '—'
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export function sparklinePath(values: number[], width = 84, height = 26, padding = 2): string {
  if (!values.length) return ''
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const step = (width - padding * 2) / Math.max(1, values.length - 1)
  return values
    .map((value, index) => {
      const x = padding + index * step
      const y = height - padding - ((value - min) / range) * (height - padding * 2)
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

export function initials(value: string): string {
  const cleaned = value.replace(/[-_]/g, ' ').trim()
  const parts = cleaned.split(/\s+/)
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase()
  return cleaned.slice(0, 2).toUpperCase()
}

const logoPalette = ['#c8ff5c', '#7aa7ff', '#ffb86b', '#65d9d4', '#c4a7ff', '#ff8fa3']
export function logoColor(value: string): string {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  return logoPalette[hash % logoPalette.length]
}

export function truncate(value: string, length = 120): string {
  if (value.length <= length) return value
  return `${value.slice(0, length).trim()}…`
}

export function normalizeLanguage(language: string): string {
  if (language === 'JavaScript') return 'JS'
  if (language === 'TypeScript') return 'TS'
  return language
}
