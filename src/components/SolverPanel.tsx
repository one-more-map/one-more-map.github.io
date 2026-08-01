import { useMemo, useState } from 'react'
import { buildBestModRegex } from '../logic/regex'
import { solve, type SolverResult } from '../logic/solver'
import type { AppState } from '../logic/storage'
import type { AdjacencyMode } from '../logic/scoring'
import type { Board, ConnectivityMode } from '../types'
import { RARE_IMPLICITS } from '../data/strategies'
import type { StrategyDef } from '../data/strategies'
import { GROUP_LABEL, GROUP_ORDER, REWARD_TYPES } from '../logic/rewards'
import { displayValue } from './Library'

/** how many of your best charts to hold back from a filler voyage (one full board) */
const KEEP_BEST = 9

interface Props {
  state: AppState
  /** curated strategy currently overriding weights, or null for manual */
  activeStrategy: StrategyDef | null
  onPatch: (p: Partial<AppState>) => void
  results: SolverResult[]
  onResults: (r: SolverResult[]) => void
  onApply: (board: Board) => void
}

export function SolverPanel({ state, activeStrategy, onPatch, results, onResults, onApply }: Props) {
  const [busy, setBusy] = useState(false)
  const [regexCap, setRegexCap] = useState(50)
  const [copied, setCopied] = useState(false)
  const [solveNote, setSolveNote] = useState('')
  // while a strategy is active it overrides the manual weights everywhere here
  const weights = activeStrategy ? activeStrategy.weights : state.weights
  const bestRegex = useMemo(
    () => buildBestModRegex(weights, regexCap, new Set(state.disabledMods)),
    [weights, regexCap, state.disabledMods],
  )

  const copyRegex = async () => {
    try {
      await navigator.clipboard.writeText(bestRegex.regex)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* user can select the text manually */
    }
  }

  const run = () => {
    setBusy(true)
    setSolveNote('')
    // let the UI paint the busy state before the (synchronous) solve
    window.setTimeout(() => {
      try {
        // strategy reservations: hold back charts another strategy is saving for
        const reserve = activeStrategy?.reserveModIds
        const reserveAreaTypes = activeStrategy?.reserveAreaTypes
        // locked charts sitting on the board are pinned to their exact cell -
        // the solver arranges everything else around them (issue #9)
        const locked = state.board.map((placement) => {
          if (!placement) return null
          const chart = state.pool.find((c) => c.uid === placement.chartUid)
          return chart?.preserved ? { ...placement } : null
        })
        const lockedUids = new Set(locked.filter(Boolean).map((p) => p!.chartUid))
        // rare-implicit charts are Divine-strategy fuel: everything else
        // (manual mode included) leaves them in the library
        const raresAllowed = activeStrategy?.allowRareImplicits ?? false
        const isRareImplicit = (c: (typeof state.pool)[number]) =>
          c.modIds.some((id) => (RARE_IMPLICITS as readonly string[]).includes(id))
        const solvePool = state.pool.filter(
          (c) =>
            lockedUids.has(c.uid) ||
            ((raresAllowed || !isRareImplicit(c)) &&
              !(reserve?.length && c.modIds.some((id) => reserve.includes(id))) &&
              !(
                reserveAreaTypes?.length &&
                c.areaType &&
                reserveAreaTypes.includes(c.areaType)
              )),
        )
        const raresHeld = raresAllowed
          ? 0
          : state.pool.filter((c) => !lockedUids.has(c.uid) && isRareImplicit(c)).length
        const heldBack = state.pool.length - solvePool.length - raresHeld
        const res = solve(solvePool, state.borders, weights, {
          mode: state.mode,
          allowRotation: state.allowRotation,
          adjacencyMode: state.adjacencyMode,
          adjacentAffectsSelf: state.adjacentAffectsSelf,
          disabledMods: new Set(state.disabledMods),
          topK: 5,
          strategyRules: activeStrategy?.rules,
          strategyLayout: activeStrategy?.layout,
          strategyLayoutPenalty: activeStrategy?.layoutPenalty,
          locked,
        })
        onResults(res)
        const notes: string[] = []
        const lockedCount = locked.filter(Boolean).length
        if (lockedCount > 0)
          notes.push(`${lockedCount} locked chart${lockedCount === 1 ? '' : 's'} kept in place.`)
        if (raresHeld > 0)
          notes.push(`${raresHeld} rare-implicit chart${raresHeld === 1 ? '' : 's'} saved for the Divine strategies.`)
        if (heldBack > 0)
          notes.push(`${heldBack} juice chart${heldBack === 1 ? '' : 's'} held back for Meatfish/Ethereal.`)
        if (solvePool.length < 9)
          notes.push(`Only ${solvePool.length} spare charts - not enough for a full board.`)
        else if (res.length && !res[0].valid)
          notes.push('No fully runnable layout from these charts - best partial shown.')
        setSolveNote(notes.join(' '))
      } finally {
        setBusy(false)
      }
    }, 30)
  }

  // build a throwaway "filler" voyage from your lowest-value spare charts, holding
  // back your best KEEP_BEST charts and anything you've locked (🔒) so they survive
  const runFiller = () => {
    setBusy(true)
    setSolveNote('')
    window.setTimeout(() => {
      try {
        const disabled = new Set(state.disabledMods)
        const keep = new Set<string>()
        state.pool.forEach((c) => c.preserved && keep.add(c.uid))
        // rare-implicit charts are never filler - they're Divine-strategy fuel
        state.pool.forEach(
          (c) =>
            c.modIds.some((id) => (RARE_IMPLICITS as readonly string[]).includes(id)) &&
            keep.add(c.uid),
        )
        ;[...state.pool]
          .sort((a, b) => displayValue(b, weights, disabled) - displayValue(a, weights, disabled))
          .slice(0, KEEP_BEST)
          .forEach((c) => keep.add(c.uid))
        // locked board charts stay pinned even in a filler board (issue #9) -
        // they're preserved, so running the voyage doesn't consume them
        const locked = state.board.map((placement) => {
          if (!placement) return null
          const chart = state.pool.find((c) => c.uid === placement.chartUid)
          return chart?.preserved ? { ...placement } : null
        })
        const lockedUids = new Set(locked.filter(Boolean).map((p) => p!.chartUid))
        const fillerPool = state.pool.filter((c) => lockedUids.has(c.uid) || !keep.has(c.uid))
        if (fillerPool.length < 9) {
          onResults([])
          setSolveNote(
            `Only ${fillerPool.length} spare chart${fillerPool.length === 1 ? '' : 's'} - need 9 outside your best ${KEEP_BEST} and locked charts to build a filler voyage.`,
          )
          return
        }
        const res = solve(fillerPool, state.borders, weights, {
          mode: state.mode,
          allowRotation: state.allowRotation,
          adjacencyMode: state.adjacencyMode,
          adjacentAffectsSelf: state.adjacentAffectsSelf,
          disabledMods: disabled,
          topK: 5,
          minimizeReward: true,
          locked,
        })
        onResults(res)
        setSolveNote(
          res[0]?.valid
            ? 'Filler voyage: lowest-value runnable board from your spare charts (your best & locked charts untouched).'
            : 'No runnable filler layout from your spare charts.',
        )
      } finally {
        setBusy(false)
      }
    }, 30)
  }

  return (
    <div className="solver">
      <div className="panel-title">Solver</div>

      <div className="field">
        <label>Connector rule</label>
        <select
          value={state.mode}
          onChange={(e) => onPatch({ mode: e.target.value as ConnectivityMode })}
        >
          <option value="strict">Connectors must line up (real rule)</option>
          <option value="any">Ignore connectors (experiment)</option>
        </select>
      </div>

      <label className="check">
        <input
          type="checkbox"
          checked={state.allowRotation}
          onChange={(e) => onPatch({ allowRotation: e.target.checked })}
        />
        Charts can be rotated
      </label>

      <div className="field">
        <label>Adjacent modifiers reach</label>
        <select
          value={state.adjacencyMode}
          onChange={(e) => onPatch({ adjacencyMode: e.target.value as AdjacencyMode })}
        >
          <option value="physical">Any neighbouring area</option>
          <option value="connected">Only connected neighbours</option>
        </select>
      </div>

      <label className="check">
        <input
          type="checkbox"
          checked={state.adjacentAffectsSelf}
          onChange={(e) => onPatch({ adjacentAffectsSelf: e.target.checked })}
        />
        Adjacent modifiers also affect their own area
      </label>

      {activeStrategy && (
        <div className="strat-override-note">
          ⚑ <strong>{activeStrategy.name}</strong> is steering the solver - your manual weights
          below are ignored while it's active.
        </div>
      )}

      <details className="weights-panel">
        <summary className="panel-title small weights-summary">
          Reward weights{activeStrategy ? ' (overridden)' : ''}
        </summary>
        <div className="muted small-note" style={{ marginTop: 0 }}>
          Your personal priorities - slide up what you value. Each reward is weighted on its own.
        </div>
        <div className={`weights ${activeStrategy ? 'weights-overridden' : ''}`}>
          {GROUP_ORDER.map((group) => {
          const rows = REWARD_TYPES.filter((r) => r.group === group)
          if (rows.length === 0) return null
          return (
            <div key={group} className="weight-group">
              <div className="weight-group-title">{GROUP_LABEL[group]}</div>
              {rows.map((r) => (
                <div key={r.key} className="weight-row">
                  <span className="weight-label">{r.label}</span>
                  <input
                    type="range"
                    min={0}
                    max={10}
                    step={1}
                    disabled={!!activeStrategy}
                    value={state.weights[r.key] ?? r.default}
                    onChange={(e) =>
                      onPatch({ weights: { ...state.weights, [r.key]: parseInt(e.target.value, 10) } })
                    }
                  />
                  <span className="weight-val">{state.weights[r.key] ?? r.default}</span>
                </div>
              ))}
            </div>
          )
        })}
        </div>
      </details>

      <button className="primary" onClick={run} disabled={busy || state.pool.length === 0}>
        {busy ? 'Solving…' : `Solve (${state.pool.length} charts)`}
      </button>
      <button
        className="filler-btn"
        onClick={runFiller}
        disabled={busy || state.pool.length < 10}
        title="Build a throwaway voyage from your lowest-value spare charts, keeping your best and locked charts for a real run"
      >
        🗑 Filler voyage (spare charts)
      </button>
      {solveNote && <div className="muted small-note">{solveNote}</div>}
      {state.pool.length > 9 || state.allowRotation ? (
        <div className="muted small-note">Large pool / rotation → heuristic search (near-optimal)</div>
      ) : (
        <div className="muted small-note">Pool ≤ 9 charts → exhaustive search (optimal)</div>
      )}

      <div className="panel-title small">Best-Charts Regex</div>
      <div className="muted small-note" style={{ marginTop: 0 }}>
        Paste into the in-game chart search to highlight charts worth taking, based on your
        weights above. No import needed. Experimental: the in-game search may or may not
        support this syntax, we'll see once live.
      </div>
      <div className="regex-row">
        <input readOnly value={bestRegex.regex} onFocus={(e) => e.target.select()} />
        <button onClick={copyRegex}>{copied ? '✓' : 'Copy'}</button>
      </div>
      <div className="regex-meta">
        <span className="muted">
          {bestRegex.included.length} mods · {bestRegex.regex.length} chars
        </span>
        <span className="spacer" />
        <label className="muted">
          max{' '}
          <select value={regexCap} onChange={(e) => setRegexCap(parseInt(e.target.value, 10))}>
            <option value={50}>50</option>
            <option value={250}>250</option>
          </select>
        </label>
      </div>

      {results.length > 0 && (
        <>
          <div className="panel-title small">Results</div>
          <div className="results">
            {results.map((r, i) => (
              <button key={i} className={`result ${r.valid ? '' : 'invalid'}`} onClick={() => onApply(r.board)}>
                <span>#{i + 1}</span>
                <span>{r.reward.toFixed(1)} pts</span>
                {!r.valid && <span className="badge bad">not runnable</span>}
              </button>
            ))}
          </div>
          <div className="muted small-note">
            Ranked by your weights and estimated mod values. Click a result to load it.
          </div>
        </>
      )}
    </div>
  )
}
