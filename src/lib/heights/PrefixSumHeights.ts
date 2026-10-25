import { prependValues, type HeightIndex } from './HeightIndex'

// Stage 2. Prefix sum array: prefix[k] = sum of the first k heights.
// Queries became cheap, but changing a single height shifts every
// prefix to its right.
//
//   prefixSum(k)    O(1)
//   lowerBound      O(log n) — binary search over prefix
//   set(i)          O(n − i)
export class PrefixSumHeights implements HeightIndex {
  readonly size: number
  private readonly values: Float64Array
  private readonly prefix: Float64Array

  constructor(values: Float64Array) {
    this.size = values.length
    this.values = values
    this.prefix = new Float64Array(this.size + 1)
    this.rebuildFrom(0)
  }

  private rebuildFrom(index: number): void {
    for (let i = index; i < this.size; i++) this.prefix[i + 1] = this.prefix[i] + this.values[i]
  }

  get(index: number): number {
    return this.values[index]
  }

  set(index: number, value: number): void {
    const delta = value - this.values[index]
    if (delta === 0) return
    this.values[index] = value
    for (let i = index + 1; i <= this.size; i++) this.prefix[i] += delta
  }

  addRange(from: number, to: number, delta: number): void {
    for (let i = from; i < to; i++) this.values[i] += delta
    this.rebuildFrom(from)
  }

  prefixSum(count: number): number {
    return this.prefix[Math.min(Math.max(count, 0), this.size)]
  }

  // Find the largest k with prefix[k] <= offset: that many rows lie entirely
  // above offset, so offset falls into row k.
  lowerBound(offset: number): number {
    let low = 0
    let high = this.size
    while (low < high) {
      const mid = (low + high + 1) >> 1
      if (this.prefix[mid] <= offset) low = mid
      else high = mid - 1
    }
    return Math.min(low, Math.max(this.size - 1, 0))
  }

  total(): number {
    return this.prefix[this.size]
  }

  prepend(count: number, valueAt: (index: number) => number): PrefixSumHeights {
    return new PrefixSumHeights(prependValues(this.values, count, valueAt))
  }
}
