import { describe, expect, it } from 'vitest'
import { FenwickTree } from './heights/FenwickTree'
import { STAGES } from './heights/stages'
import { findVisibleRange, findVisibleRangeNaive } from './visibleRange'

describe('findVisibleRange', () => {
  it.each(STAGES.filter((stage) => stage.createIndex))('$title gives the same answer as stage 0', ({ createIndex }) => {
    let seed = 7
    const next = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return seed / 2 ** 32
    }

    for (const size of [1, 3, 50, 2000]) {
      const heights = Array.from({ length: size }, () => 30 + Math.floor(next() * 200))
      const index = createIndex!(Float64Array.from(heights))
      const total = index.total()

      for (let i = 0; i < 200; i++) {
        const viewport = 200 + Math.floor(next() * 800)
        const scrollTop = Math.floor(next() * Math.max(total - viewport, 0))

        const naive = findVisibleRangeNaive(size, (row) => heights[row], scrollTop, viewport)
        expect(findVisibleRange(index, scrollTop, viewport), `size=${size} scrollTop=${scrollTop}`).toEqual(naive)
      }
    }
  })

  it('a row that starts exactly at the bottom edge is not visible', () => {
    const index = new FenwickTree(Float64Array.from([100, 100, 100]))
    const range = findVisibleRange(index, 0, 200)
    expect(range.first).toBe(0)
    expect(range.last).toBe(1)
    expect(range.lastVisibleFraction).toBe(1)
  })
})
