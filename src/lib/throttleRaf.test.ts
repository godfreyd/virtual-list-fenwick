import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { throttleRaf } from './throttleRaf'

describe('throttleRaf', () => {
  let frames: Map<number, FrameRequestCallback>
  let nextId: number

  const flushFrame = () => {
    const pending = [...frames.values()]
    frames.clear()
    pending.forEach((callback) => callback(performance.now()))
  }

  beforeEach(() => {
    frames = new Map()
    nextId = 1
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.set(nextId, callback)
      return nextId++
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
  })

  afterEach(() => vi.unstubAllGlobals())

  it('calls the callback once per frame with the latest arguments', () => {
    const callback = vi.fn()
    const throttled = throttleRaf(callback)

    throttled(1)
    throttled(2)
    throttled(3)
    flushFrame()

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(3)
  })

  // Regression test for a common bug: after cancel() the function "dies".
  it('keeps working after cancel()', () => {
    const callback = vi.fn()
    const throttled = throttleRaf(callback)

    throttled()
    throttled.cancel()
    flushFrame()
    expect(callback).not.toHaveBeenCalled()

    throttled()
    flushFrame()
    expect(callback).toHaveBeenCalledTimes(1)
  })
})
