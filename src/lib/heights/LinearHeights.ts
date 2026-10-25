import { prependValues, type HeightIndex } from './HeightIndex'

// Stage 1. Heights live in a Float64Array, the total is maintained incrementally.
// The second full pass in render is gone, the Map and the height estimate left
// the hot loop — but window search is still linear.
//
//   get / set       O(1)
//   prefixSum(k)    O(k)
//   lowerBound      O(index of the found row)
//   total           O(1)
export class LinearHeights implements HeightIndex {
  readonly size: number
  private readonly values: Float64Array
  private sum = 0

  constructor(values: Float64Array) {
    this.size = values.length
    this.values = values
    for (let i = 0; i < this.size; i++) this.sum += values[i]
  }

  get(index: number): number {
    return this.values[index]
  }

  set(index: number, value: number): void {
    this.sum += value - this.values[index]
    this.values[index] = value
  }

  addRange(from: number, to: number, delta: number): void {
    for (let i = from; i < to; i++) this.values[i] += delta
    this.sum += delta * (to - from)
  }

  prefixSum(count: number): number {
    let sum = 0
    for (let i = 0; i < Math.min(count, this.size); i++) sum += this.values[i]
    return sum
  }

  lowerBound(offset: number): number {
    let top = 0
    for (let i = 0; i < this.size; i++) {
      top += this.values[i]
      if (offset < top) return i
    }
    return Math.max(this.size - 1, 0)
  }

  total(): number {
    return this.sum
  }

  prepend(count: number, valueAt: (index: number) => number): LinearHeights {
    return new LinearHeights(prependValues(this.values, count, valueAt))
  }
}
