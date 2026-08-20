import { describe, expect, it } from 'vitest'
import { applyCenterChoice, strategyById } from './strategies'

describe('applyCenterChoice (issue #49)', () => {
  const speedrun = strategyById.get('milky-speedrun')!

  it('returns the strategy untouched for the default / unknown choice', () => {
    expect(applyCenterChoice(speedrun, undefined)).toBe(speedrun)
    expect(applyCenterChoice(speedrun, 'any')).toBe(speedrun)
    expect(applyCenterChoice(speedrun, 'nonsense')).toBe(speedrun)
  })

  it('gives only the chosen family the centre bonus and blocks the rest', () => {
    const msg = applyCenterChoice(speedrun, 'msg')

    const centreBonus = msg.rules.find((r) => r.bonus === 55)
    expect(centreBonus?.modIds).toEqual(['adj-msg-1', 'adj-msg-2'])

    // the excluded families are actively pushed out of the centre...
    const centreBlock = msg.rules.find((r) => r.bonus === -40 && r.cells?.length === 1)
    expect(centreBlock?.modIds).toEqual(
      expect.arrayContaining(['adj-opbox-1', 'adj-opbox-2', 'adj-divbox-1', 'adj-divbox-2']),
    )
    expect(centreBlock?.modIds).not.toContain('adj-msg-1')

    // ...and every centre family still stays off the other cells
    const offCentre = msg.rules.find((r) => r.bonus === -40 && r.cells?.length === 8)
    expect(offCentre?.modIds).toEqual(
      expect.arrayContaining(['adj-msg-1', 'adj-opbox-1', 'adj-divbox-1']),
    )

    // rules that don't touch centre mods pass through untouched
    expect(msg.rules.some((r) => r.rewardStat?.stat === 'quantity')).toBe(true)
    expect(msg.rules.some((r) => r.nearBorderId === 'b-octoboss')).toBe(true)
  })

  it('readiness asks for the chosen family specifically', () => {
    const div = applyCenterChoice(speedrun, 'divbox')
    expect(div.requirements?.[0].modIds).toEqual(['adj-divbox-1', 'adj-divbox-2'])
    expect(div.requirements?.[0].label).toBe('Diviner’s chart (centre)')
  })

  it('leaves strategies without centre options alone', () => {
    const meatfish = strategyById.get('milky-meatfish')!
    expect(applyCenterChoice(meatfish, 'msg')).toBe(meatfish)
  })
})
