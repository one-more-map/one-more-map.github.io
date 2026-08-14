import { useState } from 'react'
import { STRATEGIES, type StrategyDef } from '../data/strategies'
import type { Borders, ChartData } from '../types'

interface Props {
  activeId: string | null
  pool: ChartData[]
  borders: Borders
  onSelect: (id: string | null) => void
  /** chosen layout variant per strategy id (missing = default) */
  layoutChoice?: Record<string, string>
  onLayoutChoice?: (strategyId: string, layoutId: string) => void
}

/** per-requirement tally of what the library can supply (shared with the
 *  jackpot banners so they can never contradict the strategy card) */
export function pieceStatus(s: StrategyDef, pool: ChartData[]) {
  return (s.requirements ?? []).map((req) => {
    const have = pool.filter(
      (c) =>
        (req.modIds && c.modIds.some((id) => req.modIds!.includes(id))) ||
        (req.areaTypes && c.areaType && req.areaTypes.includes(c.areaType)),
    ).length
    return { ...req, have, missing: Math.max(0, req.count - have) }
  })
}

function Readiness({
  strategy,
  pool,
  borders,
}: {
  strategy: StrategyDef
  pool: ChartData[]
  borders: Borders
}) {
  const reqs = pieceStatus(strategy, pool)
  const borderMissing =
    strategy.requiresBorderId && !borders.includes(strategy.requiresBorderId.id)
  if (reqs.length === 0 && !strategy.requiresBorderId) return null
  const missing = reqs.filter((r) => r.missing > 0)
  if (missing.length > 0 || borderMissing) {
    const parts = [
      ...missing.map((m) => `${m.missing}× ${m.label}`),
      ...(borderMissing ? [strategy.requiresBorderId!.label] : []),
    ]
    return (
      <div className="strat-notready">
        ⚠ You don't have the pieces - avoid this voyage and wait. Missing: {parts.join(', ')}.
        {strategy.waitHint ? ` ${strategy.waitHint}` : ''}
      </div>
    )
  }
  return (
    <div className="strat-ready">
      ✓ Pieces ready:{' '}
      {reqs
        .map(
          (r) =>
            `${Math.min(r.have, r.count)}/${r.count}× ${r.label}${
              r.have > r.count ? ` (+${r.have - r.count} spare)` : ''
            }`,
        )
        .join(', ')}
    </div>
  )
}

/**
 * Curated strategies. Selecting one OVERRIDES the manual reward weights and
 * adds placement rules that shape what the solver suggests. Its own section so
 * it's obvious when a strategy - not your sliders - is steering results.
 */
function RegexRow({ regex }: { regex: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="strat-regex-row">
      <span className="strat-regex-label" title="Paste into the in-game chart search to highlight this strategy's keeper charts">
        Keeper search
      </span>
      <input readOnly value={regex} onFocus={(e) => e.target.select()} />
      <button
        onClick={() => {
          navigator.clipboard.writeText(regex).catch(() => {})
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1500)
        }}
      >
        {copied ? '✓' : 'Copy'}
      </button>
    </div>
  )
}

export function StrategiesPanel({ activeId, pool, borders, onSelect, layoutChoice, onLayoutChoice }: Props) {
  const [expanded, setExpanded] = useState<string | null>(activeId)

  return (
    <div className="strategies">
      <div className="panel-title">
        Strategies
        {activeId && <span className="strat-live-badge">ACTIVE</span>}
      </div>
      <div className="muted small-note" style={{ marginTop: 0 }}>
        Curated community strategies. Picking one overrides your reward weights and steers the
        solver until you switch it off.
      </div>

      <button
        className={`strat-card strat-none ${activeId === null ? 'active' : ''}`}
        onClick={() => onSelect(null)}
      >
        <span className="strat-name">None (manual)</span>
        <span className="strat-tagline">
          Use your own reward weights - set them in ⚙ Settings, next to Solve.
        </span>
      </button>

      {STRATEGIES.map((s) => {
        const isActive = activeId === s.id
        const isOpen = expanded === s.id
        return (
          <div key={s.id} className={`strat-card ${isActive ? 'active' : ''}`}>
            <button
              className="strat-head"
              onClick={() => setExpanded(isOpen ? null : s.id)}
              title="Show details"
            >
              <span className="strat-name">
                {s.name}
                {s.badge && <span className="strat-badge-new">{s.badge}</span>}
              </span>
              <span className="strat-tagline">{s.tagline}</span>
            </button>
            {isOpen && (
              <div className="strat-body">
                <ul className="strat-guide">
                  {s.guide.map((g, i) => (
                    <li key={i}>{g}</li>
                  ))}
                </ul>
                {s.source.url ? (
                  <a className="strat-source" href={s.source.url} target="_blank" rel="noopener noreferrer">
                    ▶ {s.source.label}
                  </a>
                ) : (
                  <span className="strat-source">{s.source.label}</span>
                )}
                {s.extraLinks?.map((l) => (
                  <a
                    key={l.url}
                    className="strat-source strat-extra-link"
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    🔗 {l.label}
                  </a>
                ))}
              </div>
            )}
            {(isActive || isOpen) &&
              s.layouts &&
              (() => {
                const chosen =
                  s.layouts.find((v) => v.id === layoutChoice?.[s.id]) ?? s.layouts[0]
                return (
                  <div className="strat-layouts">
                    <div className="strat-layouts-row">
                      <span className="strat-layouts-label">Layout</span>
                      {s.layouts.map((v) => (
                        <button
                          key={v.id}
                          className={`strat-layout-btn ${v.id === chosen.id ? 'on' : ''}`}
                          onClick={() => onLayoutChoice?.(s.id, v.id)}
                          title={v.hint}
                        >
                          {v.label}
                        </button>
                      ))}
                    </div>
                    <div className="strat-layouts-hint muted">{chosen.hint}</div>
                  </div>
                )
              })()}
            {(isActive || isOpen) && s.searchRegex && <RegexRow regex={s.searchRegex} />}
            {(isActive || isOpen) && <Readiness strategy={s} pool={pool} borders={borders} />}
            <button
              className={`strat-use ${isActive ? 'on' : ''}`}
              onClick={() => onSelect(isActive ? null : s.id)}
            >
              {isActive ? '✓ Active - click to turn off' : 'Use this strategy'}
            </button>
          </div>
        )
      })}
    </div>
  )
}
