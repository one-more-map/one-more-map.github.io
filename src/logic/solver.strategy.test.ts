import { describe, expect, it } from 'vitest'
import type { ChartAreaType, ChartData } from '../types'
import { emptyBorders } from '../types'
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
