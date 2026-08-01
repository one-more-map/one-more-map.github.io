import { BORDER_MODS } from '../data/mods'
import { KOREAN_BORDER_MOD_EVIDENCE } from '../data/borderMods.ko'
import type { Borders } from '../types'
import { emptyBorders } from '../types'

const BORDER_BLOCK =
  /===\s*VOYAGE BORDER\s+(\d{1,2})\s*===\s*([\s\S]*?)===\s*END VOYAGE BORDER\s*===/gi

const normalize = (text: string): string =>
  text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’`]/g, "'")
    // Korean client text joins counters to their number (for example `8개`).
    // Split letter/number boundaries so the numeric-tier guard below can
    // still distinguish otherwise identical border tiers.
    .replace(/(\p{L})(\p{N})/gu, '$1 $2')
    .replace(/(\p{N})(\p{L})/gu, '$1 $2')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    // the game writes "drop an additional Scarab" where datamined lists say
    // "drop 1 additional Scarabs" - treat the article as the numeral so the
    // numeric-tier guard doesn't reject the singular wording
    .replace(/\ban\b/g, '1')

interface BorderMatchVariant {
  id: string
  canonicalText: string
  matchText: string
}

const borderMatchVariants: BorderMatchVariant[] = BORDER_MODS.flatMap((mod) => {
  const korean = KOREAN_BORDER_MOD_EVIDENCE[mod.id as keyof typeof KOREAN_BORDER_MOD_EVIDENCE]
  return [
    { id: mod.id, canonicalText: mod.text, matchText: mod.text },
    ...(korean
      ? [{ id: mod.id, canonicalText: mod.text, matchText: korean.text }]
      : []),
  ]
})

const borderTokenFrequency = new Map<string, number>()
for (const variant of borderMatchVariants) {
  const uniqueTokens = new Set(normalize(variant.matchText).split(' ').filter(Boolean))
  for (const token of uniqueTokens) {
    borderTokenFrequency.set(token, (borderTokenFrequency.get(token) ?? 0) + 1)
  }
}

function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 99
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const next = [i]
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      next[j] = Math.min(next[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    prev = next
  }
  return prev[b.length]
}

function tokenMatches(expected: string, actual: string): boolean {
  if (expected === actual) return true
  if (/^\d+$/.test(expected) || /^\d+$/.test(actual)) return false
  const korean = /[\u3131-\u318e\uac00-\ud7a3]/u
  if (korean.test(expected) || korean.test(actual)) {
    if (expected.length < 2 || actual.length < 2) return false
    const allowance = expected.length >= 6 ? 2 : 1
    return editDistance(expected, actual) <= allowance
  }
  if (expected.length < 5 || actual.length < 5) return false
  const allowance = expected.length >= 9 ? 2 : 1
  return editDistance(expected, actual) <= allowance
}

function signatureToken(token: string): boolean {
  if (/^\d+$/.test(token)) return false
  const isKorean = /[\u3131-\u318e\uac00-\ud7a3]/u.test(token)
  // One-syllable Korean nouns such as `게` (Crab) are highly distinctive.
  // Keep them as exact-only signatures; tokenMatches deliberately does not
  // fuzzy-match Korean tokens shorter than two syllables.
  return token.length >= (isKorean ? 1 : 4)
}

function candidateLines(raw: string): string[] {
  const lines = raw
    .split(/\r?\n/)
    .map(normalize)
    .filter(Boolean)
  const candidates = new Set(lines)
  for (let i = 0; i < lines.length; i++) {
    if (i + 1 < lines.length) candidates.add(`${lines[i]} ${lines[i + 1]}`)
    if (i + 2 < lines.length) candidates.add(`${lines[i]} ${lines[i + 1]} ${lines[i + 2]}`)
  }
  if (lines.length === 0) {
    const whole = normalize(raw)
    if (whole) candidates.add(whole)
  }
  return [...candidates]
}

interface Match {
  id: string
  text: string
  confidence: number
  exact: boolean
}

function matchBorder(raw: string): Match | null {
  const candidates = candidateLines(raw)
  if (candidates.length === 0) return null

  const scored = borderMatchVariants.flatMap((variant) => {
    const expected = normalize(variant.matchText)
    const expectedTokens = expected.split(' ')
    const expectedNumbers = expectedTokens.filter((token) => /^\d+$/.test(token))

    return candidates.map((candidate) => {
      const exact = candidate === expected
      if (exact) {
        return {
          id: variant.id,
          text: variant.canonicalText,
          confidence: 1,
          exact,
        }
      }

      const actualTokens = candidate.split(' ')
      const signatureTokens = expectedTokens.filter(
        (token) =>
          signatureToken(token) &&
          (borderTokenFrequency.get(token) ?? 0) <= 3,
      )
      const hasSignatureMatch =
        signatureTokens.length === 0 ||
        signatureTokens.some((token) =>
          actualTokens.some((actual) => tokenMatches(token, actual)),
        )
      if (!hasSignatureMatch) {
        return {
          id: variant.id,
          text: variant.canonicalText,
          confidence: 0,
          exact,
        }
      }

      const matchedExpected = expectedTokens.filter((token) =>
        actualTokens.some((actual) => tokenMatches(token, actual)),
      ).length
      const matchedActual = actualTokens.filter((token) =>
        expectedTokens.some((expectedToken) => tokenMatches(expectedToken, token)),
      ).length
      const recall = matchedExpected / expectedTokens.length
      const precision = matchedActual / actualTokens.length
      let confidence =
        recall + precision === 0 ? 0 : (2 * recall * precision) / (recall + precision)

      // Tiers often differ only by a number. Never guess a tier when OCR did
      // not read that number from the same tooltip line.
      if (
        expectedNumbers.length > 0 &&
        !expectedNumbers.every((number) => actualTokens.includes(number))
      ) {
        confidence *= 0.6
      }
      return {
        id: variant.id,
        text: variant.canonicalText,
        confidence,
        exact,
      }
    })
  })

  scored.sort(
    (a, b) => Number(b.exact) - Number(a.exact) || b.confidence - a.confidence,
  )
  const best = scored[0]
  const runnerUp = scored.find((item) => item.id !== best.id)
  if (best.confidence < 0.72) return null
  if (!best.exact && runnerUp && best.confidence - runnerUp.confidence < 0.04) return null
  return best
}

export interface BorderOcrMatch {
  index: number
  id: string
  text: string
  confidence: number
}

export interface BorderOcrMiss {
  index: number
  raw: string
}

export interface BorderOcrParseResult {
  /** Clipboard payload with OCR blocks removed, ready for the chart parser. */
  chartText: string
  /** Only recognized positions are populated. */
  borders: Borders
  matches: BorderOcrMatch[]
  misses: BorderOcrMiss[]
  blockCount: number
}

export function parseBorderOcrPayload(source: string): BorderOcrParseResult {
  const borders = emptyBorders()
  const matches: BorderOcrMatch[] = []
  const misses: BorderOcrMiss[] = []
  let blockCount = 0

  const chartText = source.replace(BORDER_BLOCK, (_block, indexText: string, raw: string) => {
    blockCount++
    const index = Number.parseInt(indexText, 10)
    if (index < 0 || index >= 12) return '\n'

    const match = matchBorder(raw)
    if (match) {
      borders[index] = match.id
      matches.push({ index, ...match })
    } else {
      misses.push({ index, raw: raw.trim() })
    }
    return '\n'
  })

  return { chartText, borders, matches, misses, blockCount }
}
