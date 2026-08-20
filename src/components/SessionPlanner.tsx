import { useMemo } from 'react'
import { planSession } from '../logic/sessionPlan'
import type { StrategyReservationPreferences } from '../data/strategies'
import type { Borders, ChartData } from '../types'

interface Props {
  pool: ChartData[]
  borders: Borders
  reservations: StrategyReservationPreferences
  pieceKeeps: Record<string, number>
  centerChoice: Record<string, string>
  onUseStrategy: (id: string) => void
  onClose: () => void
}

/** Overlay that sequences the whole library into a session of voyages. */
export function SessionPlanner({ pool, borders, reservations, pieceKeeps, centerChoice, onUseStrategy, onClose }: Props) {
  const plan = useMemo(
    () => planSession(pool, borders, reservations, pieceKeeps, centerChoice),
    [pool, borders, reservations, pieceKeeps, centerChoice],
  )
  const ready = plan.entries.filter((e) => e.status === 'ready')
  const waiting = plan.entries.filter((e) => e.status === 'waiting')
  let step = 0

  return (
    <div className="onboard-backdrop" onClick={onClose}>
      <div className="onboard session-plan" onClick={(e) => e.stopPropagation()}>
        <div className="panel-title">
          Session Plan
          <span className="spacer" />
          <button onClick={onClose}>Done</button>
        </div>
        <p className="onboard-intro" style={{ marginBottom: 10 }}>
          Your whole library, sequenced: run these top to bottom, pressing Finish Voyage between
          runs. Each entry only uses charts the ones above it left behind.
        </p>
        {pool.length < 9 && (
          <div className="muted pad">Fewer than 9 charts - import some first.</div>
        )}
        <div className="plan-list">
          {ready.map((e) => {
            step += e.runs
            return (
              <div key={e.strategyId} className="plan-row ready">
                <span className="plan-step">
                  {e.runs > 1 ? `${step - e.runs + 1}-${step}` : step}
                </span>
                <span className="plan-name">
                  {e.name}
                  {e.runs > 1 && <span className="plan-runs"> ×{e.runs}</span>}
                </span>
                <span className="plan-note muted">{e.note}</span>
                <span className="spacer" />
                <button
                  onClick={() => {
                    onUseStrategy(e.strategyId)
                    onClose()
                  }}
                  title="Activate this strategy and close the plan"
                >
                  Use
                </button>
              </div>
            )
          })}
          {ready.length === 0 && pool.length >= 9 && (
            <div className="muted pad">
              Nothing is ready to run - see what each strategy is waiting on below.
            </div>
          )}
        </div>
        {waiting.length > 0 && (
          <>
            <div className="panel-title small">Waiting on pieces</div>
            <div className="plan-list">
              {waiting.map((e) => (
                <div key={e.strategyId} className="plan-row waiting">
                  <span className="plan-step">⏳</span>
                  <span className="plan-name">{e.name}</span>
                  <span className="plan-note muted">{e.note}</span>
                </div>
              ))}
            </div>
          </>
        )}
        <div className="muted small-note">
          {plan.allocated} chart{plan.allocated === 1 ? '' : 's'} allocated ·{' '}
          {plan.leftover} left over (held-back fuel and oddments). Protections in Solver
          Settings shape what each strategy may spend.
        </div>
      </div>
    </div>
  )
}
