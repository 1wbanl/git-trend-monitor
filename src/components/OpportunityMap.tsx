import { useMemo, useState } from 'react'
import type { Opportunity } from '../lib/types'
import { useApp } from '../context/AppContext'
import { compactCount, signedPct } from '../lib/format'

const WIDTH = 1020
const HEIGHT = 388
const PAD = { top: 34, right: 34, bottom: 44, left: 58 }

export function OpportunityMap({ opportunities }: { opportunities: Opportunity[] }) {
  const { openProject } = useApp()
  const [hovered, setHovered] = useState<string | null>(null)

  const medians = useMemo(() => {
    const sortedX = opportunities.map((item) => item.weeklyGrowthPct).sort((a, b) => a - b)
    const sortedY = opportunities.map((item) => item.stars).sort((a, b) => a - b)
    return {
      x: sortedX[Math.floor(sortedX.length / 2)] || 3,
      y: sortedY[Math.floor(sortedY.length / 2)] || 50000
    }
  }, [opportunities])

  const xMax = useMemo(() => {
    const max = Math.max(8, ...opportunities.map((item) => item.weeklyGrowthPct))
    return Math.ceil(max * 1.12)
  }, [opportunities])

  const yDomain = useMemo(() => {
    const values = opportunities.map((item) => Math.log10(Math.max(1000, item.stars)))
    return {
      min: Math.floor(Math.min(...values) * 10) / 10 - 0.08,
      max: Math.ceil(Math.max(...values) * 10) / 10 + 0.08
    }
  }, [opportunities])

  const plotW = WIDTH - PAD.left - PAD.right
  const plotH = HEIGHT - PAD.top - PAD.bottom

  const xFor = (pct: number) => PAD.left + (pct / xMax) * plotW
  const yFor = (stars: number) => {
    const value = Math.log10(Math.max(1000, stars))
    return PAD.top + (1 - (value - yDomain.min) / (yDomain.max - yDomain.min)) * plotH
  }
  const radiusFor = (forks: number) => Math.max(6, Math.min(18, 5 + Math.sqrt(forks) / 20))

  const medianX = xFor(medians.x)
  const medianY = yFor(medians.y)
  const labelled = new Set(
    opportunities
      .slice()
      .sort((a, b) => b.trendingScore - a.trendingScore)
      .slice(0, 7)
      .map((item) => item.id)
  )
  const categoryLegend = [...new Map(opportunities.map((item) => [item.category, item.color])).entries()]
  const hoveredProject = opportunities.find((item) => item.id === hovered)
  const hoveredPoint = hoveredProject
    ? { x: xFor(hoveredProject.weeklyGrowthPct), y: yFor(hoveredProject.stars) }
    : null

  return (
    <section className="panel opportunity-panel">
      <header className="panel-head opportunity-head">
        <div className="panel-title-block">
          <div className="panel-kicker">
            <span className="kicker-line" />
            OPPORTUNITY MAP · {opportunities.length} PROJECTS
          </div>
          <h2>机会象限</h2>
          <p className="panel-subtitle">横轴为 7 日增速，纵轴为项目体量，气泡大小代表 Forks</p>
        </div>
        <div className="map-legend">
          {categoryLegend.map(([name, color]) => (
            <span className="legend-item" key={name}>
              <span className="legend-dot" style={{ background: color }} />
              {name}
            </span>
          ))}
        </div>
      </header>

      <div className="opportunity-wrap">
        <svg
          className="opportunity-chart"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label="项目机会象限图"
        >
          <defs>
            <radialGradient id="map-hot-zone" cx="80%" cy="15%" r="65%">
              <stop offset="0%" stopColor="#c8ff5c" stopOpacity="0.06" />
              <stop offset="100%" stopColor="#c8ff5c" stopOpacity="0" />
            </radialGradient>
          </defs>

          <rect x={PAD.left} y={PAD.top} width={plotW} height={plotH} fill="rgba(255,255,255,.012)" rx="10" />
          <rect x={PAD.left} y={PAD.top} width={plotW} height={plotH} fill="url(#map-hot-zone)" rx="10" />

          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
            <g key={`grid-${ratio}`}>
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={PAD.top + ratio * plotH}
                y2={PAD.top + ratio * plotH}
                stroke="rgba(255,255,255,.055)"
                strokeDasharray="3 7"
              />
              <line
                x1={PAD.left + ratio * plotW}
                x2={PAD.left + ratio * plotW}
                y1={PAD.top}
                y2={HEIGHT - PAD.bottom}
                stroke="rgba(255,255,255,.04)"
                strokeDasharray="3 7"
              />
            </g>
          ))}

          <line
            x1={medianX}
            x2={medianX}
            y1={PAD.top}
            y2={HEIGHT - PAD.bottom}
            stroke="rgba(200,255,92,.22)"
            strokeDasharray="4 5"
          />
          <line
            x1={PAD.left}
            x2={WIDTH - PAD.right}
            y1={medianY}
            y2={medianY}
            stroke="rgba(200,255,92,.22)"
            strokeDasharray="4 5"
          />

          <text x={WIDTH - PAD.right - 12} y={PAD.top + 22} textAnchor="end" className="quadrant-label is-hot">
            高热度 · 高增速
          </text>
          <text x={PAD.left + 12} y={PAD.top + 22} className="quadrant-label">
            体量大 · 增速温和
          </text>
          <text x={WIDTH - PAD.right - 12} y={HEIGHT - PAD.bottom - 12} textAnchor="end" className="quadrant-label">
            小体量 · 高弹性
          </text>

          {[2, 4, 6, 8].filter((tick) => tick <= xMax).map((tick) => (
            <text
              key={`x-${tick}`}
              x={xFor(tick)}
              y={HEIGHT - 15}
              fill="#5f6b76"
              fontSize="10.5"
              textAnchor="middle"
            >
              +{tick}%
            </text>
          ))}
          {[20000, 50000, 100000, 150000].map((tick) => {
            const y = yFor(tick)
            if (y < PAD.top || y > HEIGHT - PAD.bottom) return null
            return (
              <text key={`y-${tick}`} x={PAD.left - 12} y={y + 3.5} fill="#5f6b76" fontSize="10.5" textAnchor="end">
                {tick >= 1000 ? `${tick / 1000}k` : tick}
              </text>
            )
          })}
          <text
            x={(PAD.left + WIDTH - PAD.right) / 2}
            y={HEIGHT - 2}
            fill="#4f5a65"
            fontSize="9.5"
            textAnchor="middle"
          >
            7 DAY GROWTH →
          </text>

          {opportunities.map((project) => {
            const x = xFor(project.weeklyGrowthPct)
            const y = yFor(project.stars)
            const radius = radiusFor(project.forks)
            const active = hovered === project.id
            const labelRight = x < WIDTH - 190
            return (
              <g
                key={project.id}
                className={`map-bubble ${active ? 'is-hovered' : ''}`}
                onMouseEnter={() => setHovered(project.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => openProject(project.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') openProject(project.id)
                }}
                aria-label={`${project.fullName}，${project.category}，近 7 日增速 ${signedPct(project.weeklyGrowthPct)}`}
              >
                <circle
                  cx={x}
                  cy={y}
                  r={radius + (active ? 4 : 0)}
                  fill={project.color}
                  fillOpacity={active ? 0.2 : 0.08}
                  stroke={project.color}
                  strokeOpacity={active ? 0.9 : 0.52}
                  strokeWidth={active ? 1.8 : 1.2}
                />
                <circle cx={x} cy={y} r={Math.max(3, radius * 0.34)} fill={project.color} fillOpacity={active ? 1 : 0.82} />
                {labelled.has(project.id) && (
                  <text
                    x={labelRight ? x + radius + 7 : x - radius - 7}
                    y={y + 3.5}
                    fill={active ? '#eaf2ec' : '#9aa5ae'}
                    fontSize="10.5"
                    textAnchor={labelRight ? 'start' : 'end'}
                    className="map-bubble-label"
                  >
                    {project.name}
                  </text>
                )}
              </g>
            )
          })}
        </svg>

        {hoveredProject && hoveredPoint && (
          <div
            className={`map-tooltip ${hoveredPoint.x / WIDTH > 0.7 ? 'align-right' : ''}`}
            style={{
              left: `${(hoveredPoint.x / WIDTH) * 100}%`,
              top: `${(hoveredPoint.y / HEIGHT) * 100}%`
            }}
          >
            <div className="map-tooltip-head">
              <span className="map-tooltip-dot" style={{ background: hoveredProject.color }} />
              <strong>{hoveredProject.fullName}</strong>
            </div>
            <div className="map-tooltip-category">{hoveredProject.category}</div>
            <div className="map-tooltip-grid">
              <span>
                <small>STARS</small>
                {compactCount(hoveredProject.stars)}
              </span>
              <span>
                <small>7D</small>
                {signedPct(hoveredProject.weeklyGrowthPct)}
              </span>
              <span>
                <small>FORKS</small>
                {compactCount(hoveredProject.forks)}
              </span>
            </div>
            <div className="map-tooltip-foot">点击查看项目信号 →</div>
          </div>
        )}
      </div>

      <div className="map-footer">
        <span className="map-scroll-hint">← 左右滑动查看完整象限 →</span>
        <span>虚线表示当前样本的中位数</span>
        <span>气泡越大，Fork 越多</span>
        <span className="map-footer-hint">点击气泡打开项目详情</span>
      </div>
    </section>
  )
}
