// Chart item-text importer, built against the real PoE 3.29 chart format.
//
// Localization is handled at this parser boundary. Stored modifier ids and
// shape names remain canonical so scoring, strategies and saved state do not
// need to know which client language produced the clipboard text.

import { VOYAGE_MODS } from '../data/mods'
import { chartAreaTypeForText } from '../data/chartAreas'
import type { ChartData, Edges, ModEffect, Stat } from '../types'

let uidCounter = 0
export function newUid(): string {
  uidCounter += 1
  return `c${Date.now().toString(36)}-${uidCounter}`
}

interface ShapeDefinition {
  canonical: string
  edges: Edges
}

interface HeaderStat {
  re: RegExp
  stat: Stat
}

interface ClipboardDialect {
  itemClass: RegExp
  chartClass: RegExp
  rarity: RegExp
  areaLevel: RegExp
  shape: RegExp
  shapeLabel: string
  implicitMarker: RegExp
  uncharted?: RegExp
  headerStats: HeaderStat[]
  shapes: Record<string, ShapeDefinition>
  structural: RegExp
  rewardRider: RegExp
}

/** Connector edges are [N,E,S,W]. Orientation is arbitrary because the solver
 * can rotate charts; only connector count and arrangement matter. */
const END: ShapeDefinition = { canonical: 'End', edges: [true, false, false, false] }
const CORNER: ShapeDefinition = { canonical: 'Corner', edges: [true, true, false, false] }
const STRAIGHT: ShapeDefinition = { canonical: 'Straight', edges: [true, false, true, false] }
const JUNCTION: ShapeDefinition = { canonical: 'Junction', edges: [true, true, true, false] }
const CROSSING: ShapeDefinition = { canonical: 'Crossing', edges: [true, true, true, true] }

const ENGLISH_DIALECT: ClipboardDialect = {
  itemClass: /^[ \t]*Item Class\s*[:：]/im,
  chartClass: /^[ \t]*Item Class\s*[:：]\s*Chart[ \t]*$/im,
  rarity: /^Rarity\s*[:：]/i,
  areaLevel: /^Area Level\s*[:：]\s*(\d+)\s*$/im,
  shape: /^Chart Shape\s*[:：]\s*(.+?)\s*$/im,
  shapeLabel: 'Chart Shape',
  implicitMarker: /^\{\s*Implicit Modifier\s*\}$/i,
  uncharted: /Voyage Modifier will be revealed once Charted/i,
  headerStats: [
    { re: /Item Quantity:\s*\+?(\d+)%/i, stat: 'quantity' },
    { re: /Item Rarity:\s*\+?(\d+)%/i, stat: 'rarity' },
    { re: /Gold Found:\s*\+?(\d+)%/i, stat: 'gold' },
    { re: /Dead Man's Sulphur:\s*\+?(\d+)%/i, stat: 'sulphur' },
    { re: /Pack Size:\s*\+?(\d+)%/i, stat: 'packsize' },
    { re: /Scarabs Found:\s*\+?(\d+)%/i, stat: 'scarabs' },
    { re: /Currency Found:\s*\+?(\d+)%/i, stat: 'currency' },
  ],
  shapes: {
    end: END,
    corner: CORNER,
    straight: STRAIGHT,
    junction: JUNCTION,
    crossing: CROSSING,
    crossroads: CROSSING,
    cross: CROSSING,
  },
  structural:
    /^(?:Item Class\s*[:：]|Rarity\s*[:：]|Area Level\s*[:：]|Item Level\s*[:：]|Requires|Chart Shape\s*[:：]|Take this item|Seafloor|Abyssal|Undersea|Anchorfield|Kishara)/i,
  rewardRider: /found in this Area/i,
}

const KOREAN_DIALECT: ClipboardDialect = {
  itemClass: /^[ \t]*아이템 종류\s*[:：]/im,
  chartClass: /^[ \t]*아이템 종류\s*[:：]\s*해도[ \t]*$/im,
  rarity: /^아이템 희귀도\s*[:：]/i,
  areaLevel: /^지역 레벨\s*[:：]\s*(\d+)\s*$/im,
  shape: /^해도 형태\s*[:：]\s*(.+?)\s*$/im,
  shapeLabel: '해도 형태',
  implicitMarker: /^\{\s*고정 속성 부여\s*\}$/i,
  uncharted: /^해도를 기록하면 항해 속성이 드러남$/im,
  headerStats: [
    { re: /아이템 수량\s*[:：]\s*\+?(\d+)%/i, stat: 'quantity' },
    { re: /아이템 희귀도\s*[:：]\s*\+?(\d+)%/i, stat: 'rarity' },
    { re: /골드 발견량\s*[:：]\s*\+?(\d+)%/i, stat: 'gold' },
    { re: /망자의 유황\s*[:：]\s*\+?(\d+)%/i, stat: 'sulphur' },
    { re: /몬스터 무리 규모\s*[:：]\s*\+?(\d+)%/i, stat: 'packsize' },
  ],
  shapes: {
    끄트머리: END,
    모서리: CORNER,
    직선: STRAIGHT,
    접점: JUNCTION,
    교차: CROSSING,
  },
  structural:
    /^(?:아이템 종류\s*[:：]|아이템 희귀도\s*[:：]|지역 레벨\s*[:：]|아이템 레벨\s*[:：]|요구사항\s*[:：]?|레벨\s*[:：]\s*\d+|해도 형태\s*[:：]|이 지역을 해도로 기록하려면)/i,
  rewardRider: /^이 지역에서 발견하는 .*\d+%\s*증가$/i,
}

const DIALECTS = [ENGLISH_DIALECT, KOREAN_DIALECT]
const ITEM_START_RE = /(?=^[ \t]*(?:Item Class|아이템 종류)\s*[:：])/gim
const SEPARATOR_RE = /^-{3,}$/

function normalizeClipboardText(text: string): string {
  return text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
}

function normalizeLookupText(text: string): string {
  return text.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Alias matching ignores a rolled value when the clipboard also includes
 * its invariant range (for example, both 8(8-10) and 9(8-10) become 8-10).
 * Keep this separate from general lookup normalization: shape lookup and the
 * verbatim implicit text must not be changed by roll normalization. */
function normalizeAliasText(text: string): string {
  return normalizeLookupText(text).replace(
    /\d+(?:\.\d+)?\s*\(\s*(\d+(?:\.\d+)?)\s*[-‐‑‒–—―−~～]\s*(\d+(?:\.\d+)?)\s*\)/g,
    '$1-$2',
  )
}

function dialectForItem(item: string): ClipboardDialect | undefined {
  return DIALECTS.find((dialect) => dialect.itemClass.test(item))
}

/** True when clipboard text contains an English or Korean Chart class header. */
export function isChartClipboardText(text: string): boolean {
  const normalized = normalizeClipboardText(text)
  return DIALECTS.some((dialect) => dialect.chartClass.test(normalized))
}

// Common filler words dropped when matching, so wording/pluralisation/number
// differences between the game text and our stored English text do not block a
// match.
const STOP = new Set(
  (
    'a an the of in on to be by and or per this that all are is it as at with for ' +
    'additional adjacent area areas contain contains contained chance found more less ' +
    'increased reduced number numbers dropped drop drops gain gains will would have has ' +
    'natural inhabitants monster monsters players player instead'
  ).split(/\s+/),
)
const stem = (w: string): string => w.replace(/(es|s)$/, '')

/** Levenshtein distance, capped early - used to tolerate the game's own typos
 * (e.g. the "Qauntity of Items" voyage mod is misspelled in-game). */
function editDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (Math.abs(m - n) > 2) return 99
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    prev = cur
  }
  return prev[n]
}

/** Does the line contain this mod keyword, allowing a near-miss for long words? */
function fuzzyHas(lineWords: Set<string>, w: string): boolean {
  if (lineWords.has(w)) return true
  if (w.length < 5) return false
  for (const lw of lineWords) {
    if (Math.abs(lw.length - w.length) > 2) continue
    if (editDistance(lw, w) <= 2) return true
  }
  return false
}

/** Distinctive English keywords of a mod line (stemmed, filler removed). */
function sigWords(s: string): string[] {
  const out = new Set<string>()
  for (const w of s
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z ]+/g, ' ')
    .split(/\s+/)) {
    if (w.length >= 3 && !STOP.has(w)) out.add(stem(w))
  }
  return [...out]
}

function matchLocalizedAlias(line: string): string | null {
  const normalized = normalizeAliasText(line)
  const matchingIds = new Set<string>()
  for (const mod of VOYAGE_MODS) {
    if (mod.scope === 'self') continue
    if (mod.aliases?.some((alias) => normalizeAliasText(alias) === normalized)) {
      matchingIds.add(mod.id)
    }
  }
  return matchingIds.size === 1 ? [...matchingIds][0] : null
}

/** Match a revealed implicit line against localized aliases first, then retain
 * the existing English fuzzy matcher and its tie-breaking behaviour. */
function matchImplicit(line: string): string | null {
  const aliasId = matchLocalizedAlias(line)
  if (aliasId) return aliasId

  const lineWords = new Set(sigWords(line))
  if (lineWords.size === 0) return null
  const lineNum = parseFloat(line.replace(/\([^)]*\)/g, ' ').match(/\d+/)?.[0] ?? '')
  const scored = VOYAGE_MODS.filter((m) => m.scope !== 'self')
    .map((m) => {
      const mw = sigWords(m.text)
      const covered = mw.filter((w) => fuzzyHas(lineWords, w)).length
      return { m, mwLen: mw.length, ratio: mw.length ? covered / mw.length : 0 }
    })
    .filter((x) => x.ratio >= 0.6)
  if (scored.length === 0) return null
  scored.sort((a, b) => {
    if (b.ratio !== a.ratio) return b.ratio - a.ratio
    if (b.mwLen !== a.mwLen) return b.mwLen - a.mwLen
    if (!isNaN(lineNum)) {
      const an = parseFloat(a.m.text.match(/\d+/)?.[0] ?? 'NaN')
      const bn = parseFloat(b.m.text.match(/\d+/)?.[0] ?? 'NaN')
      return (isNaN(an) ? 1e9 : Math.abs(an - lineNum)) - (isNaN(bn) ? 1e9 : Math.abs(bn - lineNum))
    }
    return 0
  })
  return scored[0].m.id
}

export interface ParseResult {
  charts: ChartData[]
  /** uncharted / unrecognised items skipped, with a reason */
  rejected: { name: string; reason: string }[]
}

export function parseChartText(text: string): ParseResult {
  const items = normalizeClipboardText(text)
    .split(ITEM_START_RE)
    .map((s) => s.trim())
    .filter(Boolean)

  const charts: ChartData[] = []
  const rejected: { name: string; reason: string }[] = []

  for (const item of items) {
    const dialect = dialectForItem(item)
    const lines = item.split('\n').map((line) => line.trim())
    const nameIdx = dialect ? lines.findIndex((line) => dialect.rarity.test(line)) : -1

    // Rare chart names span two lines (rare name + base type); Magic and Normal
    // chart names occupy one line. Keep every line up to the first separator.
    const nameLineIdxs: number[] = []
    if (nameIdx >= 0) {
      for (let i = nameIdx + 1; i < lines.length && !SEPARATOR_RE.test(lines[i]); i++) {
        if (lines[i]) nameLineIdxs.push(i)
      }
    }
    const name = nameLineIdxs.length
      ? nameLineIdxs.map((index) => lines[index]).join(' ')
      : 'Unknown Chart'

    if (!dialect || !dialect.chartClass.test(item)) {
      rejected.push({ name, reason: 'not a Chart item' })
      continue
    }

    if (dialect.uncharted?.test(item)) {
      rejected.push({ name, reason: 'not charted yet (run it first to reveal its modifier)' })
      continue
    }

    // Preserve the existing fallback for malformed/older English input.
    const level = parseInt(item.match(dialect.areaLevel)?.[1] ?? '80', 10)

    const rewards: ModEffect[] = []
    for (const { re, stat } of dialect.headerStats) {
      const match = item.match(re)
      if (match) rewards.push({ stat, percent: parseInt(match[1], 10) })
    }

    const shapeMatch = item.match(dialect.shape)
    const shapeName = shapeMatch?.[1].trim() ?? ''
    if (!shapeName) {
      rejected.push({ name, reason: `missing ${dialect.shapeLabel}` })
      continue
    }
    const shape = dialect.shapes[normalizeLookupText(shapeName)]
    if (!shape) {
      rejected.push({ name, reason: `unknown ${dialect.shapeLabel}: ${shapeName}` })
      continue
    }

    // The revealed implicit is the line under the locale's modifier marker.
    // Unknown modifiers are still imported with their verbatim text preserved.
    const modIds: string[] = []
    let implicitText: string | undefined
    const implicitIdx = lines.findIndex((line) => dialect.implicitMarker.test(line))
    if (implicitIdx >= 0) {
      const implicitLine = lines[implicitIdx + 1] ?? ''
      if (implicitLine && !SEPARATOR_RE.test(implicitLine)) {
        implicitText = implicitLine
        const id = matchImplicit(implicitLine)
        if (id) modIds.push(id)
      }
    }

    const areaLevelIdx = lines.findIndex((line) => dialect.areaLevel.test(line))
    const areaTypeLineIndexes = new Set<number>()
    for (let i = areaLevelIdx - 1; i >= 0; i--) {
      if (SEPARATOR_RE.test(lines[i])) {
        for (let j = i + 1; j < areaLevelIdx; j++) {
          if (lines[j]) areaTypeLineIndexes.add(j)
        }
        break
      }
    }
    const areaTypeText = [...areaTypeLineIndexes]
      .map((index) => lines[index])
      .join(' ')
    const areaType = chartAreaTypeForText(areaTypeText)

    // Keep explicit downside lines as raw text. Header fields, localized area
    // names and self-reward riders are structural and should not be duplicated.
    const nameLineSet = new Set(nameLineIdxs)
    const rawLines = lines.filter(
      (line, index) =>
        line &&
        !nameLineSet.has(index) &&
        !areaTypeLineIndexes.has(index) &&
        index !== implicitIdx + 1 &&
        !SEPARATOR_RE.test(line) &&
        !dialect.structural.test(line) &&
        !/^\{.*\}$/.test(line) &&
        !line.startsWith('(') &&
        !/[:：]\s*\+?\d+%/.test(line) &&
        !dialect.rewardRider.test(line) &&
        !(dialect.uncharted?.test(line) ?? false),
    )

    charts.push({
      uid: newUid(),
      name,
      level,
      edges: shape.edges,
      areaType,
      modIds,
      implicitText,
      rewards: rewards.length ? rewards : undefined,
      shape: shape.canonical,
      rawText: rawLines.length ? rawLines.join('\n') : undefined,
    })
  }

  return { charts, rejected }
}
