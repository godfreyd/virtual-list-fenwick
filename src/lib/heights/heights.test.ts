import { describe, expect, it } from 'vitest'
import { STAGES } from './stages'

// A simple deterministic PRNG so failures are reproducible.
function random(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 2 ** 32
  }
}

// Reference: a plain array and linear passes.
function prefix(values: number[], count: number): number {
  let sum = 0
  for (let i = 0; i < Math.min(count, values.length); i++) sum += values[i]
  return sum
}

function lowerBound(values: number[], offset: number): number {
  let top = 0
  for (let i = 0; i < values.length; i++) {
    if (offset < top + values[i]) return i
    top += values[i]
  }
  return values.length - 1
}

const implementations = STAGES.filter((stage) => stage.createIndex)

describe.each(implementations)('$title', ({ createIndex }) => {
  const create = (values: number[]) => createIndex!(Float64Array.from(values))

  // Integer heights: sums in the structure and in the reference match exactly.
  it('matches the reference on a random sequence of operations', () => {
    const next = random(42)
    for (const size of [1, 2, 3, 7, 8, 9, 100, 777]) {
      const values = Array.from({ length: size }, () => 20 + Math.floor(next() * 300))
      const index = create(values)

      for (let step = 0; step < 300; step++) {
        const op = next()
        if (op < 0.4) {
          const i = Math.floor(next() * size)
          values[i] = 20 + Math.floor(next() * 300)
          index.set(i, values[i])
        } else if (op < 0.55) {
          const from = Math.floor(next() * size)
          const to = from + Math.floor(next() * (size - from + 1))
          const delta = Math.floor(next() * 21) - 10
          for (let i = from; i < to; i++) values[i] += delta
          index.addRange(from, to, delta)
        }

        const count = Math.floor(next() * (size + 1))
        expect(index.prefixSum(count)).toBe(prefix(values, count))

        const i = Math.floor(next() * size)
        expect(index.get(i)).toBe(values[i])

        const total = prefix(values, size)
        expect(index.total()).toBe(total)

        // A random point and an exact row boundary are the trickiest cases.
        const boundary = prefix(values, Math.floor(next() * size))
        for (const offset of [next() * total, boundary, Math.max(boundary - 1, 0), total, total + 50]) {
          expect(index.lowerBound(offset), `size=${size} offset=${offset}`).toBe(lowerBound(values, offset))
        }
      }
    }
  })

  it('prepend keeps old values and shifts indices', () => {
    const index = create([10, 20, 30])
    index.addRange(0, 3, 1)
    const next = index.prepend(2, (i) => [1, 2][i])

    expect(next.size).toBe(5)
    expect([0, 1, 2, 3, 4].map((i) => next.get(i))).toEqual([1, 2, 11, 21, 31])
    expect(next.prefixSum(2)).toBe(3)
    expect(next.total()).toBe(66)
  })

  it('empty storage', () => {
    const index = create([])
    expect(index.total()).toBe(0)
    expect(index.lowerBound(100)).toBe(0)
    expect(index.prefixSum(5)).toBe(0)
  })
})
