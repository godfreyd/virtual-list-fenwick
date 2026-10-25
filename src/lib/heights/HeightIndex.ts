// Everything a virtual list needs from row height storage.
// Stages 1–4 of the article are different implementations of this one interface.
export interface HeightIndex {
  readonly size: number

  // Height of row i.
  get(index: number): number

  // Height of row i has changed (a ResizeObserver measurement arrived).
  set(index: number, value: number): void

  // Add delta to the heights of rows [from, to) — e.g. compact mode.
  addRange(from: number, to: number, delta: number): void

  // Sum of the first count heights = top of row count.
  prefixSum(count: number): number

  // The row containing pixel offset: top(i) <= offset < top(i + 1).
  lowerBound(offset: number): number

  total(): number

  // A new storage with count rows inserted at the start.
  prepend(count: number, valueAt: (index: number) => number): HeightIndex
}

export function prependValues(
  current: ArrayLike<number>,
  count: number,
  valueAt: (index: number) => number,
): Float64Array {
  const values = new Float64Array(current.length + count)
  for (let i = 0; i < count; i++) values[i] = valueAt(i)
  values.set(current, count)
  return values
}
