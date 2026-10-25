import { useRef, useState } from 'react'
import { IndexedVirtualList } from './components/IndexedVirtualList'
import { MessageRow } from './components/MessageRow'
import { NaiveVirtualList } from './components/NaiveVirtualList'
import { StatsPanel } from './components/StatsPanel'
import {
  runMicroBenchmark,
  runScrollBenchmark,
  type MicroRow,
  type ScrollRunResult,
  type ScrollScenario,
} from './lib/benchmark'
import { STAGES, type StageId } from './lib/heights/stages'
import { estimateMessageHeight, LAYOUT } from './lib/messages'
import { formatMs, formatStat } from './lib/metrics'

// 100,000 messages is a realistic ceiling for a single chat history.
// It's also ~10M px — within the element height limit of every browser.
const SIZES = [1_000, 10_000, 100_000]
// Absolute index of the first message. The headroom lets us load history upwards.
const BASE_INDEX = 10_000_000
const PREPEND_BATCH = 1_000

interface RunRecord extends ScrollRunResult {
  stage: StageId
  size: number
}

// State lives in the URL so the article can link to a specific stage.
function readInitialState(): { stage: StageId; size: number } {
  const params = new URLSearchParams(location.search)
  const stage = Number(params.get('stage'))
  const size = Number(params.get('n'))
  return {
    stage: (STAGES.some((s) => s.id === stage) ? stage : 0) as StageId,
    size: SIZES.includes(size) ? size : 100_000,
  }
}

function writeState(stage: StageId, size: number) {
  history.replaceState(null, '', `?stage=${stage}&n=${size}`)
}

const formatUs = (us: number) => (Number.isNaN(us) ? '—' : formatMs(us / 1000))

const SCENARIO_LABEL: Record<ScrollScenario, string> = {
  end: 'near end ↑',
  start: 'near start ↓',
}

export default function App() {
  const [initial] = useState(readInitialState)
  const [stageId, setStageId] = useState<StageId>(initial.stage)
  const [size, setSize] = useState(initial.size)
  const [prepended, setPrepended] = useState(0)
  const [anchoring, setAnchoring] = useState(true)
  const [compact, setCompact] = useState(false)
  const [running, setRunning] = useState(false)
  const [runs, setRuns] = useState<RunRecord[]>([])
  const [micro, setMicro] = useState<{ size: number; rows: MicroRow[] } | null>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)

  const stage = STAGES[stageId]

  const changeStage = (next: StageId) => {
    setStageId(next)
    setPrepended(0)
    writeState(next, size)
  }

  const changeSize = (next: number) => {
    setSize(next)
    setPrepended(0)
    writeState(stageId, next)
  }

  const runScroll = async (scenario: ScrollScenario) => {
    const scroller = scrollerRef.current
    if (!scroller) return
    setRunning(true)
    const result = await runScrollBenchmark(scroller, scenario)
    setRuns((prev) => [{ ...result, stage: stageId, size }, ...prev].slice(0, 12))
    setRunning(false)
  }

  const runMicro = () => {
    const scroller = scrollerRef.current
    if (!scroller) return
    setRunning(true)
    // Let the browser paint the "busy" state before the synchronous measurement.
    setTimeout(() => {
      setMicro({ size, rows: runMicroBenchmark(size, scroller.clientWidth, scroller.clientHeight) })
      setRunning(false)
    }, 50)
  }

  const listProps = {
    firstItemIndex: BASE_INDEX - prepended,
    count: size + prepended,
    estimateHeight: estimateMessageHeight,
    renderItem: (index: number) => <MessageRow id={index} compact={compact} />,
    anchoring,
    heightAdjustment: compact ? -LAYOUT.timeLine : 0,
    scrollerRef,
  }

  return (
    <div className="flex h-full flex-col bg-slate-50 text-slate-900 lg:flex-row">
      <aside className="w-full shrink-0 space-y-5 overflow-y-auto border-slate-200 bg-white p-4 lg:w-[440px] lg:border-r">
        <div>
          <h1 className="text-lg font-semibold">Virtual list: O(n) → O(log n)</h1>
          <p className="mt-1 text-sm text-slate-600">
            Switch stages and scroll the chat. For fair numbers, enable CPU throttling 4×–6× in DevTools.
          </p>
        </div>

        <section className="space-y-2">
          <div className="text-xs font-medium text-slate-500 uppercase">Stage</div>
          <div className="space-y-1">
            {STAGES.map((item) => (
              <button
                key={item.id}
                onClick={() => changeStage(item.id)}
                className={`flex w-full items-center justify-between rounded border px-3 py-2 text-left text-sm ${
                  stageId === item.id ? 'border-sky-600 bg-sky-600 text-white' : 'border-slate-300 hover:bg-slate-100'
                }`}
              >
                <span>
                  {item.id}. {item.title}
                </span>
                <span className={`text-xs tabular-nums ${stageId === item.id ? 'text-sky-100' : 'text-slate-500'}`}>
                  window {item.query} · measure {item.update}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <div className="text-xs font-medium text-slate-500 uppercase">Messages in history</div>
          <div className="flex gap-2">
            {SIZES.map((value) => (
              <button
                key={value}
                onClick={() => changeSize(value)}
                className={`flex-1 rounded border px-2 py-1 text-sm tabular-nums ${
                  size === value ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-300 hover:bg-slate-100'
                }`}
              >
                {value.toLocaleString('en-US')}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <div className="text-xs font-medium text-slate-500 uppercase">Height changes</div>
          <button
            onClick={() => setPrepended((value) => value + PREPEND_BATCH)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100"
          >
            Load {PREPEND_BATCH.toLocaleString('en-US')} older messages on top
          </button>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={compact} onChange={(event) => setCompact(event.target.checked)} />
            Compact mode (−{LAYOUT.timeLine} px per row, addRange {stage.addRange})
          </label>
          <label className={`flex items-center gap-2 text-sm ${stageId === 0 ? 'opacity-40' : ''}`}>
            <input
              type="checkbox"
              checked={anchoring}
              disabled={stageId === 0}
              onChange={(event) => setAnchoring(event.target.checked)}
            />
            Scroll anchoring (stage 5)
          </label>
        </section>

        <section className="space-y-2">
          <div className="text-xs font-medium text-slate-500 uppercase">Metrics</div>
          <StatsPanel />
        </section>

        <section className="space-y-2">
          <div className="text-xs font-medium text-slate-500 uppercase">Benchmarks</div>
          <div className="flex gap-2">
            {(['end', 'start'] as const).map((scenario) => (
              <button
                key={scenario}
                disabled={running}
                onClick={() => runScroll(scenario)}
                className="flex-1 rounded bg-slate-800 px-2 py-2 text-sm text-white disabled:opacity-50"
              >
                Scroll 5 s {SCENARIO_LABEL[scenario]}
              </button>
            ))}
          </div>
          <button
            disabled={running}
            onClick={runMicro}
            className="w-full rounded border border-slate-800 px-3 py-2 text-sm disabled:opacity-50"
          >
            Height storage microbenchmark
          </button>

          {runs.length > 0 && (
            <table className="w-full text-left text-xs tabular-nums">
              <thead className="text-slate-500">
                <tr>
                  <th className="font-normal">stage</th>
                  <th className="font-normal">n</th>
                  <th className="font-normal">where</th>
                  <th className="font-normal">frame p95</th>
                  <th className="font-normal">long</th>
                  <th className="font-normal">commit p95</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run, i) => (
                  <tr key={i} className="border-t border-slate-200">
                    <td>{run.stage}</td>
                    <td>{run.size.toLocaleString('en-US')}</td>
                    <td>{SCENARIO_LABEL[run.scenario]}</td>
                    <td>{formatMs(run.frames.p95)}</td>
                    <td>
                      {run.longFrames}/{run.frames.count}
                    </td>
                    <td>{formatStat(run.commit, run.commit.p95)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {micro && (
            <div className="space-y-1">
              <div className="text-xs text-slate-500">
                Time per operation, n = {micro.size.toLocaleString('en-US')}
              </div>
              <table className="w-full text-left text-xs tabular-nums">
                <thead className="text-slate-500">
                  <tr>
                    <th className="font-normal">storage</th>
                    <th className="font-normal">window, end</th>
                    <th className="font-normal">set, start</th>
                    <th className="font-normal">addRange</th>
                    <th className="font-normal">build</th>
                  </tr>
                </thead>
                <tbody>
                  {micro.rows.map((row) => (
                    <tr key={row.title} className="border-t border-slate-200">
                      <td>{row.title}</td>
                      <td>{formatUs(row.queryEndUs)}</td>
                      <td>{formatUs(row.updateStartUs)}</td>
                      <td>{formatUs(row.addAllUs)}</td>
                      <td>{formatUs(row.buildUs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </aside>

      <main className="min-h-0 flex-1 bg-slate-100">
        {stage.createIndex ? (
          <IndexedVirtualList key={`${stageId}-${size}`} createIndex={stage.createIndex} {...listProps} />
        ) : (
          <NaiveVirtualList key={`${stageId}-${size}`} {...listProps} />
        )}
      </main>
    </div>
  )
}
