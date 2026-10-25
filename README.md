# Virtual list: O(n) → O(log n)

Companion demo for an article on virtual list performance.

A chat with up to 100,000 messages of varying height and five stages of a virtual list's evolution. Stages 1–4 are the same component; only the data structure that stores row heights changes:

| stage | height storage | window search | row measurement (`set`) | same change to all rows (`addRange`) |
|---|---|---|---|---|
| 0 | Map + estimate, two passes per frame | O(n) × 2 | O(1) | cache reset |
| 1 | `Float64Array` | O(n) | O(1) | O(n) |
| 2 | prefix sums | O(log n) | O(n) | O(n) |
| 3 | Fenwick tree | O(log n) | O(log n) | O(n log n) |
| 4 | segment tree with lazy propagation | O(log n) | O(log n) | O(log n) |

Stage 5 is "don't break scroll": anchoring when heights change, loading history on top, sticking to the bottom. Toggle it with a checkbox on stages 1–4.

## Getting started

Requires Node.js 22.12 or newer.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # height storage and window search tests
npm run lint
```

Use a production build for measurements:

```bash
npm run build
npm run preview  # http://localhost:4173
```

The stage and history size are kept in the URL: `?stage=0&n=100000` … `?stage=4&n=100000`.

## Things to try

1. **Feel the difference.** 100,000 messages, stage 0, scroll up with the mouse wheel. Then stages 1, 2, 3.
2. **Measure.** DevTools → Performance → CPU: 4× or 6× slowdown. Use "Scroll 5 s near end" and "near start" — results accumulate in a table. Stages 1 and 2 behave differently near the end and near the start of history.
3. **Isolate the data structures.** "Height storage microbenchmark" measures individual operations without React or the DOM.
4. **Compact mode.** Every row loses 12 px. Compare "Compact mode applied in …" on stages 3 and 4.
5. **Break the scroll.** Scroll up and click "Load 1,000 older messages on top", or toggle compact mode. On stage 0 the content jumps; on stages 1–4 it doesn't. Turn off "Scroll anchoring" and try again.
6. **Small n.** With 1,000 messages there is no difference between stages — and that's a finding too.

The "Metrics" panel shows window search time, time from the scroll event to the React commit and the time to apply `ResizeObserver` measurements, plus the visible rows with how much of each edge row is visible (what you need for read receipts).

## Structure

```
src/
  lib/
    heights/
      HeightIndex.ts        interface: get, set, addRange, prefixSum, lowerBound, total, prepend
      LinearHeights.ts      stage 1
      PrefixSumHeights.ts   stage 2
      FenwickTree.ts        stage 3
      SegmentTree.ts        stage 4
      stages.ts             stage descriptions
    visibleRange.ts         visible window search: naive and via HeightIndex
    messages.ts             deterministic chat history and height estimate
    throttleRaf.ts          per-frame throttling (and a common cancel bug)
    metrics.ts              ring buffers for metrics
    benchmark.ts            scroll runs and microbenchmark
  components/
    NaiveVirtualList.tsx    stage 0
    IndexedVirtualList.tsx  stages 1–4 (+ stage 5)
    MessageRow.tsx
    StatsPanel.tsx
  App.tsx
```

## Notes on measurements

- Dev and preview servers send COOP/COEP headers (`vite.config.ts`). This enables cross-origin isolation and raises `performance.now()` precision from ~100 µs to ~5 µs. If you host the build elsewhere, configure the same headers there (`Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp`); without them the demo still works, but sub-millisecond timings in the live metrics are rounded.
- 100,000 messages is about 10M px. Don't go higher: browsers cap element height (Chrome at about 33.5M px, Firefox at about 17.9M px) and silently clip the spacer.
