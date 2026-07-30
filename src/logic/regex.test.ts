import { describe, expect, it } from 'vitest'
import type { ChartData } from '../types'
import englishChartText from './__fixtures__/charted.en.txt?raw'
import koreanChartText from './__fixtures__/charted.ko.txt?raw'
import { parseChartText } from './parser'
import { buildSingleChartSearch } from './regex'

function parseOne(text: string): ChartData {
  const result = parseChartText(text)
  expect(result.rejected).toEqual([])
  expect(result.charts).toHaveLength(1)
  return result.charts[0]
}

describe('buildSingleChartSearch', () => {
  it('uses the verified Korean Area Level term for a Korean-client chart', () => {
    const search = buildSingleChartSearch(parseOne(koreanChartText))

    expect(search).toBe(
      '해병 고역 산호 암초 해도 인접 지역 내 몬스터가 떨어뜨리는 장비의 40%가 골드로 전환 지역 레벨 81',
    )
    expect(search).toContain('지역 레벨 81')
    expect(search).not.toContain('Level 81')
  })

  it('keeps the existing English Level term for an English-client chart', () => {
    const search = buildSingleChartSearch(parseOne(englishChartText))

    expect(search).toBe(
      "Armoured Coral Reef Chart of Ice 20% increased Dead Man's Sulphur found in this Area Level 63",
    )
    expect(search).toContain('Level 63')
    expect(search).not.toContain('지역 레벨')
  })

  it('detects Korean from an unknown verbatim implicit', () => {
    const chart: ChartData = {
      uid: 'unknown-korean-implicit',
      name: 'Manual Chart',
      level: 81,
      edges: [true, true, true, false],
      modIds: [],
      implicitText: '아직 등록되지 않은 한국어 항해 속성',
    }

    expect(buildSingleChartSearch(chart)).toContain('지역 레벨 81')
  })

  it('defaults Hangul-free manual and demo charts to English', () => {
    const chart: ChartData = {
      uid: 'manual-demo',
      name: 'Demo Chart',
      level: 83,
      edges: [true, false, false, false],
      modIds: ['voy-sulph-2'],
    }

    const search = buildSingleChartSearch(chart)
    expect(search).toBe(
      "Demo Chart 20% increased Dead Man's Sulphur found in this Area Level 83",
    )
    expect(search).toContain('Level 83')
    expect(search).not.toContain('지역 레벨')
  })
})
