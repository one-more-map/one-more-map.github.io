import type { Board, Borders, ChartData, ConnectivityMode, Edges, Placement, Weights } from '../types'
import { borderTouches } from '../types'
import type { PositionRule } from '../data/strategies'
import { checkConnectivity, rotateEdges } from './connectivity'
import { scoreBoard, type ScoreOptions } from './scoring'

export interface SolverOptions extends ScoreOptions {
  mode: ConnectivityMode
  allowRotation: boolean
  /** how many top results to return */
  topK: number
  /** build the LOWEST-value runnable board (for a throwaway "filler" voyage) */
  minimizeReward?: boolean
  /** active strategy position rules - bonuses that shape where charts land */
  strategyRules?: PositionRule[]
  /** exact connector layout the strategy wants (effective edges per cell) */
  strategyLayout?: Edges[]
  /** cells pinned by the user (locked charts stay exactly where they are) */
  locked?: (Placement | null)[]
  /** per-cell cost of deviating from strategyLayout (default strict) */
  strategyLayoutPenalty?: number
}

/** heavy per-cell penalty: an exact-layout strategy treats deviation as broken */
const LAYOUT_PENALTY = 300

const edgesEqual = (a: Edges, b: Edges): boolean =>
  a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3]

/** rotation making chart edges match the target, or null if its shape can't */
function rotationFor(edges: Edges, target: Edges, rotMax: number): number | null {
  for (let r = 0; r < rotMax; r++) if (edgesEqual(rotateEdges(edges, r), target)) return r
  return null
}


/** how many cells deviate from the strategy's exact layout */
function layoutMisses(board: Board, charts: Map<string, ChartData>, layout: Edges[]): number {
  let misses = 0
  for (let i = 0; i < 9; i++) {
    const target = layout[i]
    if (!target) continue
    const p = board[i]
    const c = p ? charts.get(p.chartUid) : null
    if (!p || !c || !edgesEqual(rotateEdges(c.edges, p.rotation), target)) misses++
  }
  return misses
}

const CELL_NEIGHBOURS: number[][] = Array.from({ length: 9 }, (_, i) => {
  const r = Math.floor(i / 3)
  const c = i % 3
  const out: number[] = []
  if (r > 0) out.push(i - 3)
  if (r < 2) out.push(i + 3)
  if (c > 0) out.push(i - 1)
  if (c < 2) out.push(i + 1)
  return out
})

/** the cells a rule targets - static, or resolved from the rolled borders */
function resolveRuleCells(rule: PositionRule, borders: Borders): number[] {
  if (rule.cells) return rule.cells
  if (rule.nearBorderId) {
    const tiles: number[] = []
    borders.forEach((id, seg) => {
      if (id === rule.nearBorderId) tiles.push(borderTouches(seg))
    })
    if (!rule.adjacentToBorder) return [...new Set(tiles)]
    const out = new Set<number>()
    for (const t of tiles) for (const n of CELL_NEIGHBOURS[t]) out.add(n)
    return [...out]
  }
  return []
}

/** does this chart satisfy the rule's modifier or destination matcher? */
function chartMatchesRule(chart: ChartData, rule: PositionRule): boolean {
  if (rule.modIds && chart.modIds.some((id) => rule.modIds!.includes(id))) return true
  if (rule.areaTypes && chart.areaType && rule.areaTypes.includes(chart.areaType)) return true
  return false
}

/** objective bonus from strategy position rules for this arrangement */
function strategyBonus(
  board: Board,
  charts: Map<string, ChartData>,
  rules: PositionRule[],
  borders: Borders,
): number {
  let bonus = 0
  for (const rule of rules) {
    for (const cell of resolveRuleCells(rule, borders)) {
      const p = board[cell]
      if (!p) continue
      const chart = charts.get(p.chartUid)
      if (!chart) continue
      if (chartMatchesRule(chart, rule)) bonus += rule.bonus
      if (rule.rewardStat) {
        const r = chart.rewards?.find((e) => e.stat === rule.rewardStat!.stat)
        if (r) bonus += (r.percent / 100) * rule.rewardStat.per
      }
    }
  }
  return bonus
}

export interface SolverResult {
  board: Board
  /** internal ranking objective (reward ± connection bonus − penalties) */
  score: number
  /** the actual reward value of the board, for display */
  reward: number
  valid: boolean
}

const VIOLATION_PENALTY = 10_000
// small nudge so that among equally-rewarding runnable boards the solver prefers
// ones with more matched connections (a better-threaded voyage; some mods scale
// per connection). Kept low so it never outweighs real reward differences.
const CONNECTION_BONUS = 0.15

function evaluate(
  board: Board,
  borders: Borders,
  charts: Map<string, ChartData>,
  weights: Weights,
  opts: SolverOptions,
): { score: number; valid: boolean; reward: number } {
  const conn = checkConnectivity(board, charts, opts.mode)
  const s = scoreBoard(board, borders, charts, weights, opts)
  // filler mode wants the least valuable runnable board, so flip the reward term
  // while keeping the runnable requirements (connections good, violations bad)
  const rewardTerm = opts.minimizeReward ? -s.total : s.total
  const strat = opts.strategyRules ? strategyBonus(board, charts, opts.strategyRules, borders) : 0
  const layoutPen = opts.strategyLayout
    ? layoutMisses(board, charts, opts.strategyLayout) * (opts.strategyLayoutPenalty ?? LAYOUT_PENALTY)
    : 0
  const objective =
    rewardTerm +
    strat +
    conn.connections * CONNECTION_BONUS -
    layoutPen -
    conn.violations * VIOLATION_PENALTY
  return { score: objective, valid: conn.valid, reward: s.total }
}

function boardKey(board: Board): string {
  return board.map((p) => (p ? `${p.chartUid}:${p.rotation}` : '_')).join('|')
}

/**
 * Find high-scoring arrangements. Exact permutation search when the pool is
 * exactly 9 charts with rotation off; otherwise hill-climbing with random
 * restarts (fast and near-optimal at this tiny problem size).
 */
export function solve(
  pool: ChartData[],
  borders: Borders,
  weights: Weights,
  opts: SolverOptions,
): SolverResult[] {
  const charts = new Map(pool.map((c) => [c.uid, c]))
  if (pool.length === 0) return []

  const CAP = Math.max(opts.topK * 4, 20)
  let top: SolverResult[] = []
  const seen = new Set<string>()
  const record = (board: Board) => {
    const { score, valid, reward } = evaluate(board, borders, charts, weights, opts)
    if (top.length >= CAP && score <= top[top.length - 1].score) return
    const key = boardKey(board)
    if (seen.has(key)) return
    seen.add(key)
    top.push({ board: board.map((p) => (p ? { ...p } : null)), score, reward, valid })
    top.sort((a, b) => b.score - a.score)
    if (top.length > CAP) top = top.slice(0, CAP)
  }

  const locked: (Placement | null)[] =
    opts.locked && opts.locked.length === 9 ? opts.locked : Array(9).fill(null)

  if (pool.length <= 9 && !opts.allowRotation) {
    exactSearch(pool, locked, record)
  } else {
    hillClimb(pool, borders, charts, weights, opts, locked, record)
  }

  return top.slice(0, opts.topK)
}

/** All placements of the pool over the 9 cells (pool ≤ 9, no rotation).
 *  Locked cells are pre-filled and never reassigned. */
function exactSearch(pool: ChartData[], locked: (Placement | null)[], record: (b: Board) => void) {
  const lockedUids = new Set(locked.filter(Boolean).map((p) => p!.chartUid))
  const free = pool.filter((c) => !lockedUids.has(c.uid))
  const n = free.length
  const board: Board = locked.map((p) => (p ? { ...p } : null))
  const used = Array(n).fill(false)
  const freeCells = board.filter((p) => !p).length

  // walk cells in order; each unlocked cell is either left empty or assigned
  const place = (cell: number, placed: number, cellsLeft: number) => {
    if (cellsLeft < n - placed) return // not enough cells left for remaining charts
    if (cell === 9) {
      if (placed === n) record(board)
      return
    }
    if (board[cell] && locked[cell]) {
      place(cell + 1, placed, cellsLeft)
      return
    }
    place(cell + 1, placed, cellsLeft - 1) // leave empty
    for (let k = 0; k < n; k++) {
      if (used[k]) continue
      used[k] = true
      board[cell] = { chartUid: free[k].uid, rotation: 0 }
      place(cell + 1, placed + 1, cellsLeft - 1)
      board[cell] = null
      used[k] = false
    }
  }
  place(0, 0, freeCells)
}

function hillClimb(
  pool: ChartData[],
  borders: Borders,
  charts: Map<string, ChartData>,
  weights: Weights,
  opts: SolverOptions,
  locked: (Placement | null)[],
  record: (b: Board) => void,
) {
  // strategies need more exploration: seeded restarts vary piece rotations,
  // and the climb has to reshape the board around the lucky combinations
  const hasStrategy = !!(opts.strategyRules || opts.strategyLayout)
  const RESTARTS = hasStrategy ? 60 : 40
  const ITERS = hasStrategy ? 5000 : 4000
  const rotMax = opts.allowRotation ? 4 : 1

  const evalScore = (b: Board) => evaluate(b, borders, charts, weights, opts).score

  for (let r = 0; r < RESTARTS; r++) {
    // random initial: shuffle pool, take up to 9. Locked cells are fixed.
    const shuffled = [...pool].sort(() => Math.random() - 0.5)
    const board: Board = locked.map((p) => (p ? { ...p } : null))

    // strategy-seeded restarts (every other one): pre-place matching charts on
    // their target cells so rare shapes/pieces aren't left to random luck
    if (r % 2 === 0 && (opts.strategyRules || opts.strategyLayout)) {
      const taken = () => new Set(board.filter(Boolean).map((p) => p!.chartUid))
      // 1) positive rule cells first: the designated piece goes there in ANY
      //    shape (location beats lines); use the layout rotation if it happens
      //    to fit, random otherwise
      if (opts.strategyRules) {
        for (const rule of opts.strategyRules) {
          if (rule.bonus <= 0 || (!rule.modIds && !rule.areaTypes)) continue
          for (const cell of resolveRuleCells(rule, borders)) {
            if (board[cell]) continue
            const used = taken()
            const cands = shuffled.filter((c) => !used.has(c.uid) && chartMatchesRule(c, rule))
            if (cands.length === 0) continue
            const target = opts.strategyLayout?.[cell]
            const shaped = target
              ? cands.find((c) => rotationFor(c.edges, target, rotMax) !== null)
              : undefined
            const pick = shaped ?? cands[0]
            // exact-shape pieces take the layout rotation; others get a RANDOM
            // rotation so different restarts explore different orientations
            // (the climb then reshapes the board around the lucky ones)
            const rot =
              shaped && target
                ? rotationFor(pick.edges, target, rotMax)!
                : Math.floor(Math.random() * rotMax)
            board[cell] = { chartUid: pick.uid, rotation: rot }
          }
        }
      }
      // 2) remaining layout cells: shape-matching charts, avoiding banned mods
      if (opts.strategyLayout) {
        for (let cell = 0; cell < 9; cell++) {
          const target = opts.strategyLayout[cell]
          if (!target || board[cell]) continue
          const used = taken()
          const bannedRules = opts.strategyRules?.filter(
            (ru) => ru.bonus < 0 && resolveRuleCells(ru, borders).includes(cell),
          )
          const pick = shuffled.find(
            (c) =>
              !used.has(c.uid) &&
              rotationFor(c.edges, target, rotMax) !== null &&
              !bannedRules?.some((ru) => chartMatchesRule(c, ru)),
          )
          if (pick)
            board[cell] = { chartUid: pick.uid, rotation: rotationFor(pick.edges, target, rotMax)! }
        }
      }
    }

    const remaining = shuffled.filter((c) => !board.some((p) => p?.chartUid === c.uid))
    let ri = 0
    for (let i = 0; i < 9 && ri < remaining.length; i++) {
      if (board[i]) continue
      board[i] = { chartUid: remaining[ri++].uid, rotation: Math.floor(Math.random() * rotMax) }
    }
    const unused = remaining.slice(ri)
    let score = evalScore(board)

    for (let it = 0; it < ITERS; it++) {
      const move = Math.random()
      let undo: (() => void) | null = null

      if (move < 0.5) {
        // swap two cells (never a locked one)
        const a = Math.floor(Math.random() * 9)
        const b = Math.floor(Math.random() * 9)
        if (a === b || locked[a] || locked[b]) continue
        const pa = board[a]
        const pb = board[b]
        board[a] = pb
        board[b] = pa
        undo = () => {
          board[a] = pa
          board[b] = pb
        }
      } else if (move < 0.75 && unused.length > 0) {
        // replace a placed chart with an unused one
        const cell = Math.floor(Math.random() * 9)
        const ui = Math.floor(Math.random() * unused.length)
        if (locked[cell]) continue
        const prev = board[cell]
        const incoming = unused[ui]
        board[cell] = { chartUid: incoming.uid, rotation: Math.floor(Math.random() * rotMax) }
        if (prev) unused[ui] = charts.get(prev.chartUid)!
        else unused.splice(ui, 1)
        undo = () => {
          if (prev) unused[ui] = incoming
          else unused.splice(ui, 0, incoming)
          board[cell] = prev
        }
      } else if (opts.allowRotation) {
        // rotate a placed chart (locked charts keep their rotation too)
        const cell = Math.floor(Math.random() * 9)
        const p = board[cell]
        if (!p || locked[cell]) continue
        const prevRot = p.rotation
        p.rotation = (p.rotation + 1 + Math.floor(Math.random() * 3)) % 4
        undo = () => {
          p.rotation = prevRot
        }
      } else {
        continue
      }

      const newScore = evalScore(board)
      if (newScore >= score) {
        score = newScore
      } else {
        undo?.()
      }
    }
    record(board)
  }
}
