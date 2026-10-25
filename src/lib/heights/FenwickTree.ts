import { prependValues, type HeightIndex } from './HeightIndex'

// Stage 3. Fenwick tree (Binary Indexed Tree).
//
// tree[i] (1-based) stores the sum of the range values[i - lowbit(i), i), where
// lowbit(i) = i & -i. Any prefix splits into O(log n) such ranges,
// and any element belongs to O(log n) ranges.
//
//   prefixSum(k)    O(log n)
//   set(i)          O(log n)
//   lowerBound      O(log n) — descent by powers of two
//   addRange        O(k · log n) — element by element (there is a two-tree trick,
//                   but range assignment is beyond a Fenwick tree)
export class FenwickTree implements HeightIndex {
  readonly size: number
  private readonly values: Float64Array
  private readonly tree: Float64Array
  private readonly topStep: number

  // O(n) build: every node passes its sum to exactly one parent.
  constructor(values: Float64Array) {
    this.size = values.length
    this.values = values
    this.tree = new Float64Array(this.size + 1)

    for (let i = 1; i <= this.size; i++) {
      this.tree[i] += values[i - 1]
      const parent = i + (i & -i)
      if (parent <= this.size) this.tree[parent] += this.tree[i]
    }

    let step = 1
    while (step * 2 <= this.size) step *= 2
    this.topStep = this.size === 0 ? 0 : step
  }

  get(index: number): number {
    return this.values[index]
  }

  set(index: number, value: number): void {
    const delta = value - this.values[index]
    if (delta === 0) return
    this.values[index] = value
    for (let i = index + 1; i <= this.size; i += i & -i) this.tree[i] += delta
  }

  addRange(from: number, to: number, delta: number): void {
    for (let i = from; i < to; i++) this.set(i, this.values[i] + delta)
  }

  prefixSum(count: number): number {
    let sum = 0
    for (let i = Math.min(count, this.size); i > 0; i -= i & -i) sum += this.tree[i]
    return sum
  }

  total(): number {
    return this.prefixSum(this.size)
  }

  // A single top-down pass rather than a binary search over prefixSum
  // (that would be O(log² n)).
  lowerBound(offset: number): number {
    if (this.size === 0) return 0

    let position = 0
    let remaining = offset
    for (let step = this.topStep; step > 0; step >>= 1) {
      const next = position + step
      if (next <= this.size && this.tree[next] <= remaining) {
        position = next
        remaining -= this.tree[next]
      }
    }

    // position = how many rows fit entirely above offset.
    return Math.min(position, this.size - 1)
  }

  // A Fenwick tree can't shift indices, so we rebuild in O(n) —
  // but once per batch, not per frame.
  prepend(count: number, valueAt: (index: number) => number): FenwickTree {
    return new FenwickTree(prependValues(this.values, count, valueAt))
  }
}
