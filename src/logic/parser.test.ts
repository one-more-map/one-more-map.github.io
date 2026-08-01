import { describe, expect, it } from 'vitest'
import { CHART_AREAS } from '../data/chartAreas'
import type { ChartData, Edges } from '../types'
import englishChart from './__fixtures__/charted.en.txt?raw'
import koreanChart from './__fixtures__/charted.ko.txt?raw'
import latestKoreanCharts from './__fixtures__/charted.latest.ko.txt?raw'
import koreanImplicitAliases from './__fixtures__/implicit-aliases.ko.tsv?raw'
import koreanNumericTierAliases from './__fixtures__/numeric-tier-aliases.ko.tsv?raw'
import koreanUncharted from './__fixtures__/uncharted.ko.txt?raw'
import { isChartClipboardText, parseChartText } from './parser'

const KOREAN_CHARTED_IMPLICIT =
  '인접 지역 내 몬스터가 떨어뜨리는 장비의 40%가 골드로 전환'

interface KoreanImplicitAliasCase {
  rawText: string
  modId: string
  occurrences: number
}

const koreanImplicitAliasCases: KoreanImplicitAliasCase[] = koreanImplicitAliases
  .split(/\r?\n/)
  .filter((line) => line && !line.startsWith('#'))
  .map((line) => {
    const [rawText, modId, occurrencesText] = line.split('\t')
    if (!rawText || !modId || !occurrencesText) {
      throw new Error(`Malformed Korean implicit alias fixture row: ${line}`)
    }
    return { rawText, modId, occurrences: Number(occurrencesText) }
  })

const koreanNumericTierAliasCases = koreanNumericTierAliases
  .split(/\r?\n/)
  .filter((line) => line && !line.startsWith('#'))
  .map((line) => {
    const [rawText, modId] = line.split('\t')
    if (!rawText || !modId) {
      throw new Error(`Malformed Korean numeric-tier alias fixture row: ${line}`)
    }
    return { rawText, modId }
  })

function parseOnlyChart(text: string): ChartData {
  const result = parseChartText(text)
  expect(result.rejected).toEqual([])
  expect(result.charts).toHaveLength(1)
  return result.charts[0]
}

describe('parseChartText', () => {
  it('preserves existing English chart parsing', () => {
    const chart = parseOnlyChart(englishChart)

    expect(chart).toMatchObject({
      name: 'Armoured Coral Reef Chart of Ice',
      level: 63,
      areaType: 'undersea-groves',
      shape: 'Corner',
      edges: [true, true, false, false],
      implicitText: "20% increased Dead Man's Sulphur found in this Area",
      modIds: ['voy-sulph-2'],
      rewards: [
        { stat: 'quantity', percent: 20 },
        { stat: 'gold', percent: 50 },
      ],
      rawText: '+8% Monster Physical Damage Reduction',
    })
  })

  it('imports a real Korean-client chart into canonical ids and shape names', () => {
    const chart = parseOnlyChart(koreanChart)

    expect(chart).toMatchObject({
      name: '해병 고역 산호 암초 해도',
      level: 81,
      areaType: 'seafloor-ridges',
      shape: 'Junction',
      edges: [true, true, true, false],
      implicitText: '인접 지역 내 몬스터가 떨어뜨리는 장비의 40%가 골드로 전환',
      modIds: ['adj-gold-1'],
      rewards: [
        { stat: 'quantity', percent: 32 },
        { stat: 'rarity', percent: 20 },
        { stat: 'sulphur', percent: 30 },
        { stat: 'packsize', percent: 16 },
      ],
    })
    expect(chart.rawText).toContain('몬스터가 19(15-20)%의 추가 물리 피해를 냉기 속성으로 가함')
    expect(chart.rawText).not.toContain('해저 마루')
    expect(chart.rawText).not.toContain('이 지역에서 발견하는 망자의 유황 30% 증가')
  })

  it('imports the three latest Korean-client charts as a batch', () => {
    const result = parseChartText(latestKoreanCharts)

    expect(result.rejected).toEqual([])
    expect(result.charts).toHaveLength(3)
    expect(result.charts[0]).toMatchObject({
      name: '뱃사람의 항해 산호 숲 해도',
      level: 83,
      areaType: 'sea-pillars',
      shape: 'Straight',
      modIds: ['adj-magic-1'],
    })
    expect(result.charts[0].rewards).toHaveLength(3)
    expect(result.charts[0].rewards).toEqual(
      expect.arrayContaining([
        { stat: 'packsize', percent: 36 },
        { stat: 'gold', percent: 50 },
        { stat: 'sulphur', percent: 75 },
      ]),
    )
    expect(result.charts[0].rawText).toContain(
      '몬스터가 물리 피해의 25(21-29)%를 추가 카오스 피해로 획득',
    )
    expect(result.charts[1]).toMatchObject({
      name: '염수 기행 산호 숲 해도',
      level: 83,
      areaType: 'pelagic-abyss',
      shape: 'Crossing',
      modIds: ['adj-divbox-2'],
    })
    expect(result.charts[1].rewards).toHaveLength(3)
    expect(result.charts[1].rewards).toEqual(
      expect.arrayContaining([
        { stat: 'quantity', percent: 55 },
        { stat: 'rarity', percent: 38 },
        { stat: 'sulphur', percent: 60 },
      ]),
    )
    expect(result.charts[1].rawText).toContain(
      '몬스터의 물리 피해 감소 +32(21-35)%',
    )
    expect(result.charts[2]).toMatchObject({
      name: '해양의 항해 산호 암초 해도',
      level: 83,
      areaType: 'seafloor-ridges',
      shape: 'Junction',
      modIds: ['adj-crab-1'],
      rewards: [
        { stat: 'quantity', percent: 150 },
        { stat: 'packsize', percent: 18 },
      ],
    })
    expect(result.charts[2].implicitText).toBe('인접 지역에 게 무리 8(8-10)개 추가 등장')
  })

  it('parses the Korean Gold Found header observed in supplied clipboard text', () => {
    const chart = parseOnlyChart(
      koreanChart.replace(
        '망자의 유황: +30% (augmented)',
        '골드 발견량: +70% (augmented)\n망자의 유황: +30% (augmented)',
      ),
    )

    expect(chart.rewards).toContainEqual({ stat: 'gold', percent: 70 })
  })

  const shapeCases: [string, string, string, Edges][] = [
    ['End', 'End', '끄트머리', [true, false, false, false]],
    ['Corner', 'Corner', '모서리', [true, true, false, false]],
    ['Straight', 'Straight', '직선', [true, false, true, false]],
    ['Junction', 'Junction', '접점', [true, true, true, false]],
    ['Crossing', 'Crossing', '교차', [true, true, true, true]],
  ]

  const areaCases = CHART_AREAS.map(
    ({ id, english, korean }) => [id, english, korean] as const,
  )

  it('keeps the complete verified English/Korean destination table', () => {
    expect(CHART_AREAS).toHaveLength(15)
    expect(new Set(CHART_AREAS.map(({ id }) => id)).size).toBe(15)
    expect(new Set(CHART_AREAS.map(({ english }) => english)).size).toBe(15)
    expect(new Set(CHART_AREAS.map(({ korean }) => korean)).size).toBe(15)
  })

  it.each(areaCases)(
    'maps English and Korean %s destinations to the same canonical area type',
    (id, english, korean) => {
      const englishParsed = parseOnlyChart(
        englishChart.replace('Undersea Groves', english),
      )
      const koreanParsed = parseOnlyChart(koreanChart.replace('해저 마루', korean))

      expect(englishParsed.areaType).toBe(id)
      expect(koreanParsed.areaType).toBe(id)
    },
  )

  it('keeps a chart with an unknown future destination without guessing its type', () => {
    const chart = parseOnlyChart(koreanChart.replace('해저 마루', '아직 등록되지 않은 지역'))

    expect(chart.areaType).toBeUndefined()
    expect(chart.rawText).not.toContain('아직 등록되지 않은 지역')
  })

  it.each(shapeCases)(
    'maps English and Korean %s shapes to the same canonical value',
    (canonical, englishShape, koreanShape, edges) => {
      const english = parseOnlyChart(
        englishChart.replace('Chart Shape: Corner', `Chart Shape: ${englishShape}`),
      )
      const korean = parseOnlyChart(
        koreanChart.replace('해도 형태: 접점', `해도 형태: ${koreanShape}`),
      )

      expect(english).toMatchObject({ shape: canonical, edges })
      expect(korean).toMatchObject({ shape: canonical, edges })
    },
  )

  it('imports mixed English and Korean CRLF clipboard batches', () => {
    const mixed = `\uFEFF${englishChart.trim()}\n${koreanChart.trim()}`.replace(/\n/g, '\r\n')
    const result = parseChartText(mixed)

    expect(result.rejected).toEqual([])
    expect(result.charts.map(({ name, shape }) => ({ name, shape }))).toEqual([
      { name: 'Armoured Coral Reef Chart of Ice', shape: 'Corner' },
      { name: '해병 고역 산호 암초 해도', shape: 'Junction' },
    ])
  })

  it('keeps non-Chart Korean items out of mixed clipboard batches', () => {
    const nonChart = `아이템 종류: 갑옷
아이템 희귀도: 희귀
해병 갑옷
--------`
    const result = parseChartText(`${nonChart}\n${koreanChart}`)

    expect(result.charts).toHaveLength(1)
    expect(result.charts[0].name).toBe('해병 고역 산호 암초 해도')
    expect(result.rejected).toEqual([{ name: '해병 갑옷', reason: 'not a Chart item' }])
  })

  it('rejects an unknown shape without blocking valid items in the same batch', () => {
    const unknownShape = koreanChart.replace('해도 형태: 접점', '해도 형태: 소용돌이')
    const result = parseChartText(`${unknownShape}\n${englishChart}`)

    expect(result.charts).toHaveLength(1)
    expect(result.charts[0].name).toBe('Armoured Coral Reef Chart of Ice')
    expect(result.rejected).toEqual([
      { name: '해병 고역 산호 암초 해도', reason: 'unknown 해도 형태: 소용돌이' },
    ])
  })

  it('rejects a missing shape instead of guessing a connector layout', () => {
    const result = parseChartText(koreanChart.replace(/^해도 형태: 접점\r?\n/m, ''))

    expect(result.charts).toEqual([])
    expect(result.rejected).toEqual([
      { name: '해병 고역 산호 암초 해도', reason: 'missing 해도 형태' },
    ])
  })

  it('preserves the existing English uncharted rejection', () => {
    const result = parseChartText(
      englishChart.replace(
        "20% increased Dead Man's Sulphur found in this Area",
        'Voyage Modifier will be revealed once Charted',
      ),
    )

    expect(result.charts).toEqual([])
    expect(result.rejected[0]?.reason).toBe(
      'not charted yet (run it first to reveal its modifier)',
    )
  })

  it('rejects the full Korean-client uncharted clipboard sample', () => {
    const result = parseChartText(koreanUncharted)

    expect(result.charts).toEqual([])
    expect(result.rejected).toEqual([
      {
        name: '연안 탐사 모래 덮인 해저 해도',
        reason: 'not charted yet (run it first to reveal its modifier)',
      },
    ])
  })

  it('maps all observed Korean implicit lines to canonical ids without changing raw text', () => {
    expect(koreanImplicitAliasCases).toHaveLength(40)
    expect(koreanImplicitAliasCases.reduce((sum, entry) => sum + entry.occurrences, 0)).toBe(65)
    expect(new Set(koreanImplicitAliasCases.map(({ modId }) => modId)).size).toBe(36)

    for (const { rawText, modId } of koreanImplicitAliasCases) {
      const chart = parseOnlyChart(koreanChart.replace(KOREAN_CHARTED_IMPLICIT, rawText))
      expect(chart.modIds, rawText).toEqual([modId])
      expect(chart.implicitText, rawText).toBe(rawText)
    }
  })

  it('uses the invariant range signature for Korean rolled implicit aliases', () => {
    const rangedVariants: Record<string, string[]> = {
      'adj-octo-1': [
        '인접 지역들에 문어 무리 9(8-10)개 추가 등장',
        '인접 지역들에 문어 무리 8(8-10)개 추가 등장',
      ],
      'adj-star-1': [
        '인접 지역들에 에 거대 불가사리 5(4-5)마리 추가 등장',
        '인접 지역들에 에 거대 불가사리 4(4-5)마리 추가 등장',
      ],
      'adj-barrel-1': [
        '인접 지역들에 통 무더기 14(12-15)개 추가 등장',
        '인접 지역들에 통 무더기 15(12-15)개 추가 등장',
      ],
      'adj-barrel-2': [
        '인접 지역들에 통 무더기 17(16-20)개 추가 등장',
        '인접 지역들에 통 무더기 18(16-20)개 추가 등장',
      ],
      'adj-crab-1': ['인접 지역에 게 무리 8(8-10)개 추가 등장'],
    }

    for (const [modId, rawTexts] of Object.entries(rangedVariants)) {
      expect(
        koreanImplicitAliasCases
          .filter((entry) => entry.modId === modId)
          .map(({ rawText }) => rawText),
      ).toEqual(rawTexts)

      for (const rawText of rawTexts) {
        expect(
          parseOnlyChart(koreanChart.replace(KOREAN_CHARTED_IMPLICIT, rawText)).modIds,
          rawText,
        ).toEqual([modId])
      }
    }
  })

  it('maps player-confirmed Korean numeric-tier variants without treating them as corpus observations', () => {
    expect(koreanNumericTierAliasCases).toHaveLength(16)

    for (const { rawText, modId } of koreanNumericTierAliasCases) {
      const chart = parseOnlyChart(koreanChart.replace(KOREAN_CHARTED_IMPLICIT, rawText))
      expect(chart.modIds, rawText).toEqual([modId])
      expect(chart.implicitText, rawText).toBe(rawText)
    }

    const alternateCurrentRolls = [
      ['인접 지역들에 갇힌 몬스터 2(1-2)마리 추가 등장', 'adj-ess-1'],
      ['인접 지역들에 문어 무리 14(11-14)개 추가 등장', 'adj-octo-2'],
      ['인접 지역에 게 무리 10(8-10)개 추가 등장', 'adj-crab-1'],
      ['인접 지역에 게 무리 14(11-14)개 추가 등장', 'adj-crab-2'],
    ] as const

    for (const [rawText, modId] of alternateCurrentRolls) {
      expect(
        parseOnlyChart(koreanChart.replace(KOREAN_CHARTED_IMPLICIT, rawText)).modIds,
        rawText,
      ).toEqual([modId])
    }
  })

  it('preserves the existing level 80 fallback when Area Level is absent', () => {
    const chart = parseOnlyChart(englishChart.replace(/^Area Level: 63\r?\n/m, ''))

    expect(chart.level).toBe(80)
  })

  it('preserves unknown Korean implicits instead of rejecting the chart', () => {
    const unknownImplicit = '아직 등록되지 않은 한국어 항해 속성'
    const chart = parseOnlyChart(
      koreanChart.replace(
        KOREAN_CHARTED_IMPLICIT,
        unknownImplicit,
      ),
    )

    expect(chart.modIds).toEqual([])
    expect(chart.implicitText).toBe(unknownImplicit)
  })
})

describe('isChartClipboardText', () => {
  it('accepts English and Korean Chart headers, including BOM and CRLF text', () => {
    expect(isChartClipboardText(englishChart)).toBe(true)
    expect(isChartClipboardText(`\uFEFF${koreanChart.replace(/\n/g, '\r\n')}`)).toBe(true)
  })

  it('does not intercept non-Chart Korean clipboard text or ordinary prose', () => {
    expect(isChartClipboardText('아이템 종류: 갑옷\n아이템 희귀도: 희귀')).toBe(false)
    expect(isChartClipboardText('일반 문장 안의 아이템 종류: 해도 표기는 붙여넣기로 처리하지 않음')).toBe(false)
  })
})
