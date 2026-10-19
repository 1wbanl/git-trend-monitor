import { useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { CategoryStat, TrendPoint } from '../lib/types'
import { areaPath, createChartPoints, smoothPath } from '../lib/chart'
import { compactCount } from '../lib/format'

function niceMax(value: number): number {
  if (value <= 0) return 100
  const exponent = Math.floor(Math.log10(value))
  const base = 10 ** exponent
  const normalized = value / base
  const step = normalized <= 2 ? 0.5 : normalized <= 5 ? 1 : 2
  return Math.ceil((value * 1.08) / (base * step)) * base * step
}

const WIDTH = 840
const HEIGHT = 304
const PAD = { top: 22, right: 18, bottom: 36, left: 46 }

export function GrowthPulse({
  points,
  categories,
  range,
  onRangeChange
}: {
  points: TrendPoint[]
  categories: CategoryStat[]
  range: 7 | 30
  onRangeChange: (range: 7 | 30) => void
}) {
  const [mode, setMode] = useState<'total' | 'split'>('total')
  const [hover, setHover] = useState<number | null>(null)
  const gradientId = useId().replace(/:/g, '')
  const svgRef = useRef<SVGSVGElement>(null)

  const values = useMemo(() => points.map((point) => Number(point.total) || 0), [points])
  const visibleCategories = useMemo(
    () =>
      categories
        .map((category) => ({
          ...category,
          values: points.map((point) => Number(point[category.name]) || 0)
        }))
        .sort((a, b) => b.weeklyGrowth - a.weeklyGrowth),
    [categories, points]
  )

  const maxValue = useMemo(() => {
    const source =
      mode === 'total'
        ? values
        : visibleCategories.flatMap((category) => category.values)
    return niceMax(Math.max(1, ...source))
  }, [mode, values, visibleCategories])

  const totalSeries = createChartPoints(values, {
    width: WIDTH,
    height: HEIGHT,
    paddingTop: PAD.top,
    paddingBottom: PAD.bottom,
    paddingLeft: PAD.left,
    paddingRight: PAD.right,
    minValue: 0,
    maxValue
  })

  const categorySeries = visibleCategories.map((category) => ({
    ...category,
    points: createChartPoints(category.values, {
      width: WIDTH,
      height: HEIGHT,
      paddingTop: PAD.top,
      paddingBottom: PAD.bottom,
      paddingLeft: PAD.left,
      paddingRight: PAD.right,
      minValue: 0,
      maxValue
    }).points
  }))

  const hoverPoint = hover !== null ? points[hover] : null
  const hoverX = hover !== null ? totalSeries.points[hover]?.x || 0 : 0
  const hoverPercent = (hoverX / WIDTH) * 100
  const rangeTotal = values.reduce((sum, value) => sum + value, 0)
  const lastValue = values.at(-1) || 0
  const previousValue = values.at(-2) || 0
  const dayDelta = lastValue - previousValue
  const labelIndexes = useMemo(() => {
    if (points.length <= 7) return points.map((_, index) => index)
    return [0, 5, 10, 15, 20, 25, points.length - 1].filter(
      (index, position, array) => index < points.length && array.indexOf(index) === position
    )
  }, [points])

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!svgRef.current || !points.length) return
    const rect = svgRef.current.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * WIDTH
    const ratio = (x - PAD.left) / (WIDTH - PAD.left - PAD.right)
    const index = Math.round(ratio * (points.length - 1))
    setHover(Math.max(0, Math.min(points.length - 1, index)))
  }

  return (
    <section className="panel growth-pulse">
      <header className="panel-head growth-head">
        <div className="panel-title-block">
          <div className="panel-kicker">
            <span className="kicker-line" />
            VELOCITY · STARS / DAY
          </div>
          <div className="growth-title-row">
            <h2>增长脉冲</h2>
            <span className="chart-summary">
              近 {range} 天 <strong>+{compactCount(rangeTotal)}</strong>
            </span>
          </div>
          <p className="panel-subtitle">所有跟踪项目按日汇总的 Star 增量</p>
        </div>
        <div className="growth-controls">
          <div className="mini-segment" aria-label="图表模式">
            <button
              type="button"
              className={mode === 'total' ? 'is-active' : ''}
              onClick={() => setMode('total')}
            >
              总量
            </button>
            <button
              type="button"
              className={mode === 'split' ? 'is-active' : ''}
              onClick={() => setMode('split')}
            >
              分类
            </button>
          </div>
          <div className="mini-segment" aria-label="时间范围">
            <button
              type="button"
              className={range === 7 ? 'is-active' : ''}
              onClick={() => onRangeChange(7)}
            >
              7D
            </button>
            <button
              type="button"
              className={range === 30 ? 'is-active' : ''}
              onClick={() => onRangeChange(30)}
            >
              30D
            </button>
          </div>
        </div>
      </header>

      <div className="growth-legend-row">
        {mode === 'total' ? (
          <div className="legend-total">
            <span className="legend-dot" style={{ background: '#c8ff5c' }} />
            全部项目
            <span className={`legend-delta ${dayDelta >= 0 ? 'positive' : 'negative'}`}>
              {dayDelta >= 0 ? '+' : ''}
              {compactCount(dayDelta)} 较昨日
            </span>
          </div>
        ) : (
          <div className="chart-legend">
            {visibleCategories.map((category) => (
              <span className="legend-item" key={category.name}>
                <span className="legend-dot" style={{ background: category.color }} />
                {category.name}
              </span>
            ))}
          </div>
        )}
        <span className="chart-axis-note">单位 · stars</span>
      </div>

      <div className="growth-chart-wrap">
        <svg
          ref={svgRef}
          className="growth-chart"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`近 ${range} 天 Star 增长图表`}
          onPointerMove={onPointerMove}
          onPointerLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#c8ff5c" stopOpacity="0.25" />
              <stop offset="62%" stopColor="#c8ff5c" stopOpacity="0.06" />
              <stop offset="100%" stopColor="#c8ff5c" stopOpacity="0" />
            </linearGradient>
          </defs>

          {[0, 0.33, 0.66, 1].map((ratio) => {
            const y = PAD.top + ratio * (HEIGHT - PAD.top - PAD.bottom)
            const label = maxValue * (1 - ratio)
            return (
              <g key={ratio}>
                <line
                  x1={PAD.left}
                  x2={WIDTH - PAD.right}
                  y1={y}
                  y2={y}
                  stroke="rgba(255,255,255,.06)"
                  strokeDasharray={ratio === 1 ? '0' : '3 6'}
                />
                <text
                  className="axis-y"
                  x={PAD.left - 11}
                  y={y + 3.5}
                  fill="#5e6b77"
                  fontSize="10"
                  textAnchor="end"
                >
                  {compactCount(label)}
                </text>
              </g>
            )
          })}

          {labelIndexes.map((index) => (
            <text
              className="axis-x"
              key={index}
              x={totalSeries.points[index]?.x}
              y={HEIGHT - 12}
              fill="#5e6b77"
              fontSize="10"
              textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}
            >
              {points[index]?.label}
            </text>
          ))}

          {mode === 'total' ? (
            <>
              <path
                d={areaPath(totalSeries.points, HEIGHT - PAD.bottom)}
                fill={`url(#${gradientId})`}
              />
              <path
                d={smoothPath(totalSeries.points)}
                fill="none"
                stroke="#c8ff5c"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              {totalSeries.points.length > 0 && (
                <circle
                  cx={totalSeries.points.at(-1)!.x}
                  cy={totalSeries.points.at(-1)!.y}
                  r="3.8"
                  fill="#080d11"
                  stroke="#c8ff5c"
                  strokeWidth="2"
                />
              )}
            </>
          ) : (
            categorySeries.map((category) => (
              <path
                key={category.name}
                d={smoothPath(category.points)}
                fill="none"
                stroke={category.color}
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeOpacity="0.9"
              />
            ))
          )}

          {hover !== null && hoverPoint && (
            <g>
              <line
                x1={hoverX}
                x2={hoverX}
                y1={PAD.top}
                y2={HEIGHT - PAD.bottom}
                stroke="rgba(255,255,255,.22)"
                strokeDasharray="3 4"
              />
              {mode === 'total' ? (
                <circle
                  cx={totalSeries.points[hover].x}
                  cy={totalSeries.points[hover].y}
                  r="4"
                  fill="#0b1014"
                  stroke="#c8ff5c"
                  strokeWidth="2.2"
                />
              ) : (
                categorySeries.map((category) => (
                  <circle
                    key={category.name}
                    cx={category.points[hover]?.x}
                    cy={category.points[hover]?.y}
                    r="3"
                    fill="#0b1014"
                    stroke={category.color}
                    strokeWidth="1.7"
                  />
                ))
              )}
            </g>
          )}
        </svg>

        {hover !== null && hoverPoint && (
          <div
            className={`chart-tooltip ${hoverPercent > 64 ? 'align-right' : ''}`}
            style={{ left: `${Math.min(94, Math.max(6, hoverPercent))}%` }}
          >
            <div className="chart-tooltip-date">{hoverPoint.label}</div>
            <div className="chart-tooltip-total">
              <span>新增</span>
              <strong>+{compactCount(Number(hoverPoint.total) || 0)}</strong>
            </div>
            {mode === 'total' ? (
              <div className="chart-tooltip-meta">全站 {visibleCategories[0]?.name || 'AI 应用'} 等 6 个分类</div>
            ) : (
              <div className="chart-tooltip-lines">
                {visibleCategories
                  .slice()
                  .sort((a, b) => (Number(hoverPoint[b.name]) || 0) - (Number(hoverPoint[a.name]) || 0))
                  .slice(0, 3)
                  .map((category) => (
                    <div className="tooltip-line" key={category.name}>
                      <span>
                        <i style={{ background: category.color }} />
                        {category.name}
                      </span>
                      <b>+{compactCount(Number(hoverPoint[category.name]) || 0)}</b>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="growth-mobile-axis" aria-hidden="true">
        <span>{points[0]?.label}</span>
        <span>{points[Math.floor((points.length - 1) / 2)]?.label}</span>
        <span>{points.at(-1)?.label}</span>
      </div>
    </section>
  )
}
