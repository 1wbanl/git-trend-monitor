export interface ChartPoint {
  x: number
  y: number
}

export function smoothPath(points: ChartPoint[]): string {
  if (!points.length) return ''
  if (points.length === 1) return `M${points[0].x},${points[0].y}`
  let path = `M${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] || points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] || p2
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    path += ` C${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`
  }
  return path
}

export function areaPath(points: ChartPoint[], baseline: number): string {
  if (!points.length) return ''
  return `${smoothPath(points)} L${points.at(-1)!.x.toFixed(2)},${baseline} L${points[0].x.toFixed(2)},${baseline} Z`
}

export function createChartPoints(
  values: number[],
  options: {
    width: number
    height: number
    paddingTop?: number
    paddingBottom?: number
    paddingLeft?: number
    paddingRight?: number
    minValue?: number
    maxValue?: number
  }
): { points: ChartPoint[]; min: number; max: number } {
  const {
    width,
    height,
    paddingTop = 16,
    paddingBottom = 24,
    paddingLeft = 8,
    paddingRight = 8
  } = options
  const rawMin = options.minValue ?? Math.min(...values)
  const rawMax = options.maxValue ?? Math.max(...values)
  const spread = rawMax - rawMin
  const min = options.minValue ?? rawMin - spread * 0.18
  const max = options.maxValue ?? rawMax + spread * 0.12
  const range = max - min || 1
  const plotWidth = width - paddingLeft - paddingRight
  const plotHeight = height - paddingTop - paddingBottom
  const points = values.map((value, index) => ({
    x: paddingLeft + (index / Math.max(1, values.length - 1)) * plotWidth,
    y: paddingTop + (1 - (value - min) / range) * plotHeight
  }))
  return { points, min, max }
}
