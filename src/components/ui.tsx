import type { CSSProperties, ReactNode } from 'react'
import type { Category, ProjectStatus } from '../lib/types'
import {
  categoryColor,
  initials,
  logoColor,
  sparklinePath,
  statusTone
} from '../lib/format'

export function ProjectAvatar({
  name,
  owner,
  size = 38,
  className = ''
}: {
  name: string
  owner?: string
  size?: number
  className?: string
}) {
  const color = logoColor(`${owner || ''}/${name}`)
  const label = initials(name.replace(/-/g, ' ')).slice(0, 2)
  return (
    <span
      className={`project-avatar ${className}`}
      style={
        {
          '--avatar-color': color,
          width: size,
          height: size,
          fontSize: Math.max(10, size * 0.31)
        } as CSSProperties
      }
      aria-hidden="true"
    >
      {label}
    </span>
  )
}

export function Sparkline({
  values,
  width = 86,
  height = 27,
  color = '#c8ff5c',
  fill = false,
  strokeWidth = 1.7
}: {
  values: number[]
  width?: number
  height?: number
  color?: string
  fill?: boolean
  strokeWidth?: number
}) {
  const path = sparklinePath(values, width, height, 2)
  if (!path) return <span style={{ width, height }} />
  const area = `${path} L${width - 2},${height} L2,${height} Z`
  const id = `spark-${Math.abs(
    values.reduce((hash, value) => (hash * 31 + value) % 1_000_000, 7)
  )}-${width}`
  return (
    <svg
      className="sparkline"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label="近期 Stars 趋势"
    >
      {fill && (
        <>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.22" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${id})`} />
        </>
      )}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function CategoryPill({
  category,
  subtle = false
}: {
  category: Category | string
  subtle?: boolean
}) {
  const color = categoryColor(category)
  return (
    <span
      className={`category-pill ${subtle ? 'is-subtle' : ''}`}
      style={{ '--pill-color': color } as CSSProperties}
    >
      <span className="pill-dot" />
      {category}
    </span>
  )
}

export function StatusBadge({ status }: { status: ProjectStatus | string }) {
  if (!status) return <span className="status-badge status-idle">未跟踪</span>
  return <span className={`status-badge status-${statusTone(status)}`}>{status}</span>
}

export function Toggle({
  checked,
  onChange,
  label
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label || '切换'}
      className={`toggle ${checked ? 'is-on' : ''}`}
      onClick={(event) => {
        event.stopPropagation()
        onChange(!checked)
      }}
    >
      <span className="toggle-thumb" />
    </button>
  )
}

export function Spinner({ size = 16 }: { size?: number }) {
  return <span className="spinner" style={{ width: size, height: size }} aria-hidden="true" />
}

export function EmptyState({
  icon,
  title,
  description,
  action
}: {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  )
}

export function Skeleton({
  width,
  height = 16,
  radius = 8,
  className = '',
  style
}: {
  width?: string | number
  height?: number
  radius?: number
  className?: string
  style?: CSSProperties
}) {
  return (
    <span
      className={`skeleton ${className}`}
      style={{ width: width || '100%', height, borderRadius: radius, ...style }}
    />
  )
}

export function KeyCap({ children }: { children: ReactNode }) {
  return <kbd className="keycap">{children}</kbd>
}

export function ArrowLink({
  children,
  onClick,
  className = ''
}: {
  children: ReactNode
  onClick?: () => void
  className?: string
}) {
  return (
    <button type="button" className={`text-link ${className}`} onClick={onClick}>
      {children}
      <span aria-hidden="true">↗</span>
    </button>
  )
}
