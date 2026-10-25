// At most one call per frame.
//
// A common mistake is two sources of truth: a `ticking` flag and the frame `id`,
// where `cancel()` resets only the frame. After a cancel the flag stays true
// forever, and the function is never called again. Here there is one piece of state: the id.
export interface ThrottledRaf<A extends unknown[]> {
  (...args: A): void
  cancel(): void
}

export function throttleRaf<A extends unknown[]>(callback: (...args: A) => void): ThrottledRaf<A> {
  let frameId: number | null = null
  let lastArgs: A

  const throttled = (...args: A) => {
    lastArgs = args
    if (frameId !== null) return

    frameId = requestAnimationFrame(() => {
      frameId = null
      callback(...lastArgs)
    })
  }

  throttled.cancel = () => {
    if (frameId === null) return
    cancelAnimationFrame(frameId)
    frameId = null
  }

  return throttled
}
