import { useLayoutEffect, useState } from 'react'

interface Props {
  onClose: () => void
}

interface Step {
  icon: string
  title: string
  /** where this lives on the page */
  where: string
  /** CSS selector of the section to spotlight */
  target: string
  body: string[]
}

const STEPS: Step[] = [
  {
    icon: '🗺️',
    title: 'What this site does',
    where: 'The whole page, left to right: Library → Board → Strategies',
    target: 'main',
    body: [
      'The Voyage board takes 9 charts. Where each chart sits decides what its modifiers touch - adjacent bonuses shoot into neighbouring squares, border rolls only pay out on the tiles they touch, and connectors have to line up or the voyage will not run.',
      'This site keeps your chart collection, knows the real placement rules, and finds the best runnable board for you - either with your own priorities or with a curated community strategy.',
    ],
  },
  {
    icon: '📥',
    title: 'Get your charts in',
    where: 'Chart Library (left column) and the Import panel below it',
    target: '.library-col',
    body: [
      'Ctrl+C a chart in game, then Ctrl+V anywhere on this page. It imports instantly - name, level, modifiers, shape, everything - and re-pasting a chart you already imported is skipped automatically.',
      'Big library? The optional chart collector (Import panel) counts your own Ctrl+C copies with an on-screen tally and imports them all in one paste - it sends zero inputs to the game. Works with English and Korean clients.',
      'Rare charts trigger a golden alert so you know Divine fuel arrived.',
    ],
  },
  {
    icon: '🧭',
    title: 'Enter your borders',
    where: 'The board (middle) - the small slots around its edge',
    target: '.board-grid',
    body: [
      'Border modifiers (Corruption Currents) only affect the tiles they touch, so the solver needs to know them.',
      'Click any border slot and search for the modifier. Corners touch 2 tiles, edges 1 - all 12 take about a minute.',
      'Faster: with the collector running (Import panel), hold Alt in game and press F8 - all 12 tooltips are read from a screenshot with local OCR and pasted in one go. Zero inputs to the game.',
      'Watch for the jackpot: a "+1 Divine Orb per Rare Monster" border turns a rares board into a money printer - the site flags it loudly when you enter one.',
    ],
  },
  {
    icon: '⚑',
    title: 'Pick a strategy (or go manual)',
    where: 'Strategies (right column)',
    target: '.strategies',
    body: [
      'Curated community builds: Alc & Go for burning spares, Speedrun Strongboxes as the daily farm, Meatfish and Magic Ethereal as the juiced boards, and two Divine-border jackpot builds.',
      'Each card shows the guide, the in-game rolling regexes, and whether you actually have the pieces - if not, it tells you what is missing and what to run in the meantime.',
      'Prefer your own priorities? Stay on "None (manual)" and set per-reward weights in Solver Settings.',
    ],
  },
  {
    icon: '🔖',
    title: 'Bank your keeper charts',
    where: 'Chart Library → "Save charts for strategies…"',
    target: '.savefor-bar',
    body: [
      'The keep-count wizard walks each strategy\'s recommended chart types with a "keep X" stepper - the solver banks your best X of each and spends everything beyond that.',
      'Banked charts wear a 🔒 naming their strategy, never get burned by other solves or filler voyages, and are always available when their own strategy runs.',
      'Defaults match what each strategy actually needs, so you can skip this entirely and it just works.',
    ],
  },
  {
    icon: '⚙',
    title: 'Solve',
    where: 'The big gold button under the board',
    target: '.solve-bar',
    body: [
      'Press Solve. The best runnable board loads instantly; four alternatives sit beside it as cards - click any to load it.',
      'Every suggestion obeys the real rules: connectors match, all 9 squares filled, everything reachable from the ⚓ start.',
      'The ⚙ Settings button beside it holds connector rules, reward weights, protections and the filler-voyage builder (a throwaway board from your worst spares).',
    ],
  },
  {
    icon: '📋',
    title: 'Copy it into the game',
    where: '"Copy into game" under the results',
    target: '.voyage-finish',
    body: [
      'The game fills the board bottom-left first - this walks your board in exactly that order.',
      'Each step copies an in-game search string for the right chart: paste it in your chart inventory, Ctrl+click the chart it highlights, press Ctrl+C here to advance. Nine charts, no mistakes.',
      'Lock a chart to a square first? Mark it 🔒 preserved on the tile and every future solve pins it exactly there.',
    ],
  },
  {
    icon: '🌊',
    title: 'Run it, finish it, repeat',
    where: '"Finish Voyage" - then 📋 Plan (next to Solve) for the big picture',
    target: '.solve-bar',
    body: [
      'After the voyage, press Finish Voyage (next to Copy into game): it consumes the board charts and asks, one by one, which preserved charts actually survived.',
      'The 📋 Plan button beside Solve sequences your whole library into a run order - juiced boards when ready, Speedruns while centre charts last, Alc & Go with the rest.',
      'The Updates button up top lists everything new. Good luck out there - may every border be Divine.',
    ],
  },
]

const RING_PAD = 6

/** Guided "how to use this site" walkthrough: dims the page and spotlights
 *  the section each step talks about, with the card docked out of the way. */
export function Tutorial({ onClose }: Props) {
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const s = STEPS[step]
  const last = step === STEPS.length - 1

  // track the spotlighted section (through smooth scrolling and resizes)
  useLayoutEffect(() => {
    const el = document.querySelector(STEPS[step].target)
    if (!el) {
      setRect(null)
      return
    }
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    const update = () => setRect(el.getBoundingClientRect())
    update()
    const timer = window.setInterval(update, 120)
    window.addEventListener('resize', update)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('resize', update)
    }
  }, [step])

  // dock the card where it won't cover the spotlight
  const dockTop = !!rect && rect.bottom > window.innerHeight * 0.62

  return (
    <>
      <div className="tut-catcher" onClick={onClose} />
      {rect ? (
        <div
          className="tut-ring"
          style={{
            top: rect.top - RING_PAD,
            left: rect.left - RING_PAD,
            width: rect.width + RING_PAD * 2,
            height: rect.height + RING_PAD * 2,
          }}
        />
      ) : (
        <div className="tut-dim" />
      )}
      <div className={`onboard tutorial tut-docked ${dockTop ? 'tut-top' : ''}`}>
        <div className="panel-title">
          {s.icon} {s.title}
          <span className="spacer" />
          <button onClick={onClose}>✕</button>
        </div>
        <div className="tut-where">📍 {s.where}</div>
        {s.body.map((p, i) => (
          <p key={i} className="tut-body">
            {p}
          </p>
        ))}
        <div className="tut-dots">
          {STEPS.map((_, i) => (
            <button
              key={i}
              className={`tut-dot ${i === step ? 'on' : ''}`}
              onClick={() => setStep(i)}
              title={`${STEPS[i].icon} ${STEPS[i].title}`}
            />
          ))}
        </div>
        <div className="sw-actions">
          <button disabled={step === 0} onClick={() => setStep((x) => x - 1)}>
            ← Back
          </button>
          <span className="spacer" />
          <span className="muted tut-count">
            {step + 1} / {STEPS.length}
          </span>
          <span className="spacer" />
          {!last && (
            <button className="primary tut-next" onClick={() => setStep((x) => x + 1)}>
              Next →
            </button>
          )}
          {last && (
            <button className="primary tut-next" onClick={onClose}>
              ⚓ Set sail
            </button>
          )}
        </div>
      </div>
    </>
  )
}
