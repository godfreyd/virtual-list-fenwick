import { useEffect, useState } from 'react'
import { formatMs, formatStat, metrics, type SeriesStats, type VisibleInfo } from '../lib/metrics'

interface Snapshot {
  compute: SeriesStats
  commit: SeriesStats
  update: SeriesStats
  bulkUpdateMs: number | null
  visible: VisibleInfo | null
}

function takeSnapshot(): Snapshot {
  return {
    compute: metrics.compute.stats(),
    commit: metrics.commit.stats(),
    update: metrics.update.stats(),
    bulkUpdateMs: metrics.bulkUpdateMs,
    visible: metrics.visible,
  }
}

function Row({ label, hint, stats }: { label: string; hint: string; stats: SeriesStats }) {
  return (
    <tr className="border-t border-slate-200">
      <td className="py-1 pr-3">
        <div className="font-medium">{label}</div>
        <div className="text-xs text-slate-500">{hint}</div>
      </td>
      <td className="py-1 pr-3 tabular-nums">{formatStat(stats, stats.last)}</td>
      <td className="py-1 pr-3 tabular-nums">{formatStat(stats, stats.median)}</td>
      <td className="py-1 tabular-nums">{formatStat(stats, stats.p95)}</td>
    </tr>
  )
}

const percent = (fraction: number) => `${Math.round(fraction * 100)}%`

// Poll the metrics store 4 times per second — the list itself doesn't re-render App.
export function StatsPanel() {
  const [snapshot, setSnapshot] = useState(takeSnapshot)

  useEffect(() => {
    const timer = setInterval(() => setSnapshot(takeSnapshot()), 250)
    return () => clearInterval(timer)
  }, [])

  const { visible } = snapshot

  return (
    <div className="space-y-3 text-sm">
      <table className="w-full text-left">
        <thead className="text-xs text-slate-500">
          <tr>
            <th className="pb-1 font-normal">Operation</th>
            <th className="pb-1 font-normal">last</th>
            <th className="pb-1 font-normal">median</th>
            <th className="pb-1 font-normal">p95</th>
          </tr>
        </thead>
        <tbody>
          <Row label="Window search" hint="per scroll frame" stats={snapshot.compute} />
          <Row label="Until commit" hint="algorithm + render + DOM" stats={snapshot.commit} />
          <Row label="Height updates" hint="ResizeObserver measurements" stats={snapshot.update} />
        </tbody>
      </table>

      {snapshot.bulkUpdateMs !== null && (
        <div className="text-xs text-slate-600">
          Compact mode applied in {formatMs(snapshot.bulkUpdateMs)}
        </div>
      )}

      {visible && (
        <div className="rounded bg-slate-100 p-2 text-xs text-slate-600">
          Visible: #{visible.firstId} ({percent(visible.firstVisibleFraction)}) … #{visible.lastId} (
          {percent(visible.lastVisibleFraction)}), {visible.rendered} rows in DOM
        </div>
      )}
    </div>
  )
}
