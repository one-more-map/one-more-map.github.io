import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import koreanChart from '../logic/__fixtures__/charted.ko.txt?raw'
import { parseChartText } from '../logic/parser'
import type { ChartData } from '../types'
import { emptyBorders } from '../types'
import { StrategiesPanel } from './StrategiesPanel'

const BASE_KOREAN_IMPLICIT =
  '인접 지역 내 몬스터가 떨어뜨리는 장비의 40%가 골드로 전환'

function parseKoreanImplicit(implicit: string): ChartData {
  const result = parseChartText(koreanChart.replace(BASE_KOREAN_IMPLICIT, implicit))

  expect(result.rejected).toEqual([])
  expect(result.charts).toHaveLength(1)
  return result.charts[0]
}

function parseKoreanArea(area: string): ChartData {
  const result = parseChartText(koreanChart.replace('해저 마루', area))

  expect(result.rejected).toEqual([])
  expect(result.charts).toHaveLength(1)
  return result.charts[0]
}

function renderStrategy(
  activeId: string,
  pool: ChartData[],
  centerChoice?: Record<string, string>,
): string {
  return renderToStaticMarkup(
    <StrategiesPanel
      activeId={activeId}
      pool={pool}
      borders={emptyBorders()}
      onSelect={() => undefined}
      centerChoice={centerChoice}
    />,
  )
}

describe('Korean clipboard aliases feed strategy readiness', () => {
  it('counts an observed Korean Diviner chart for Speedrun', () => {
    const diviner = parseKoreanImplicit('인접 지역들에 예언자의 금고 3개 추가 등장')

    expect(diviner.modIds).toEqual(['adj-divbox-2'])

    const html = renderStrategy('milky-speedrun', [diviner])

    expect(html).toContain('class="strat-ready"')
    expect(html).toContain('1/1× Diviner’s / Operative’s / Message chart (centre)')
  })

  it('counts the observed Korean Message chart for Speedrun', () => {
    const message = parseKoreanImplicit(
      '인접 지역들에 병 안의 서신 2개 추가 등장 — 변경이 불가능한 값',
    )

    expect(message.modIds).toEqual(['adj-msg-2'])

    const html = renderStrategy('milky-speedrun', [message])

    expect(html).toContain('class="strat-ready"')
    expect(html).toContain('1/1× Diviner’s / Operative’s / Message chart (centre)')
  })

  it('centre pick narrows Speedrun readiness to the chosen family (issue #49)', () => {
    const diviner = parseKoreanImplicit('인접 지역들에 예언자의 금고 3개 추가 등장')
    expect(diviner.modIds).toEqual(['adj-divbox-2'])

    // a Diviner chart satisfies the default...
    const anyHtml = renderStrategy('milky-speedrun', [diviner])
    expect(anyHtml).toContain('class="strat-ready"')

    // ...but not a Message-only centre pick
    const msgHtml = renderStrategy('milky-speedrun', [diviner], { 'milky-speedrun': 'msg' })
    expect(msgHtml).toContain('Centre chart')
    expect(msgHtml).toContain('class="strat-notready"')
    expect(msgHtml).toContain('1× Message chart (centre)')
  })

  it('subtracts Korean Wisp and Golden Lantern charts from Magic Ethereal shortages', () => {
    const wisp = parseKoreanImplicit(
      '몬스터가 일정 확률로 야생림 도깨비불 2000마리로 강화',
    )
    const lantern = parseKoreanImplicit('인접 지역들에 황금 등불 4개 추가 등장')

    expect(wisp.modIds).toEqual(['adj-wisps-1'])
    expect(lantern.modIds).toEqual(['adj-lantern'])

    const html = renderStrategy('milky-ethereal', [wisp, lantern])

    expect(html).toContain('class="strat-notready"')
    expect(html).toContain('3× Wildwood Wisp chart')
    expect(html).toContain('2× Golden Lantern chart')
  })

  it('counts Korean Sea Pillars by destination instead of the rare Chart name', () => {
    const first = parseKoreanArea('바다 기둥')
    const second = { ...first, uid: `${first.uid}-second` }

    expect(first.name).not.toMatch(/pillar/i)
    expect(first.areaType).toBe('sea-pillars')
    expect(renderStrategy('milky-meatfish', [first])).toContain(
      '1× Sea-Pillar chart (corners)',
    )
    expect(renderStrategy('milky-meatfish', [first, second])).not.toContain(
      '1× Sea-Pillar chart (corners)',
    )
  })

  it('counts a Korean Pelagic Abyss for the Divine Strongboxes strategy', () => {
    const ordinary = parseKoreanArea('해저 마루')
    const pelagic = parseKoreanArea('원양 심연')

    expect(pelagic.name).not.toMatch(/pelagic/i)
    expect(pelagic.areaType).toBe('pelagic-abyss')
    expect(renderStrategy('cutedog-divine-boxes', [ordinary])).toContain(
      '1× Pelagic Abyss chart (high pack size)',
    )
    expect(renderStrategy('cutedog-divine-boxes', [pelagic])).not.toContain(
      '1× Pelagic Abyss chart (high pack size)',
    )
  })
})
