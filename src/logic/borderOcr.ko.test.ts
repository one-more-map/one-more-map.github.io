import { describe, expect, it } from 'vitest'
import ahkImporter from '../../public/voyage-import.ahk?raw'
import { KOREAN_BORDER_MOD_EVIDENCE } from '../data/borderMods.ko'
import { borderModById } from '../data/mods'
import { parseBorderOcrPayload } from './borderOcr'

const block = (text: string, index = 0) =>
  `=== VOYAGE BORDER ${index} ===\n${text}\n=== END VOYAGE BORDER ===`

describe('Korean border OCR matching', () => {
  it('maps all confirmed Korean evidence to its canonical border id and text', () => {
    for (const [id, evidence] of Object.entries(KOREAN_BORDER_MOD_EVIDENCE)) {
      const result = parseBorderOcrPayload(block(evidence.text))
      const canonical = borderModById.get(id)

      expect(result.misses, id).toEqual([])
      expect(result.matches, id).toHaveLength(1)
      expect(result.matches[0].id, id).toBe(id)
      expect(result.matches[0].text, id).toBe(canonical?.text)
      expect(result.borders[0], id).toBe(id)
    }
  })

  it('joins the observed two-line quantity-per-connection tooltip', () => {
    const result = parseBorderOcrPayload(
      block(KOREAN_BORDER_MOD_EVIDENCE['b-quantconn-2'].text),
    )

    expect(result.matches[0]).toMatchObject({ id: 'b-quantconn-2', exact: true })
  })

  it('tolerates the observed one-syllable Korean OCR error', () => {
    const rarity = KOREAN_BORDER_MOD_EVIDENCE['b-rarity-2'].text.replace(
      '희귀도',
      '회귀도',
    )
    const rareMonsters = KOREAN_BORDER_MOD_EVIDENCE['b-rare-2'].text.replace(
      '희귀',
      '회귀',
    )
    const treasureAnchors = KOREAN_BORDER_MOD_EVIDENCE['b-anchor-1'].text.replace(
      '닻',
      '닺',
    )
    const blessedOrbs = KOREAN_BORDER_MOD_EVIDENCE['b-blessed'].text.replace(
      '희귀',
      '회귀',
    )

    expect(parseBorderOcrPayload(block(rarity)).matches[0]?.id).toBe('b-rarity-2')
    expect(parseBorderOcrPayload(block(rareMonsters)).matches[0]?.id).toBe('b-rare-2')
    expect(parseBorderOcrPayload(block(treasureAnchors)).matches[0]?.id).toBe(
      'b-anchor-1',
    )
    expect(parseBorderOcrPayload(block(blessedOrbs)).matches[0]?.id).toBe('b-blessed')
  })

  it('normalizes Korean punctuation and spacing around numeric counters', () => {
    const noisy = '인접 지역들에서 발견하는 아이템 희귀도: 75 % 증폭'
    const result = parseBorderOcrPayload(block(noisy))

    expect(result.matches[0]?.id).toBe('b-rarity-2')
  })

  it('does not guess an unobserved numeric tier', () => {
    const result = parseBorderOcrPayload(
      block('인접 지역들 내 희귀 몬스터 수 80% 증가'),
    )

    expect(result.matches).toEqual([])
    expect(result.misses).toHaveLength(1)
  })

  it('rejects unrelated Korean tooltip text', () => {
    const result = parseBorderOcrPayload(
      block('인접 지역의 몬스터가 완전히 새로운 보상을 떨어뜨림'),
    )

    expect(result.matches).toEqual([])
    expect(result.misses).toHaveLength(1)
  })

  it('does not identify a truncated generic pack line as the one-syllable Crab mod', () => {
    const result = parseBorderOcrPayload(block('무리 8개 추가 등장'))

    expect(result.matches).toEqual([])
    expect(result.misses).toHaveLength(1)
  })
})

describe('Korean Windows OCR selection in the AHK importer', () => {
  it('detects the Korean PoE executable and passes a language hint to the helper', () => {
    expect(ahkImporter).toContain('PreferredOcrLanguage()')
    expect(ahkImporter).toContain('WinGetProcessName(PoeWinTitle)')
    expect(ahkImporter).toContain('RegExMatch(processName, "i)_KG\\.exe$")')
    expect(ahkImporter).toContain('return "ko-KR"')
    expect(ahkImporter).toContain(' -PreferredLanguage ')
  })

  it('accepts both ko and ko-KR Windows recognizer tags before English fallback', () => {
    const preferredBranch = ahkImporter.indexOf(
      "if (-not [string]::IsNullOrWhiteSpace($PreferredLanguage))",
    )
    const englishBranch = ahkImporter.indexOf('$english = @($available')

    expect(preferredBranch).toBeGreaterThan(-1)
    expect(englishBranch).toBeGreaterThan(preferredBranch)
    expect(ahkImporter).toContain("$preferredPrimary = ($preferredTag -split '-', 2)[0]")
    expect(ahkImporter).toContain('$tag -ieq $preferredTag -or $primary -ieq $preferredPrimary')
  })

  it('uses the selected language in image and persistent-server modes', () => {
    const calls = ahkImporter.match(
      /New-OcrEngine -PreferredLanguage \$PreferredLanguage/g,
    )

    expect(calls).toHaveLength(2)
    expect(ahkImporter).toContain('. languageArg')
    expect(ahkImporter).toContain('A_Args.Length >= 3')
  })
})
