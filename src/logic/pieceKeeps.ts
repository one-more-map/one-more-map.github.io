// "Keep X of this chart type" model: each strategy recommends piece types
// (from its requirements); the user tunes how many of each to bank. The bank
// holds the BEST X matching charts for their strategy - everything beyond the
// keep count is an ordinary spendable chart.

import {
  SPEEDRUN_CENTER_MODS,
  STRATEGIES,
  type StrategyReservationId,
  type StrategyReservationPreferences,
} from '../data/strategies'
import { VOYAGE_MODS, voyageModById } from '../data/mods'
import type { ChartData } from '../types'

export interface PieceType {
  /** stable key: strategyId + matcher fingerprint */
  key: string
  strategyId: string
  strategyName: string
  /** which protection toggle gates this type (null = always on) */
  reservationId: StrategyReservationId | null
  label: string
  modIds?: string[]
  areaTypes?: string[]
  /** the strategy's own requirement count */
  recommended: number
  /** what we bank when the user hasn't set a count */
  defaultKeep: number
  /** false when an earlier type already banks this family (one knob per
   *  family); the type still counts for "this strategy wants these charts" */
  banks: boolean
}

/** claim priority: jackpot boards first, so shared pieces bank for them */
const STRATEGY_ORDER = [
  'divine-border-rares',
  'cutedog-divine-boxes',
  'milky-meatfish',
  'milky-ethereal',
  'anchorfield-fishing',
  'milky-speedrun',
]

const RESERVATION_OF: Record<string, StrategyReservationId | null> = {
  'divine-border-rares': 'divine',
  'cutedog-divine-boxes': 'divine',
  'milky-meatfish': 'meatfish',
  'milky-ethereal': 'ethereal',
  'anchorfield-fishing': null,
  'milky-speedrun': null,
}

function buildPieceTypes(): PieceType[] {
  const out: PieceType[] = []
  // a later type whose matcher is a SUBSET of an earlier banking type must not
  // double-bank the same family (e.g. both Divine strats want increased-rares
  // charts) - one keep knob per family, sized for the HUNGRIEST strategy
  // (Ethereal wants 4 wisps even though Meatfish's knob only asks for 1).
  // The later type still exists so its strategy "wants" those charts and may
  // spend the shared bank.
  const familyOwner = (p: { modIds?: string[]; areaTypes?: string[] }) =>
    out.find(
      (q) =>
        q.banks &&
        (!p.modIds || (q.modIds && p.modIds.every((id) => q.modIds!.includes(id)))) &&
        (!p.areaTypes ||
          (q.areaTypes && p.areaTypes.every((a) => q.areaTypes!.includes(a)))),
    )
  for (const sid of STRATEGY_ORDER) {
    const s = STRATEGIES.find((x) => x.id === sid)!
    // explicit bankTypes trump requirement-derived ones - banking can be more
    // granular than readiness (issue #21)
    const sources = s.bankTypes
      ? s.bankTypes.map((b) => ({
          label: b.label,
          modIds: b.modIds,
          areaTypes: b.areaTypes,
          count: b.keep,
          keep: b.keep,
        }))
      : (s.requirements ?? []).map((req) => ({
          label: req.label,
          modIds: req.modIds,
          areaTypes: req.areaTypes,
          count: req.count,
          // the Divine board wants 5 rares; bank one spare on top
          keep: req.modIds?.includes('voy-rare') ? req.count + 1 : req.count,
        }))
    for (const src of sources) {
      const owner = familyOwner(src)
      if (owner) {
        owner.recommended = Math.max(owner.recommended, src.count)
        owner.defaultKeep = Math.max(owner.defaultKeep, src.keep)
      }
      const fingerprint = (src.modIds ?? src.areaTypes ?? []).join('|')
      out.push({
        key: `${s.id}:${fingerprint}`,
        strategyId: s.id,
        strategyName: s.name,
        reservationId: RESERVATION_OF[s.id],
        label: src.label,
        modIds: src.modIds,
        areaTypes: src.areaTypes,
        recommended: src.count,
        defaultKeep: src.keep,
        banks: !owner,
      })
    }
    if (s.id === 'milky-speedrun') {
      const centres = { modIds: [...SPEEDRUN_CENTER_MODS] }
      const owner = familyOwner(centres)
      if (owner) {
        owner.recommended = Math.max(owner.recommended, 2)
        owner.defaultKeep = Math.max(owner.defaultKeep, 2)
      }
      out.push({
        key: `${s.id}:centres`,
        strategyId: s.id,
        strategyName: s.name,
        reservationId: null,
        label: 'Centre chart (Diviner’s / Operative’s / Message)',
        modIds: centres.modIds,
        recommended: 2,
        defaultKeep: 2,
        banks: !owner,
      })
    }
  }
  return out
}

export const PIECE_TYPES: PieceType[] = buildPieceTypes()

export function matchesPiece(c: ChartData, p: PieceType): boolean {
  return (
    (p.modIds?.some((id) => c.modIds.includes(id)) ?? false) ||
    (p.areaTypes && c.areaType ? p.areaTypes.includes(c.areaType) : false)
  )
}

/** best-first ranking inside a piece type: implicit tier, then rolls, then level */
const tierValue = (c: ChartData, p: PieceType) =>
  Math.max(
    0,
    ...c.modIds
      .filter((id) => p.modIds?.includes(id))
      .map((id) => voyageModById.get(id)?.effects[0]?.percent ?? 0),
  )
export const rewardSum = (c: ChartData) => (c.rewards ?? []).reduce((s, e) => s + e.percent, 0)

/** does this strategy have any recommended piece type matching the chart?
 *  (a banked chart stays spendable by every strategy that wants its type) */
export function strategyWantsChart(strategyId: string | undefined, c: ChartData): boolean {
  if (!strategyId) return false
  return PIECE_TYPES.some((p) => p.strategyId === strategyId && matchesPiece(c, p))
}

/** key encoding a user-added chart type in the keeps record; multi-tier
 *  families join their mod ids with '+' */
export const customKey = (strategyId: string, modIds: string[]) =>
  `custom:${strategyId}:${modIds.join('+')}`

const stripTier = (s: string) => s.replace(/^\+?\d+(\s*[-–]\s*\d+)?%?\s*/, '').trim()

/** display label for a custom type: family name across tiers, or the mod */
export function customLabel(modIds: string[]): string {
  const mod = voyageModById.get(modIds[0])
  if (!mod) return modIds.join(' + ')
  if (modIds.length === 1) return mod.short ?? mod.text
  return `${stripTier(mod.short ?? mod.text)} (any tier)`
}

export interface CustomOption {
  /** the '+'-joined mod ids, ready for customKey */
  value: string
  label: string
  modIds: string[]
  scope: 'adjacent' | 'voyage'
}

/** every addable chart type, grouped into tier families ("Diviner's Boxes"
 *  covers +2 and +3) so users pick a TYPE, not an individual roll */
export const CUSTOM_OPTIONS: CustomOption[] = (() => {
  const families = new Map<string, string[]>()
  for (const m of VOYAGE_MODS) {
    if (m.scope === 'self') continue
    const family = `${m.scope}:${m.id.replace(/^(adj|voy)-/, '').replace(/-\d+$/, '')}`
    families.set(family, [...(families.get(family) ?? []), m.id])
  }
  return [...families.entries()]
    .map(([family, modIds]) => ({
      value: modIds.join('+'),
      label: customLabel(modIds),
      modIds,
      scope: (family.startsWith('global') ? 'voyage' : 'adjacent') as 'adjacent' | 'voyage',
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
})()

/** user-added chart types, derived from `custom:<strategyId>:<modIds>` keys */
export function customPieceTypes(keeps: Record<string, number>): PieceType[] {
  const out: PieceType[] = []
  for (const key of Object.keys(keeps)) {
    if (!key.startsWith('custom:')) continue
    const [, strategyId, joined] = key.split(':')
    const s = STRATEGIES.find((x) => x.id === strategyId)
    const modIds = (joined ?? '').split('+').filter((id) => voyageModById.has(id))
    if (!s || modIds.length === 0) continue
    out.push({
      key,
      strategyId,
      strategyName: s.name,
      reservationId: RESERVATION_OF[strategyId] ?? null,
      label: customLabel(modIds),
      modIds,
      recommended: 0,
      defaultKeep: 0,
      banks: true,
    })
  }
  return out
}

/** Which charts are banked, and for whom. Claim order follows strategy
 *  priority (user-added types last); a chart claimed by one type is invisible
 *  to later ones. */
export function selectPieceBank(
  pool: ChartData[],
  keeps: Record<string, number>,
  prefs: StrategyReservationPreferences,
): Map<string, PieceType> {
  const bank = new Map<string, PieceType>()
  for (const p of [...PIECE_TYPES, ...customPieceTypes(keeps)]) {
    if (!p.banks) continue
    if (p.reservationId && !prefs[p.reservationId]) continue
    const keep = keeps[p.key] ?? p.defaultKeep
    if (keep <= 0) continue
    pool
      .filter((c) => !bank.has(c.uid) && matchesPiece(c, p))
      .sort(
        (a, b) =>
          tierValue(b, p) - tierValue(a, p) || rewardSum(b) - rewardSum(a) || b.level - a.level,
      )
      .slice(0, keep)
      .forEach((c) => bank.set(c.uid, p))
  }
  return bank
}
