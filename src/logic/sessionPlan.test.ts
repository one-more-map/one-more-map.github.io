import { describe, expect, it } from 'vitest'
import { planSession } from './sessionPlan'
import { emptyBorders } from '../types'
import type { ChartAreaType, ChartData } from '../types'

let n = 0
const chart = (modIds: string[], areaType?: ChartAreaType): ChartData => ({
  uid: `t-${n++}`,
  name: `Chart ${n}`,
  level: 83,
  edges: [true, true, true, true],
  modIds,
  areaType,
})

const junk = (count: number) => Array.from({ length: count }, () => chart(['voy-quant-1']))

// a full Meatfish kit: 2 star, 1 pantheon, 2 sea-pillars, 2 lantern, 1 possess, 1 noequip
const meatfishKit = () => [
  chart(['adj-star-1']),
  chart(['adj-star-2']),
  chart(['adj-pantheon']),
  chart([], 'sea-pillars'),
  chart([], 'sea-pillars'),
  chart(['adj-lantern']),
  chart(['adj-lantern']),
  chart(['voy-possess']),
  chart(['voy-noequip']),
]

describe('session planner', () => {
  it('speedrun centre restriction skips runs whose centre family is excluded (issue #49)', () => {
    const pool = [chart(['adj-divbox-2']), ...junk(8)]

    // default: the Diviner chart takes the centre and one run is planned
    const anyPlan = planSession(pool, emptyBorders())
    expect(anyPlan.entries.find((e) => e.strategyId === 'milky-speedrun')?.runs).toBe(1)

    // Message-only pick: no valid centre, so no speedrun - and the Diviner
    // chart is never burned as a side by the fallback strategies
    const msgPlan = planSession(pool, emptyBorders(), undefined, {}, {
      'milky-speedrun': 'msg',
    })
    expect(msgPlan.entries.find((e) => e.strategyId === 'milky-speedrun')).toBeUndefined()
  })

  it('sequences a ready Meatfish, then Speedruns, then Alc & Go', () => {
    const pool = [
      ...meatfishKit(),
      chart(['adj-opbox-1']), // speedrun centre
      chart(['adj-divbox-2']), // second centre
      ...junk(20),
    ]
    const plan = planSession(pool, emptyBorders())

    const meatfish = plan.entries.find((e) => e.strategyId === 'milky-meatfish')
    expect(meatfish?.status).toBe('ready')

    const speedrun = plan.entries.find((e) => e.strategyId === 'milky-speedrun')
    expect(speedrun?.status).toBe('ready')
    expect(speedrun?.runs).toBe(2)

    // both Divine strats wait on the border roll
    for (const id of ['divine-border-rares', 'cutedog-divine-boxes']) {
      const e = plan.entries.find((x) => x.strategyId === id)
      expect(e?.status).toBe('waiting')
      expect(e?.note).toContain('border')
    }

    expect(plan.allocated + plan.leftover).toBe(pool.length)
  })

  it('reports what a not-ready strategy is missing', () => {
    const plan = planSession(junk(12), emptyBorders())
    const meatfish = plan.entries.find((e) => e.strategyId === 'milky-meatfish')
    expect(meatfish?.status).toBe('waiting')
    expect(meatfish?.note).toContain('Giant Starfish')
    // junk still burns fine
    const alcgo = plan.entries.find((e) => e.strategyId === 'alc-and-go')
    expect(alcgo?.runs).toBe(1)
  })

  it('never double-spends a chart across entries', () => {
    const pool = [...meatfishKit(), chart(['adj-opbox-1']), ...junk(8)]
    const plan = planSession(pool, emptyBorders())
    // meatfish takes its 9; the 1 centre + 8 junk feed exactly one speedrun
    expect(plan.entries.find((e) => e.strategyId === 'milky-speedrun')?.runs).toBe(1)
    expect(plan.entries.find((e) => e.strategyId === 'alc-and-go')).toBeUndefined()
    expect(plan.leftover).toBe(0)
  })
})
