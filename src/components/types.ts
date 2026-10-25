import type { ReactNode, RefObject } from 'react'

// Shared interface for all stages — App switches them without changing props.
//
// Rows are addressed by absolute index (here it is also the message id).
// Loading history on top means firstItemIndex decreases and count grows,
// like `firstItemIndex` in react-virtuoso.
export interface VirtualListProps {
  firstItemIndex: number
  count: number
  estimateHeight(index: number, containerWidth: number): number
  renderItem(index: number): ReactNode
  overscan?: number
  // Compensate height changes above the viewport (stage 5; stage 0 doesn't have it).
  anchoring?: boolean
  // Delta added to every row height — compact mode.
  heightAdjustment?: number
  scrollerRef?: RefObject<HTMLDivElement | null>
}
