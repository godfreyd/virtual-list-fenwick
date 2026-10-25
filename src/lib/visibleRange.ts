import type { HeightIndex } from './heights/HeightIndex'

// The visible part of the list. Indices are inclusive; fractions tell how much
// of each edge row is inside the viewport (needed e.g. for read receipts).
export interface VisibleRange {
  first: number
  last: number
  firstVisibleFraction: number
  lastVisibleFraction: number
}

const EMPTY: VisibleRange = { first: 0, last: -1, firstVisibleFraction: 0, lastVisibleFraction: 0 }

// Naive search, as in most hand-rolled lists: start from zero and
// accumulate heights until reaching the bottom edge of the viewport.
// Cost — O(index of the last visible row). In a chat the user is almost
// always at the bottom, i.e. the worst case: O(n) per scroll frame.
export function findVisibleRangeNaive(
  count: number,
  heightAt: (index: number) => number,
  scrollTop: number,
  viewportHeight: number,
): VisibleRange {
  if (count === 0) return EMPTY

  const bottom = scrollTop + viewportHeight
  let first = 0
  let firstVisibleFraction = 1
  let offset = 0

  for (let i = 0; i < count; i++) {
    const height = heightAt(i)
    const rowTop = offset
    offset += height

    if (rowTop <= scrollTop && offset > scrollTop) {
      first = i
      firstVisibleFraction = (offset - scrollTop) / height
    }

    if (offset >= bottom) {
      return { first, last: i, firstVisibleFraction, lastVisibleFraction: Math.min((bottom - rowTop) / height, 1) }
    }
  }

  return { first, last: count - 1, firstVisibleFraction, lastVisibleFraction: 1 }
}

// Search via the height storage: two lowerBound calls and a couple of prefixSum.
// The cost is entirely defined by the implementation: from O(n) to O(log n).
export function findVisibleRange(tree: HeightIndex, scrollTop: number, viewportHeight: number): VisibleRange {
  if (tree.size === 0) return EMPTY

  const bottom = scrollTop + viewportHeight
  const first = tree.lowerBound(scrollTop)
  let last = tree.lowerBound(bottom)

  // A row that starts exactly at the bottom edge is not visible.
  if (last > first && tree.prefixSum(last) >= bottom) last--

  const firstTop = tree.prefixSum(first)
  const firstHeight = tree.get(first)
  const lastTop = tree.prefixSum(last)
  const lastHeight = tree.get(last)

  return {
    first,
    last,
    firstVisibleFraction: (firstTop + firstHeight - scrollTop) / firstHeight,
    lastVisibleFraction: Math.min((bottom - lastTop) / lastHeight, 1),
  }
}
