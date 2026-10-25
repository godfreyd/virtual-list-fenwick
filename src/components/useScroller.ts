import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { throttleRaf } from '../lib/throttleRaf'

// Container width: line wrapping, and therefore heights, depend on it.
export function useElementWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return

    setWidth(element.clientWidth)
    const observer = new ResizeObserver(() => setWidth(element.clientWidth))
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])

  return width
}

// Recompute at most once per frame. The callback is read from a ref so the
// subscription isn't recreated on every render.
export function useScrollFrame(ref: RefObject<HTMLElement | null>, onFrame: () => void): void {
  const callbackRef = useRef(onFrame)
  useLayoutEffect(() => {
    callbackRef.current = onFrame
  })

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const handle = throttleRaf(() => callbackRef.current())
    element.addEventListener('scroll', handle, { passive: true })
    return () => {
      element.removeEventListener('scroll', handle)
      handle.cancel()
    }
  }, [ref])
}
