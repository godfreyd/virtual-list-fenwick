import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react'
import type { HeightIndex } from '../lib/heights/HeightIndex'
import { metrics } from '../lib/metrics'
import { findVisibleRange } from '../lib/visibleRange'
import type { VirtualListProps } from './types'
import { useElementWidth, useScrollFrame } from './useScroller'

interface RenderRange {
  begin: number
  end: number
}

interface IndexedVirtualListProps extends VirtualListProps {
  createIndex(values: Float64Array): HeightIndex
}

const BOTTOM_EPSILON = 2

// The list for stages 1–4. One component; only the height storage changes:
//   - window search — two lowerBound calls;
//   - spacer height and window offset — total and prefixSum;
//   - ResizeObserver updates row heights via set;
//   - compact mode — addRange over the whole history.
// The cost of every operation is defined by createIndex.
//
// The storage is a mutable structure outside React: copying the array on every
// height change would bring O(n) back. So it lives in a ref, is read during
// render, and we request re-renders explicitly via rerender().
/* oxlint-disable react/refs */
export function IndexedVirtualList({
  firstItemIndex,
  count,
  estimateHeight,
  renderItem,
  createIndex,
  overscan = 4,
  anchoring = true,
  heightAdjustment = 0,
  scrollerRef,
}: IndexedVirtualListProps) {
  const ownRef = useRef<HTMLDivElement>(null)
  const scrollRef = scrollerRef ?? ownRef
  const spacerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const width = useElementWidth(scrollRef)

  const indexRef = useRef<HeightIndex | null>(null)
  const indexFirstItem = useRef(firstItemIndex)
  const appliedAdjustment = useRef(heightAdjustment)
  const [range, setRange] = useState<RenderRange>({ begin: 0, end: 0 })
  const rangeRef = useRef(range)
  rangeRef.current = range
  const [, rerender] = useReducer((x: number) => x + 1, 0)
  const frameStartedAt = useRef<number | null>(null)

  // Fresh values for ResizeObserver callbacks.
  const latest = useRef({ anchoring, firstItemIndex })
  latest.current = { anchoring, firstItemIndex }

  const estimate = (index: number) => estimateHeight(index, width) + appliedAdjustment.current

  const isAtBottom = (element: HTMLElement) =>
    element.scrollTop + element.clientHeight >= element.scrollHeight - BOTTOM_EPSILON

  // Update the spacer directly, before writing scrollTop: otherwise the browser
  // clamps scrollTop to the old content height.
  const syncSpacer = (index: HeightIndex) => {
    if (spacerRef.current) spacerRef.current.style.height = `${index.total()}px`
  }

  const compute = () => {
    const element = scrollRef.current
    const index = indexRef.current
    if (!element || !index) return

    const startedAt = performance.now()
    const visible = findVisibleRange(index, element.scrollTop, element.clientHeight)
    metrics.compute.push(performance.now() - startedAt)

    const begin = Math.max(visible.first - overscan, 0)
    const end = Math.min(visible.last + overscan + 1, index.size)
    metrics.visible = {
      firstId: indexFirstItem.current + visible.first,
      lastId: indexFirstItem.current + visible.last,
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

  // Real heights come from ResizeObserver. We create it during render because
  // row ref callbacks fire before the parent's effects.
  const observerRef = useRef<ResizeObserver | null>(null)
  const onResizeRef = useRef<(entries: ResizeObserverEntry[]) => void>(() => {})
  if (observerRef.current === null) {
    observerRef.current = new ResizeObserver((entries) => onResizeRef.current(entries))
  }

  onResizeRef.current = (entries) => {
    const element = scrollRef.current
    const index = indexRef.current
    if (!element || !index) return

    const wasAtBottom = isAtBottom(element)
    const scrollTop = element.scrollTop
    let scrollAdjustment = 0
    let changed = false
    const startedAt = performance.now()

    for (const entry of entries) {
      const node = entry.target as HTMLElement
      const i = Number(node.dataset.index) - indexFirstItem.current
      if (i < 0 || i >= index.size) continue

      const height = entry.borderBoxSize[0]?.blockSize ?? node.getBoundingClientRect().height
      const previous = index.get(i)
      if (height === previous) continue

      // The row starts above the viewport: its growth would push visible content down.
      // Shift scrollTop by the same delta — the user won't notice a thing.
      if (latest.current.anchoring && index.prefixSum(i) < scrollTop) {
        scrollAdjustment += height - previous
      }

      index.set(i, height)
      changed = true
    }

    if (!changed) return
    metrics.update.push(performance.now() - startedAt)

    syncSpacer(index)
    if (wasAtBottom) {
      element.scrollTop = element.scrollHeight
    } else if (scrollAdjustment !== 0) {
      element.scrollTop = scrollTop + scrollAdjustment
    }

    compute()
    rerender()
  }

  useEffect(() => {
    const observer = observerRef.current
    return () => observer?.disconnect()
  }, [])

  // React 19: a ref callback may return a cleanup function.
  const observeRow = useCallback((node: HTMLDivElement | null) => {
    const observer = observerRef.current
    if (!node || !observer) return
    observer.observe(node)
    return () => observer.unobserve(node)
  }, [])

  // Build from estimates: on mount and on width change. O(n).
  useLayoutEffect(() => {
    const element = scrollRef.current
    if (!element || !width) return

    const first = latest.current.firstItemIndex
    const wasInitial = indexRef.current === null
    const wasAtBottom = !wasInitial && isAtBottom(element)

    const values = new Float64Array(count)
    for (let i = 0; i < count; i++) values[i] = estimate(first + i)
    const index = createIndex(values)
    indexRef.current = index
    indexFirstItem.current = first

    // Rows already rendered are known exactly — don't wait for ResizeObserver.
    for (const child of contentRef.current?.children ?? []) {
      const node = child as HTMLElement
      const i = Number(node.dataset.index) - first
      if (i >= 0 && i < index.size) index.set(i, node.getBoundingClientRect().height)
    }

    syncSpacer(index)
    if (wasInitial || wasAtBottom) element.scrollTop = element.scrollHeight

    compute()
    rerender()
    // Rebuild on width only: the effects below handle everything else.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [width])

  // History loaded on top: firstItemIndex decreased by shift.
  useLayoutEffect(() => {
    const element = scrollRef.current
    const index = indexRef.current
    if (!element || !index) return

    const shift = indexFirstItem.current - firstItemIndex
    if (shift <= 0) return

    const next = index.prepend(shift, (i) => estimate(firstItemIndex + i))
    indexRef.current = next
    indexFirstItem.current = firstItemIndex

    syncSpacer(next)
    // Without anchoring scrollTop stays the same — and the freshly loaded
    // messages end up on screen.
    if (anchoring) element.scrollTop += next.prefixSum(shift)

    compute()
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [firstItemIndex])

  // The same delta added to every row height (compact mode).
  // O(log n) for the segment tree, a pass over all rows for the others.
  useLayoutEffect(() => {
    const element = scrollRef.current
    const index = indexRef.current
    const delta = heightAdjustment - appliedAdjustment.current
    appliedAdjustment.current = heightAdjustment
    if (!element || !index || delta === 0) return

    const wasAtBottom = isAtBottom(element)
    // The anchor is the first visible row: after the change it must stay
    // at the same place on screen.
    const anchor = index.lowerBound(element.scrollTop)
    const offsetInAnchor = element.scrollTop - index.prefixSum(anchor)

    const startedAt = performance.now()
    index.addRange(0, index.size, delta)
    metrics.bulkUpdateMs = performance.now() - startedAt

    syncSpacer(index)
    if (wasAtBottom) element.scrollTop = element.scrollHeight
    else if (anchoring) element.scrollTop = index.prefixSum(anchor) + offsetInAnchor

    compute()
    rerender()
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [heightAdjustment])

  useLayoutEffect(() => {
    if (frameStartedAt.current !== null) {
      metrics.commit.push(performance.now() - frameStartedAt.current)
      frameStartedAt.current = null
    }
  })

  const index = indexRef.current
  const rows = []
  let top = 0
  let total = 0

  if (index) {
    const end = Math.min(range.end, index.size)
    top = index.prefixSum(range.begin)
    total = index.total()

    for (let i = range.begin; i < end; i++) {
      const itemIndex = indexFirstItem.current + i
      rows.push(
        <div key={itemIndex} data-index={itemIndex} ref={observeRow}>
          {renderItem(itemIndex)}
        </div>,
      )
    }
  }

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto [overflow-anchor:none]">
      <div ref={spacerRef} className="relative" style={{ height: total }}>
        <div ref={contentRef} style={{ transform: `translate3d(0, ${top}px, 0)` }}>
          {rows}
        </div>
      </div>
    </div>
  )
}
