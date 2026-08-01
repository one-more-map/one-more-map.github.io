import { describe, expect, it } from 'vitest'
import { borderModById } from './mods'
import { KOREAN_BORDER_MOD_EVIDENCE } from './borderMods.ko'

describe('Korean border-mod evidence', () => {
  it('keeps direct client evidence separate from confirmed numeric variants', () => {
    const entries = Object.entries(KOREAN_BORDER_MOD_EVIDENCE)

    expect(entries).toHaveLength(45)
    expect(entries.filter(([, entry]) => entry.source === 'client-screenshot')).toHaveLength(24)
    expect(
      entries.filter(([, entry]) => entry.source === 'confirmed-numeric-variant'),
    ).toHaveLength(21)
  })

  it('only references implemented canonical border-mod ids', () => {
    for (const id of Object.keys(KOREAN_BORDER_MOD_EVIDENCE)) {
      expect(borderModById.has(id), id).toBe(true)
    }
  })

  it('derives numeric variants only from direct evidence with the same wording', () => {
    const withoutNumbers = (text: string) => text.replace(/\d+/g, '#')

    for (const [id, entry] of Object.entries(KOREAN_BORDER_MOD_EVIDENCE)) {
      if (entry.source !== 'confirmed-numeric-variant') continue

      const derivedFrom = 'derivedFrom' in entry ? entry.derivedFrom : undefined
      expect(derivedFrom, id).toBeTruthy()
      const source = KOREAN_BORDER_MOD_EVIDENCE[
        derivedFrom as keyof typeof KOREAN_BORDER_MOD_EVIDENCE
      ]
      expect(source?.source, id).toBe('client-screenshot')
      expect(withoutNumbers(entry.text), id).toBe(withoutNumbers(source.text))
    }
  })

  it('preserves exact client wording and line order for the newest samples', () => {
    expect(KOREAN_BORDER_MOD_EVIDENCE['b-octoboss'].text).toBe(
      '인접 지역들에 오물더듬이 등장',
    )
    expect(KOREAN_BORDER_MOD_EVIDENCE['b-vaal'].text).toBe(
      '인접 지역들 내 희귀 몬스터가 바알 오브 1개를 추가로 떨어뜨림',
    )
    expect(KOREAN_BORDER_MOD_EVIDENCE['b-crabs-1'].text).toBe(
      '인접 지역에 게 무리 8개 추가 등장',
    )
    expect(KOREAN_BORDER_MOD_EVIDENCE['b-lanterns'].text).toBe(
      '등불을 배치해도 인접 지역들의 등불 개수가 감소하지 않음',
    )
    expect(KOREAN_BORDER_MOD_EVIDENCE['b-quantconn-2'].text).toBe(
      '연결 하나당 인접 지역들에서 발견하는 아이템 수량 50% 감소\n인접 지역들에서 발견하는 아이템 수량 180% 증가',
    )
    expect(KOREAN_BORDER_MOD_EVIDENCE['b-rarity-2'].text).toBe(
      '인접 지역들에서 발견하는 아이템 희귀도 75% 증폭',
    )
    expect(KOREAN_BORDER_MOD_EVIDENCE['b-drowned-3'].text).toBe(
      '인접 지역에 물에 빠진 자 무리 16개 추가 등장',
    )
    expect(KOREAN_BORDER_MOD_EVIDENCE['b-exp-1'].text).toBe(
      '인접 지역들 내 플레이어들이 획득하는 경험치 100% 증가',
    )
    expect(KOREAN_BORDER_MOD_EVIDENCE['b-gold-1']).toEqual({
      text: '인접 지역 내 몬스터가 떨어뜨리는 장비의 25%가 골드로 전환',
      source: 'client-screenshot',
    })
    expect(KOREAN_BORDER_MOD_EVIDENCE['b-quantconn-1']).toEqual({
      text: '연결 하나당 인접 지역들에서 발견하는 아이템 수량 50% 감소\n인접 지역들에서 발견하는 아이템 수량 120% 증가',
      source: 'client-screenshot',
    })
    expect(KOREAN_BORDER_MOD_EVIDENCE['b-crabboss'].text).toBe(
      '인접 지역에 지휘관의 파멸 등장',
    )
    expect(KOREAN_BORDER_MOD_EVIDENCE['b-scarab-1'].text).toBe(
      '인접 지역들에서 발견하는 갑충석 50% 증폭',
    )
    expect(KOREAN_BORDER_MOD_EVIDENCE['b-sulphdrop'].text).toBe(
      '인접 지역들 내 희귀 몬스터가 망자의 유황을 떨어뜨림',
    )
    expect(KOREAN_BORDER_MOD_EVIDENCE['b-scarabdrop'].text).toBe(
      '인접 지역 내 희귀 몬스터가 갑충석 1개를 추가로 떨어뜨림',
    )
    expect(KOREAN_BORDER_MOD_EVIDENCE['b-ancient'].text).toBe(
      '인접 지역 내 희귀 몬스터가 고대의 오브 1개를 추가로 떨어뜨림',
    )
  })
})
