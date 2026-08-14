import { describe, expect, it } from 'vitest'
import { strategyById } from '../data/strategies'
import type { ChartAreaType, ChartData, Edges } from '../types'
import { START_CELL, emptyBorders } from '../types'
import { checkConnectivity } from './connectivity'
import { solve } from './solver'

function chart(uid: string, name: string, areaType: ChartAreaType): ChartData {
  return {
    uid,
    name,
    level: 83,
    edges: [false, false, false, false],
    areaType,
    modIds: [],
  }
}

describe('strategy destination rules', () => {
  it('places a canonical Sea Pillars chart without relying on its localized name', () => {
    const seaPillars = chart('sea-pillars', '해병 고역 산호 암초 해도', 'sea-pillars')
    const nameImpostor = chart('impostor', 'Pelagic Pillar Chart', 'undersea-groves')

    const [best] = solve([seaPillars, nameImpostor], emptyBorders(), {}, {
      mode: 'any',
      allowRotation: false,
      adjacencyMode: 'physical',
      adjacentAffectsSelf: false,
      topK: 1,
      strategyRules: [{ cells: [4], areaTypes: ['sea-pillars'], bonus: 100 }],
    })

    expect(best.board[4]?.chartUid).toBe('sea-pillars')
  })
})

describe('Alc & Go snake mode', () => {
  const T = true
  const F = false
  const END = [F, T, F, F] as Edges
  const STRAIGHT = [T, F, T, F] as Edges
  const CORNER = [T, T, F, F] as Edges
  const TEE = [T, T, T, F] as Edges
  const CROSS = [T, T, T, T] as Edges

  function shaped(uid: string, edges: Edges): ChartData {
    return { uid, name: uid, level: 83, edges, modIds: [] }
  }

  /** the snake property: one thread from ⚓ (cell 6) to top-right (cell 2) -
   *  no other tile may sit at fewer than 2 on-board connections */
  function expectSnake(board: (ReturnType<typeof solve>[number]['board']), pool: ChartData[]) {
    const charts = new Map(pool.map((c) => [c.uid, c]))
    const conn = checkConnectivity(board, charts, 'connected')
    expect(conn.valid).toBe(true)
    for (let cell = 0; cell < 9; cell++) {
      const min = cell === START_CELL || cell === 2 ? 1 : 2
      expect(conn.degrees[cell], `cell ${cell} degree`).toBeGreaterThanOrEqual(min)
    }
  }

  // exactly what SolveBar passes when the Snake toggle is on
  const snakeVariant = strategyById.get('alc-and-go')!.layouts!.find((v) => v.id === 'snake')!
  const snakeOpts = {
    mode: 'connected' as const,
    allowRotation: true,
    adjacencyMode: 'physical' as const,
    adjacentAffectsSelf: false,
    topK: 1,
    strategySnake: true,
    strategyLayout: snakeVariant.layout,
    strategySeedLayouts: snakeVariant.seeds,
  }

  it('threads a serpentine when the pieces allow a pure line', () => {
    const pool = [
      shaped('end-a', END),
      shaped('end-b', END),
      shaped('str-a', STRAIGHT),
      shaped('str-b', STRAIGHT),
      shaped('str-c', STRAIGHT),
      shaped('cor-a', CORNER),
      shaped('cor-b', CORNER),
      shaped('cor-c', CORNER),
      shaped('cor-d', CORNER),
    ]

    const [best] = solve(pool, emptyBorders(), {}, snakeOpts)
    expectSnake(best.board, pool)
  })

  it('bends around junction pieces by parking their spare arms off-board', () => {
    // no pure line possible: the tees and the cross must sit on the rim with
    // their spare arms dangling off-screen (rule 3 - still a snake)
    const pool = [
      shaped('cor-a', CORNER),
      shaped('cor-b', CORNER),
      shaped('cor-c', CORNER),
      shaped('cor-d', CORNER),
      shaped('tee-a', TEE),
      shaped('tee-b', TEE),
      shaped('cross', CROSS),
      shaped('str-a', STRAIGHT),
      shaped('str-b', STRAIGHT),
    ]

    const [best] = solve(pool, emptyBorders(), {}, snakeOpts)
    expectSnake(best.board, pool)
  })
})
