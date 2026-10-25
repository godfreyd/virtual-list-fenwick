import { FenwickTree } from './FenwickTree'
import type { HeightIndex } from './HeightIndex'
import { LinearHeights } from './LinearHeights'
import { PrefixSumHeights } from './PrefixSumHeights'
import { SegmentTree } from './SegmentTree'

export type StageId = 0 | 1 | 2 | 3 | 4

export interface Stage {
  id: StageId
  title: string
  query: string
  update: string
  addRange: string
  // Stage 0 has no storage of its own — it is a separate component.
  createIndex?: (values: Float64Array) => HeightIndex
}

export const STAGES: Stage[] = [
  { id: 0, title: 'Naive list', query: 'O(n) × 2', update: 'O(1)', addRange: 'O(n)' },
  {
    id: 1,
    title: 'Height array',
    query: 'O(n)',
    update: 'O(1)',
    addRange: 'O(k)',
    createIndex: (values) => new LinearHeights(values),
  },
  {
    id: 2,
    title: 'Prefix sums',
    query: 'O(log n)',
    update: 'O(n)',
    addRange: 'O(n)',
    createIndex: (values) => new PrefixSumHeights(values),
  },
  {
    id: 3,
    title: 'Fenwick tree',
    query: 'O(log n)',
    update: 'O(log n)',
    addRange: 'O(k log n)',
    createIndex: (values) => new FenwickTree(values),
  },
  {
    id: 4,
    title: 'Segment tree',
    query: 'O(log n)',
    update: 'O(log n)',
    addRange: 'O(log n)',
    createIndex: (values) => new SegmentTree(values),
  },
]
