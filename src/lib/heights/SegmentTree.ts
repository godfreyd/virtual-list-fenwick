import { prependValues, type HeightIndex } from './HeightIndex'

// Stage 4. Segment tree with deferred (lazy) operations.
//
// Node node covers the range [left, right] and stores the height sum sum[node].
// Its children are 2·node and 2·node + 1, the root is 1. A delta for a whole subtree
// isn't handed out to the leaves right away: it's recorded in pending[node] and
// "pushed" down only when we descend there.
//
//   get / set / prefixSum / lowerBound   O(log n)
//   addRange(from, to, delta)            O(log n) — what a Fenwick tree lacks
//
// The same technique lets nodes store min/max or support range
// assignment — e.g. "collapse a thread" = set heights to 0.
export class SegmentTree implements HeightIndex {
  readonly size: number
  private readonly sum: Float64Array
  // Delta for every leaf of the subtree. Already applied to sum[node],
  // not yet to the children.
  private readonly pending: Float64Array

  constructor(values: Float64Array) {
    this.size = values.length
    const capacity = 4 * Math.max(this.size, 1)
    this.sum = new Float64Array(capacity)
    this.pending = new Float64Array(capacity)
    if (this.size > 0) this.build(values, 1, 0, this.size - 1)
  }

  private build(values: Float64Array, node: number, left: number, right: number): void {
    if (left === right) {
      this.sum[node] = values[left]
      return
    }
    const mid = (left + right) >> 1
    this.build(values, 2 * node, left, mid)
    this.build(values, 2 * node + 1, mid + 1, right)
    this.sum[node] = this.sum[2 * node] + this.sum[2 * node + 1]
  }

  private apply(node: number, left: number, right: number, delta: number): void {
    this.sum[node] += delta * (right - left + 1)
    this.pending[node] += delta
  }

  private push(node: number, left: number, right: number): void {
    const delta = this.pending[node]
    if (delta === 0) return
    const mid = (left + right) >> 1
    this.apply(2 * node, left, mid, delta)
    this.apply(2 * node + 1, mid + 1, right, delta)
    this.pending[node] = 0
  }

  get(index: number): number {
    let node = 1
    let left = 0
    let right = this.size - 1
    while (left !== right) {
      this.push(node, left, right)
      const mid = (left + right) >> 1
      if (index <= mid) {
        node = 2 * node
        right = mid
      } else {
        node = 2 * node + 1
        left = mid + 1
      }
    }
    return this.sum[node]
  }

  // Descend to the leaf pushing deltas down, change it, and recompute
  // sums on the way back to the root.
  set(index: number, value: number): void {
    let node = 1
    let left = 0
    let right = this.size - 1
    while (left !== right) {
      this.push(node, left, right)
      const mid = (left + right) >> 1
      if (index <= mid) {
        node = 2 * node
        right = mid
      } else {
        node = 2 * node + 1
        left = mid + 1
      }
    }

    this.sum[node] = value
    for (node >>= 1; node >= 1; node >>= 1) this.sum[node] = this.sum[2 * node] + this.sum[2 * node + 1]
  }

  addRange(from: number, to: number, delta: number): void {
    if (from >= to || this.size === 0) return
    this.addRangeIn(1, 0, this.size - 1, from, to - 1, delta)
  }

  private addRangeIn(node: number, left: number, right: number, from: number, to: number, delta: number): void {
    if (right < from || left > to) return
    // The node's range is fully inside — record the delta and stop here.
    if (from <= left && right <= to) {
      this.apply(node, left, right, delta)
      return
    }
    this.push(node, left, right)
    const mid = (left + right) >> 1
    this.addRangeIn(2 * node, left, mid, from, to, delta)
    this.addRangeIn(2 * node + 1, mid + 1, right, from, to, delta)
    this.sum[node] = this.sum[2 * node] + this.sum[2 * node + 1]
  }

  // Walk to leaf count − 1; every time we turn right, take the whole sum
  // of the left subtree.
  prefixSum(count: number): number {
    if (count <= 0) return 0
    if (count >= this.size) return this.total()

    const target = count - 1
    let sum = 0
    let node = 1
    let left = 0
    let right = this.size - 1
    while (left !== right) {
      this.push(node, left, right)
      const mid = (left + right) >> 1
      if (target <= mid) {
        node = 2 * node
        right = mid
      } else {
        sum += this.sum[2 * node]
        node = 2 * node + 1
        left = mid + 1
      }
    }
    return sum + this.sum[node]
  }

  // Descend by sums: if offset is less than the left subtree sum, the row is
  // on the left; otherwise subtract that sum and go right.
  lowerBound(offset: number): number {
    if (this.size === 0) return 0
    if (offset >= this.total()) return this.size - 1

    let remaining = offset
    let node = 1
    let left = 0
    let right = this.size - 1
    while (left !== right) {
      this.push(node, left, right)
      const mid = (left + right) >> 1
      if (remaining < this.sum[2 * node]) {
        node = 2 * node
        right = mid
      } else {
        remaining -= this.sum[2 * node]
        node = 2 * node + 1
        left = mid + 1
      }
    }
    return left
  }

  total(): number {
    return this.size === 0 ? 0 : this.sum[1]
  }

  toArray(): Float64Array {
    const values = new Float64Array(this.size)
    const collect = (node: number, left: number, right: number) => {
      if (left === right) {
        values[left] = this.sum[node]
        return
      }
      this.push(node, left, right)
      const mid = (left + right) >> 1
      collect(2 * node, left, mid)
      collect(2 * node + 1, mid + 1, right)
    }
    if (this.size > 0) collect(1, 0, this.size - 1)
    return values
  }

  prepend(count: number, valueAt: (index: number) => number): SegmentTree {
    return new SegmentTree(prependValues(this.toArray(), count, valueAt))
  }
}
