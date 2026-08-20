import { describe, expect, it } from 'vitest'
import { strategyById } from '../data/strategies'
import type { ChartAreaType, ChartData } from '../types'
import { PIECE_TYPES, selectPieceBank } from './pieceKeeps'
import { selectStrategySolvePool } from './solverPoolSelection'

let n = 0
const chart = (overrides: Partial<ChartData> = {}): ChartData => ({
  uid: overrides.uid ?? `t-${n++}`,
  name: 'Chart',
  level: 83,
  edges: [true, true, true, true],
  modIds: [],
  ...overrides,
})

const keyOf = (label: string) => {
  const piece = PIECE_TYPES.find((p) => p.label === label)
  if (!piece) throw new Error(`no piece type labelled ${label}`)
  return piece.key
}

const ALL_ON = { divine: true, meatfish: true, ethereal: true }

describe('keep-count solve pools', () => {
  it('banks the recommended count of a piece type and spends the rest', () => {
    // Meatfish wants 2 Giant Starfish; a third is an ordinary spare
    const stars = [
      chart({ uid: 's1', modIds: ['adj-star-1'] }),
      chart({ uid: 's2', modIds: ['adj-star-2'] }),
      chart({ uid: 's3', modIds: ['adj-star-1'] }),
    ]
    // stars are claimed by the Divine star/box type (3) before Meatfish - all
    // three end up banked, so raise the picture with junk to see spending
    const pool = [...stars, chart({ uid: 'junk', modIds: ['voy-quant-1'] })]
    const manual = selectStrategySolvePool(pool, null, ALL_ON)
    expect(manual.solvePool.map((c) => c.uid)).toEqual(['junk'])
    expect(manual.heldBackFor.length).toBeGreaterThan(0)
  })

  it('banks one spare rare beyond the Divine requirement and spends extras', () => {
    const rares = Array.from({ length: 8 }, (_, i) =>
      chart({ uid: `r${i}`, modIds: ['voy-rare'] }),
    )
    const { solvePool, heldBack, heldBackFor } = selectStrategySolvePool(rares, null, ALL_ON)
    expect(heldBack).toBe(6) // requirement 5 + 1 spare
    expect(solvePool).toHaveLength(2)
    expect(heldBackFor).toContain('Divine Border Rares')
  })

  it('ranks a piece type by rolls within the same tier', () => {
    const pool = [
      chart({ uid: 'weak', modIds: ['voy-rare'] }),
      chart({
        uid: 'rolled',
        modIds: ['voy-rare'],
        rewards: [{ stat: 'quantity', percent: 70 }],
      }),
    ]
    const bank = selectPieceBank(
      pool,
      { [keyOf('Increased Rares chart (voyage-wide)')]: 1 },
      ALL_ON,
    )
    expect(bank.has('rolled')).toBe(true)
    expect(bank.has('weak')).toBe(false)
  })

  it('adjacent rares are spendable by default - only voyage-wide rares bank', () => {
    const pool = [
      chart({ uid: 'adj', modIds: ['adj-rare-2'] }),
      chart({ uid: 'voy', modIds: ['voy-rare'] }),
    ]
    const { solvePool } = selectStrategySolvePool(pool, null, ALL_ON)
    expect(solvePool.map(({ uid }) => uid)).toEqual(['adj'])
  })

  it('splits generic big boxes from typed boxes (issue #21)', () => {
    const pool = [
      chart({ uid: 'big4', modIds: ['adj-box-2'] }),
      chart({ uid: 'big5', modIds: ['adj-box-3'] }),
      chart({ uid: 'small', modIds: ['adj-box-1'] }),
      chart({ uid: 'arcanist', modIds: ['adj-arcbox-2'] }),
      chart({ uid: 'diviner', modIds: ['adj-divbox-2'] }),
    ]
    const bank = selectPieceBank(pool, {}, ALL_ON)
    // big generic boxes are Divine-mandatory
    expect(bank.get('big4')?.strategyId).toBe('divine-border-rares')
    expect(bank.get('big5')?.strategyId).toBe('divine-border-rares')
    // +1 boxes and Arcanist's are free by default
    expect(bank.has('small')).toBe(false)
    expect(bank.has('arcanist')).toBe(false)
    // Diviner's is a Speedrun centre, banked for Speedrun, not Divine
    expect(bank.get('diviner')?.strategyId).toBe('milky-speedrun')
    // opting typed boxes back in works
    const withDiviners = selectPieceBank(
      pool,
      { [keyOf("Diviner's Strongbox chart")]: 1 },
      ALL_ON,
    )
    expect(withDiviners.get('diviner')?.strategyId).toBe('cutedog-divine-boxes')
  })

  it('banks a whole tier family from one custom entry, best tier first', () => {
    const pool = [
      chart({ uid: 'small-barrel', modIds: ['adj-barrel-1'] }),
      chart({ uid: 'big-barrel', modIds: ['adj-barrel-2'] }),
    ]
    const keeps = { 'custom:milky-ethereal:adj-barrel-1+adj-barrel-2': 1 }
    const bank = selectPieceBank(pool, keeps, ALL_ON)
    expect(bank.get('big-barrel')?.strategyId).toBe('milky-ethereal')
    expect(bank.has('small-barrel')).toBe(false)
  })

  it('banks user-added custom chart types for their strategy', () => {
    const pool = [chart({ uid: 'barrel', modIds: ['adj-barrel-1'] })]
    expect(selectStrategySolvePool(pool, null, ALL_ON).solvePool).toHaveLength(1)
    const keeps = { 'custom:milky-meatfish:adj-barrel-1': 1 }
    const bank = selectPieceBank(pool, keeps, ALL_ON)
    expect(bank.get('barrel')?.strategyId).toBe('milky-meatfish')
    const { solvePool, heldBackFor } = selectStrategySolvePool(
      pool,
      null,
      ALL_ON,
      new Set(),
      keeps,
    )
    expect(solvePool).toHaveLength(0)
    expect(heldBackFor).toEqual(['Meatfish'])
  })

  it('lets the owning strategy spend its banked charts', () => {
    const meatfish = strategyById.get('milky-meatfish')!
    const pool = [chart({ uid: 'lantern', modIds: ['adj-lantern'] })]
    expect(selectStrategySolvePool(pool, null, ALL_ON).solvePool).toHaveLength(0)
    expect(selectStrategySolvePool(pool, meatfish, ALL_ON).solvePool).toHaveLength(1)
  })

  it('shares banked pieces between strategies that want the same type', () => {
    // stars bank for Divine first, but Meatfish wants stars too
    const meatfish = strategyById.get('milky-meatfish')!
    const pool = [chart({ uid: 'star', modIds: ['adj-star-1'] })]
    const bank = selectPieceBank(pool, {}, ALL_ON)
    expect(bank.get('star')?.strategyId).toBe('divine-border-rares')
    expect(selectStrategySolvePool(pool, meatfish, ALL_ON).solvePool).toHaveLength(1)
  })

  it('a keep count of zero releases the type entirely', () => {
    const pool = [chart({ uid: 'frac', modIds: ['voy-fracture'] })]
    expect(selectStrategySolvePool(pool, null, ALL_ON).solvePool).toHaveLength(0)
    expect(
      selectStrategySolvePool(pool, null, ALL_ON, new Set(), {
        [keyOf('No-Equipment (or Fracture) chart')]: 0,
      }).solvePool,
    ).toHaveLength(1)
  })

  it('protection toggles gate their strategies\' banks', () => {
    const pool = [chart({ uid: 'wisp', modIds: ['adj-wisps-1'] })]
    expect(selectStrategySolvePool(pool, null, ALL_ON).solvePool).toHaveLength(0)
    expect(
      selectStrategySolvePool(pool, null, { divine: true, meatfish: false, ethereal: false })
        .solvePool,
    ).toHaveLength(1)
  })

  it('locked charts always stay spendable', () => {
    const pool = [chart({ uid: 'locked-rare', modIds: ['adj-rare-2'] })]
    const { solvePool } = selectStrategySolvePool(
      pool,
      null,
      ALL_ON,
      new Set(['locked-rare']),
    )
    expect(solvePool).toHaveLength(1)
  })

  it('sizes a shared family knob for the hungriest strategy', () => {
    // Ethereal wants 3 lanterns even though Meatfish's knob asks for 2
    const lanternKnob = PIECE_TYPES.find(
      (p) => p.banks && p.modIds?.length === 1 && p.modIds[0] === 'adj-lantern',
    )
    expect(lanternKnob?.defaultKeep).toBe(3)
    // Ethereal wants 4 wisps; the Pantheon-or-Wisp family knob covers them
    const wispKnob = PIECE_TYPES.find(
      (p) => p.banks && p.modIds?.includes('adj-wisps-1'),
    )
    expect(wispKnob?.defaultKeep).toBe(4)
    const lanterns = Array.from({ length: 5 }, (_, i) =>
      chart({ uid: `l${i}`, modIds: ['adj-lantern'] }),
    )
    const { solvePool } = selectStrategySolvePool(lanterns, null, ALL_ON)
    expect(solvePool).toHaveLength(2)
  })

  it('banks Sea-Pillar charts by destination', () => {
    const pool = [chart({ uid: 'pillar', areaType: 'sea-pillars' as ChartAreaType })]
    const bank = selectPieceBank(pool, {}, ALL_ON)
    expect(bank.get('pillar')?.strategyId).toBe('divine-border-rares')
  })
})

describe('strategy pool limits (issue #49)', () => {
  const anchorfield = strategyById.get('anchorfield-fishing')!

  it('offers only the single best Anchorfield to Anchorfield Fishing', () => {
    const pool = [
      chart({ uid: 'a-weak', areaType: 'anchorfield' as ChartAreaType }),
      chart({
        uid: 'a-best',
        areaType: 'anchorfield' as ChartAreaType,
        rewards: [{ stat: 'quantity', percent: 80 }],
      }),
      chart({
        uid: 'a-mid',
        areaType: 'anchorfield' as ChartAreaType,
        rewards: [{ stat: 'quantity', percent: 40 }],
      }),
      chart({ uid: 'junk', modIds: ['voy-quant-1'] }),
    ]
    const { solvePool } = selectStrategySolvePool(pool, anchorfield, ALL_ON)
    const anchors = solvePool.filter((c) => c.areaType === 'anchorfield')
    expect(anchors.map((c) => c.uid)).toEqual(['a-best'])
    expect(solvePool.map((c) => c.uid)).toContain('junk')
  })

  it('locked charts bypass the cap but still count toward it', () => {
    const pool = [
      chart({ uid: 'a-locked', areaType: 'anchorfield' as ChartAreaType }),
      chart({
        uid: 'a-best',
        areaType: 'anchorfield' as ChartAreaType,
        rewards: [{ stat: 'quantity', percent: 80 }],
      }),
    ]
    const { solvePool } = selectStrategySolvePool(
      pool,
      anchorfield,
      ALL_ON,
      new Set(['a-locked']),
    )
    const anchors = solvePool.filter((c) => c.areaType === 'anchorfield')
    expect(anchors.map((c) => c.uid)).toEqual(['a-locked'])
  })

  it('applies no cap when the strategy defines no limits', () => {
    const pool = [
      chart({ uid: 'a1', areaType: 'anchorfield' as ChartAreaType }),
      chart({ uid: 'a2', areaType: 'anchorfield' as ChartAreaType }),
    ]
    const { solvePool } = selectStrategySolvePool(pool, { id: 'anchorfield-fishing' }, ALL_ON)
    expect(solvePool.filter((c) => c.areaType === 'anchorfield')).toHaveLength(2)
  })
})
