import type { Board, ChartData, ConnectivityMode, Edges } from '../types'
import { START_CELL } from '../types'

/** Rotate edges r × 90° clockwise. */
export function rotateEdges(edges: Edges, r: number): Edges {
  const out = [false, false, false, false] as Edges
  for (let i = 0; i < 4; i++) out[i] = edges[(i - r + 4) % 4]
  return out
}

const DIRS = [
  { dr: -1, dc: 0, edge: 0, opp: 2 }, // N
  { dr: 0, dc: 1, edge: 1, opp: 3 }, // E
  { dr: 1, dc: 0, edge: 2, opp: 0 }, // S
  { dr: 0, dc: -1, edge: 3, opp: 1 }, // W
]

export interface ConnectivityResult {
  valid: boolean
  /** total rule violations, used as a penalty to guide the solver */
  violations: number
  /** connector mismatches between two adjacent placed charts */
  mismatches: number
  /** empty squares (a real voyage always uses all 9) */
  unfilled: number
  /** placed charts that can't be reached from the start via matched connectors */
  disconnected: number
  /** number of matched connections (shared edges where both charts connect) */
  connections: number
  /** per-cell count of matched on-board connections (off-board arms excluded) */
  degrees: number[]
}

/**
 * Check the connector rules for placed tiles.
 *
 * A layout is runnable when:
 *  - every internal edge matches: where two placed charts share an edge, both
 *    have a connector or neither does (a connector meeting a blank neighbour is
 *    the broken red line in game). Connectors off the outer rim are fine.
 *  - all 9 squares are filled.
 *  - every chart is reachable from the start (bottom-left ⚓) through matched
 *    connectors - otherwise the Voyage can't thread through the whole board and
 *    those areas never get run.
 *
 * 'any' mode ignores connectors entirely (experiment mode).
 */
export function checkConnectivity(
  board: Board,
  charts: Map<string, ChartData>,
  mode: ConnectivityMode,
): ConnectivityResult {
  const placedIdx = board.map((p, i) => (p ? i : -1)).filter((i) => i >= 0)
  const unfilled = 9 - placedIdx.length

  const edgesAt = (i: number): Edges | null => {
    const p = board[i]
    if (!p) return null
    const c = charts.get(p.chartUid)
    if (!c) return null
    return rotateEdges(c.edges, p.rotation)
  }

  // build the matched-connection graph and count mismatches
  let mismatches = 0
  let connections = 0
  const adj: number[][] = Array.from({ length: 9 }, () => [])
  for (const i of placedIdx) {
    const e = edgesAt(i)
    if (!e) continue
    const r = Math.floor(i / 3)
    const c = i % 3
    for (const d of DIRS) {
      const nr = r + d.dr
      const nc = c + d.dc
      if (nr < 0 || nr > 2 || nc < 0 || nc > 2) continue // off-board rim: fine
      const j = nr * 3 + nc
      const ne = edgesAt(j)
      if (!ne) continue // neighbour empty: penalised via unfilled, not here
      if (e[d.edge] && ne[d.opp]) {
        adj[i].push(j)
        if (i < j) connections++
      } else if (e[d.edge] !== ne[d.opp]) {
        mismatches++
      }
    }
  }
  mismatches /= 2 // each mismatched pair is seen from both tiles
  const degrees = adj.map((links) => links.length)

  if (mode === 'any')
    return { valid: true, violations: 0, mismatches: 0, unfilled, disconnected: 0, connections, degrees }

  // reachability: flood-fill from the start square over matched connections
  let disconnected = 0
  if (placedIdx.length > 0) {
    const root = board[START_CELL] ? START_CELL : placedIdx[0]
    const seen = new Set<number>()
    const stack = [root]
    while (stack.length) {
      const i = stack.pop()!
      if (seen.has(i)) continue
      seen.add(i)
      for (const j of adj[i]) if (!seen.has(j)) stack.push(j)
    }
    disconnected = placedIdx.length - seen.size
  }

  const violations = mismatches + unfilled + disconnected
  return { valid: violations === 0, violations, mismatches, unfilled, disconnected, connections, degrees }
}
