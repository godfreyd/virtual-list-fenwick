// A deterministic "chat history". Messages aren't stored in memory —
// every field is derived from the id. So a million messages cost nothing,
// and every reader gets exactly the same history.

export interface Message {
  id: number
  author: string
  isOwn: boolean
  text: string
  quote: string | null
  hasImage: boolean
  time: string
}

const AUTHORS = ['You', 'Anna', 'Ben', 'Kate', 'Leo']

const PHRASES = [
  'Hi!',
  'Ok',
  "Sure, let's do it",
  'Looking now',
  'Are we still on for the 3 pm call?',
  'I shipped the fix, please check it on staging.',
  'Left a review, just a couple of naming nits.',
  'Looks like the test is flaky only in CI, everything is green locally.',
  "Let's move it to tomorrow, I won't make it today.",
  'Send me the dashboard link, I want to check p95 after the release.',
  'We hit the database connection limit, a pool of 20 is clearly not enough.',
  'If we cache by userId, a user will see stale permissions after a role change, so we need a version in the key.',
  'I would not pull in another library for a single function, it is easier to write twenty lines and cover them with tests.',
  'Checked the profile: half of the frame time goes to recomputing heights, and for the whole list, not just the visible part.',
  'Folks, a reminder that the release freeze starts on Friday. Everything that should go into this release must be merged by Thursday noon.',
  'Did you check the logs?',
  'Got it, thanks 🙌',
  'Cannot reproduce',
  "It's a feature, not a bug 😄",
  'There is a race: the response to the old request arrives after the new one and overwrites the state.',
  "Let's file a separate ticket and not block the release on this.",
  'On iOS, momentum scrolling stops if you write to scrollTop while it is scrolling.',
  'Can I work from home today?',
  'Pushed to the branch, the build is running.',
  'The build failed on the linter, fixing it now.',
  'Updated the docs, the link is in the PR description.',
  'We need a before and after benchmark, otherwise it is all just talk.',
  'Meh…',
  'Great job, thanks to everyone who joined the incident last night! We will put the postmortem together on Monday.',
  'Question: why do we compute the full list height on every render?',
]

const QUOTES = [
  'Are we still on for the 3 pm call?',
  'Checked the profile: half of the frame time goes to recomputing heights',
  'The build failed on the linter',
  'We need a before and after benchmark',
  "It's a feature, not a bug",
]

// Fast integer hash (a lowbias32 variant). Produces "random" but
// reproducible values for every id.
function mix(x: number): number {
  x ^= x >>> 16
  x = Math.imul(x, 0x7feb352d)
  x ^= x >>> 15
  x = Math.imul(x, 0x846ca68b)
  x ^= x >>> 16
  return x >>> 0
}

function rand(id: number, salt: number): number {
  return mix(id ^ Math.imul(salt + 1, 0x9e3779b1))
}

function phraseCount(id: number): number {
  const r = rand(id, 1) % 100
  if (r < 60) return 1
  if (r < 85) return 2
  if (r < 95) return 4
  return 9
}

function phraseAt(id: number, k: number): string {
  return PHRASES[rand(id, 10 + k) % PHRASES.length]
}

function authorIndex(id: number): number {
  return rand(id, 2) % 3 === 0 ? 0 : 1 + (rand(id, 3) % (AUTHORS.length - 1))
}

function hasImage(id: number): boolean {
  return rand(id, 4) % 100 < 7
}

function quoteOf(id: number): string | null {
  return rand(id, 5) % 100 < 10 ? QUOTES[rand(id, 6) % QUOTES.length] : null
}

function textLength(id: number): number {
  const count = phraseCount(id)
  let length = count - 1 // spaces between phrases
  for (let k = 0; k < count; k++) length += phraseAt(id, k).length
  return length
}

export function getMessage(id: number): Message {
  const count = phraseCount(id)
  const parts: string[] = []
  for (let k = 0; k < count; k++) parts.push(phraseAt(id, k))

  const author = authorIndex(id)
  const minutes = (id * 3) % (24 * 60)

  return {
    id,
    author: AUTHORS[author],
    isOwn: author === 0,
    text: parts.join(' '),
    quote: quoteOf(id),
    hasImage: hasImage(id),
    time: `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`,
  }
}

// Sizes from the MessageRow markup (Tailwind classes noted alongside).
export const LAYOUT = {
  rowPadding: 8, // py-1
  bubblePadding: 16, // py-2
  bubbleInnerX: 24, // px-3
  bubbleMaxWidth: 520,
  bubbleMaxShare: 0.75,
  authorLine: 16, // h-4
  quoteBlock: 20, // mt-1 + h-4
  imageBlock: 180, // mt-1 + h-44
  textLine: 20, // leading-5
  timeLine: 12, // leading-3
  avgCharWidth: 6.8, // text-sm, Latin text — a rough estimate
}

// Height estimate without the DOM. Deliberately imprecise: real heights are
// known only after render, and the list has to live with that.
export function estimateMessageHeight(id: number, containerWidth: number): number {
  const bubbleWidth = Math.min(containerWidth * LAYOUT.bubbleMaxShare, LAYOUT.bubbleMaxWidth)
  const textWidth = Math.max(bubbleWidth - LAYOUT.bubbleInnerX, 50)
  const charsPerLine = Math.max(Math.floor(textWidth / LAYOUT.avgCharWidth), 1)
  const lines = Math.ceil(textLength(id) / charsPerLine)

  let height = LAYOUT.rowPadding + LAYOUT.bubblePadding + lines * LAYOUT.textLine + LAYOUT.timeLine
  if (authorIndex(id) !== 0) height += LAYOUT.authorLine
  if (quoteOf(id) !== null) height += LAYOUT.quoteBlock
  if (hasImage(id)) height += LAYOUT.imageBlock

  return height
}
