// Metrics are written to a mutable store, not React state: otherwise the
// measurement itself would cause extra renders and skew the result.

export interface SeriesStats {
  count: number
  last: number
  median: number
  p95: number
}

export class Series {
  private readonly buffer: Float64Array
  private length = 0
  private position = 0
  private lastValue = 0

  constructor(capacity: number) {
    this.buffer = new Float64Array(capacity)
  }

  push(value: number): void {
    this.buffer[this.position] = value
    this.position = (this.position + 1) % this.buffer.length
    this.length = Math.min(this.length + 1, this.buffer.length)
    this.lastValue = value
  }

  reset(): void {
    this.length = 0
    this.position = 0
    this.lastValue = 0
  }

  stats(): SeriesStats {
    if (this.length === 0) return { count: 0, last: 0, median: 0, p95: 0 }

    const sorted = this.buffer.slice(0, this.length).sort()
    const at = (q: number) => sorted[Math.min(Math.floor(q * sorted.length), sorted.length - 1)]

    return { count: this.length, last: this.lastValue, median: at(0.5), p95: at(0.95) }
  }
}

export interface VisibleInfo {
  firstId: number
  lastId: number
  firstVisibleFraction: number
  lastVisibleFraction: number
  rendered: number
}

export const metrics = {
  // Visible window search — the algorithm alone.
  compute: new Series(600),
  // From the scroll event to the React commit: algorithm + render + DOM.
  commit: new Series(600),
  // Applying ResizeObserver measurements to the height storage (one batch per frame).
  update: new Series(600),
  // Last bulk change (compact mode), ms.
  bulkUpdateMs: null as number | null,
  visible: null as VisibleInfo | null,
}

export function resetMetrics(): void {
  metrics.compute.reset()
  metrics.commit.reset()
  metrics.update.reset()
  metrics.bulkUpdateMs = null
  metrics.visible = null
}

export function formatMs(value: number): string {
  if (value < 0.001) return `${Math.round(value * 1_000_000)} ns`
  if (value < 1) return `${Math.round(value * 1000)} µs`
  return `${value.toFixed(1)} ms`
}

export function formatStat(stats: SeriesStats, value: number): string {
  return stats.count === 0 ? '—' : formatMs(value)
}
