import type { HeightIndex } from './heights/HeightIndex'
import { STAGES } from './heights/stages'
import { estimateMessageHeight } from './messages'
import { metrics, resetMetrics, Series, type SeriesStats } from './metrics'
import { findVisibleRange, findVisibleRangeNaive } from './visibleRange'

// --- Scroll run: programmatic scrolling, frame duration measurement ---

// Where the user scrolls: near the end of history (up) or near its start (down).
// This matters for stages 1–2: their cost depends on the row index.
export type ScrollScenario = 'end' | 'start'

export interface ScrollRunResult {
  scenario: ScrollScenario
  frames: SeriesStats
  longFrames: number
  compute: SeriesStats
  commit: SeriesStats
  update: SeriesStats
}

// A frame longer than 20 ms at 60 Hz means at least one frame was dropped.
const LONG_FRAME_MS = 20
const nextFrame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve))

export async function runScrollBenchmark(
  scroller: HTMLElement,
  scenario: ScrollScenario,
  durationMs = 5000,
  pixelsPerFrame = 80,
): Promise<ScrollRunResult> {
  scroller.scrollTop = scenario === 'end' ? scroller.scrollHeight : 0
  // Let the list render the new position and measure rows.
  for (let i = 0; i < 10; i++) await nextFrame()

  resetMetrics()
  const frames = new Series(2000)
  let longFrames = 0
  const direction = scenario === 'end' ? -1 : 1
  const startedAt = await nextFrame()
  let previous = startedAt

  for (;;) {
    scroller.scrollTop += direction * pixelsPerFrame
    const now = await nextFrame()
    frames.push(now - previous)
    if (now - previous > LONG_FRAME_MS) longFrames++
    previous = now
    if (now - startedAt >= durationMs) break
  }

  return {
    scenario,
    frames: frames.stats(),
    longFrames,
    compute: metrics.compute.stats(),
    commit: metrics.commit.stats(),
    update: metrics.update.stats(),
  }
}

// --- Microbenchmark: height storages only, no React or DOM ---

export interface MicroRow {
  title: string
  buildUs: number
  queryEndUs: number // window search near the end of history
  queryStartUs: number // window search near the start of history
  updateEndUs: number // set() on a row near the end of history
  updateStartUs: number // set() on a row near the start of history
  addAllUs: number // addRange over the whole history
}

let sink = 0

// Run the function in batches until the time budget is spent, so that both
// O(n) and O(log n) produce a meaningful number.
function measureUs(run: (iteration: number) => number, budgetMs = 60): number {
  for (let i = 0; i < 20; i++) sink += run(i) // JIT warm-up

  let iterations = 0
  const startedAt = performance.now()
  let elapsed = 0
  while (elapsed < budgetMs || iterations < 3) {
    sink += run(iterations++)
    elapsed = performance.now() - startedAt
  }

  return (elapsed * 1000) / iterations
}

export function runMicroBenchmark(size: number, containerWidth: number, viewportHeight: number): MicroRow[] {
  const heights = new Float64Array(size)
  for (let i = 0; i < size; i++) heights[i] = estimateMessageHeight(i, containerWidth)
  const startRow = 10
  const endRow = size - 10

  const rows: MicroRow[] = []

  // Stage 0 — as in the component: measured heights in a Map (only rendered
  // rows are there), an estimate for every other row on every iteration.
  const measured = new Map<number, number>()
  for (let i = size - 30; i < size; i++) measured.set(i, heights[i])
  const heightAt = (index: number) => measured.get(index) ?? estimateMessageHeight(index, containerWidth)
  let total = 0
  for (let i = 0; i < size; i++) total += heights[i]
  const endTop = Math.max(total - viewportHeight, 0)
  // No storage: an update is a Map write, a bulk change is a cache reset (NaN = "not applicable").
  rows.push({
    title: STAGES[0].title,
    buildUs: NaN,
    queryEndUs: measureUs(() => findVisibleRangeNaive(size, heightAt, endTop, viewportHeight).last),
    queryStartUs: measureUs(() => findVisibleRangeNaive(size, heightAt, 0, viewportHeight).last),
    updateEndUs: NaN,
    updateStartUs: NaN,
    addAllUs: NaN,
  })

  for (const stage of STAGES.slice(1)) {
    const createIndex = stage.createIndex!
    let index: HeightIndex = createIndex(heights.slice())
    const buildUs = measureUs(() => {
      index = createIndex(heights.slice())
      return index.size
    })
    const endOffset = Math.max(index.total() - viewportHeight, 0)
    // Alternate between two heights so set() actually changes something.
    const toggle = (row: number, i: number) => {
      index.set(row, heights[row] + (i & 1))
      return 0
    }

    rows.push({
      title: stage.title,
      buildUs,
      queryEndUs: measureUs(() => findVisibleRange(index, endOffset, viewportHeight).last),
      queryStartUs: measureUs(() => findVisibleRange(index, 0, viewportHeight).last),
      updateEndUs: measureUs((i) => toggle(endRow, i)),
      updateStartUs: measureUs((i) => toggle(startRow, i)),
      addAllUs: measureUs((i) => {
        index.addRange(0, index.size, i & 1 ? -1 : 1)
        return 0
      }),
    })
  }

  return rows
}
