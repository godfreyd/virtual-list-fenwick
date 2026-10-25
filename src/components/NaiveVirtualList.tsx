import { useLayoutEffect, useReducer, useRef, useState } from 'react'
import { metrics } from '../lib/metrics'
import { findVisibleRangeNaive } from '../lib/visibleRange'
import type { VirtualListProps } from './types'
import { useElementWidth, useScrollFrame } from './useScroller'

interface RenderRange {
  begin: number
  end: number
}

// A typical hand-rolled virtual list:
//   - row height = measured (from the cache) or estimated;
//   - visible window search — a linear pass from the start;
//   - one more full pass on every render to compute
//     the spacer height and the window offset.
// That is O(n) per scroll frame, twice. No scroll compensation when history
// is loaded — the content "jumps".
/* oxlint-disable react/refs */
export function NaiveVirtualList({
  firstItemIndex,
  count,
  estimateHeight,
  renderItem,
  overscan = 4,
  heightAdjustment = 0,
  scrollerRef,
}: VirtualListProps) {
  const ownRef = useRef<HTMLDivElement>(null)
  const scrollRef = scrollerRef ?? ownRef
  const contentRef = useRef<HTMLDivElement>(null)
  const width = useElementWidth(scrollRef)

  // Cache of measured heights by absolute index. A change of width or
  // compact mode invalidates it entirely.
  const measured = useRef(new Map<number, number>())
  const measuredFor = useRef(`${width}:${heightAdjustment}`)
  if (measuredFor.current !== `${width}:${heightAdjustment}`) {
    measured.current.clear()
    measuredFor.current = `${width}:${heightAdjustment}`
  }

  const [range, setRange] = useState<RenderRange>({ begin: 0, end: 0 })
  const rangeRef = useRef(range)
  rangeRef.current = range
  const [, rerender] = useReducer((x: number) => x + 1, 0)
  const frameStartedAt = useRef<number | null>(null)
  const scrolledToBottom = useRef(false)

  const heightAt = (i: number) => {
    const index = firstItemIndex + i
    return measured.current.get(index) ?? estimateHeight(index, width) + heightAdjustment
  }

  const compute = () => {
    const element = scrollRef.current
    if (!element || !width) return

    const startedAt = performance.now()
    const visible = findVisibleRangeNaive(count, heightAt, element.scrollTop, element.clientHeight)
    metrics.compute.push(performance.now() - startedAt)

    const begin = Math.max(visible.first - overscan, 0)
    const end = Math.min(visible.last + overscan + 1, count)
    metrics.visible = {
      firstId: firstItemIndex + visible.first,
      lastId: firstItemIndex + visible.last,
      firstVisibleFraction: visible.firstVisibleFraction,
      lastVisibleFraction: visible.lastVisibleFraction,
      rendered: end - begin,
    }
    // The window hasn't changed — no render will happen, nothing to measure.
    if (rangeRef.current.begin === begin && rangeRef.current.end === end) return
    frameStartedAt.current = startedAt
    setRange({ begin, end })
  }

  useScrollFrame(scrollRef, compute)

  // Measure what we rendered. If the estimate was off, that is one more
  // render (and two more full passes). No dependency array on purpose:
  // we must measure after every commit; the loop settles once heights
  // stop changing.
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const element = scrollRef.current
    const content = contentRef.current
    if (!element || !content || !width) return

    if (frameStartedAt.current !== null) {
      metrics.commit.push(performance.now() - frameStartedAt.current)
      frameStartedAt.current = null
    }

    let changed = false
    for (const child of content.children) {
      const node = child as HTMLElement
      const index = Number(node.dataset.index)
      const height = node.getBoundingClientRect().height
      if (measured.current.get(index) !== height) {
        measured.current.set(index, height)
        changed = true
      }
    }

    if (!scrolledToBottom.current) {
      element.scrollTop = element.scrollHeight
      if (!changed && range.end > 0) scrolledToBottom.current = true
    }

    if (changed || range.end === 0) {
      compute()
      rerender()
    }
  })

  // That second full pass — on every render.
  let total = 0
  let top = 0
  for (let i = 0; i < count; i++) {
    if (i === range.begin) top = total
    total += heightAt(i)
  }

  const rows = []
  for (let i = range.begin; i < Math.min(range.end, count); i++) {
    const index = firstItemIndex + i
    rows.push(
      <div key={index} data-index={index}>
        {renderItem(index)}
      </div>,
    )
  }

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto [overflow-anchor:none]">
      <div className="relative" style={{ height: total }}>
        <div ref={contentRef} style={{ transform: `translate3d(0, ${top}px, 0)` }}>
          {rows}
        </div>
      </div>
    </div>
  )
}
