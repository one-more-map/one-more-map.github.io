// Curated strategies. Each one overrides the user's reward weights and adds
// position rules that shape what the solver suggests while it is active.
//
// First set is from Milkybk_'s "Curse of the Allflame Buffs and My Strategy"
// (https://www.youtube.com/watch?v=gVKQhYxeavk) - transcribed and encoded
// 2026-07-28. His approach is deliberately all-or-nothing: run the speedrun
// board with spare charts until you've collected the pieces for a juiced one.

import type { ChartAreaType, Edges, Stat, Weights } from '../types'

export const STRATEGY_RESERVATION_OPTIONS = [
  { id: 'divine', label: 'Divine strategies' },
  { id: 'meatfish', label: 'Meatfish' },
  { id: 'ethereal', label: 'Magic Ethereal' },
] as const

export type StrategyReservationId = (typeof STRATEGY_RESERVATION_OPTIONS)[number]['id']
export type StrategyReservationPreferences = Record<StrategyReservationId, boolean>

export const defaultStrategyReservations = (): StrategyReservationPreferences => ({
  divine: true,
  meatfish: true,
  ethereal: true,
})

export interface StrategyReservationGroup {
  id: StrategyReservationId
  label: string
  modIds?: string[]
  areaTypes?: ChartAreaType[]
}

export interface PositionRule {
  /** board cells this rule targets (row-major, 4 = centre) */
  cells?: number[]
  /** or resolve cells dynamically: tiles touched by border segments rolled
   *  with this border mod id (e.g. put a chart ON the Divine-border tile) */
  nearBorderId?: string
  /** with nearBorderId: target the NEIGHBOURS of the border tile instead */
  adjacentToBorder?: boolean
  /** chart implicit mod ids that satisfy the rule */
  modIds?: string[]
  /** or match one of these canonical Chart destination/area types */
  areaTypes?: ChartAreaType[]
  /** or a header reward stat, scored as percent/100 × per */
  rewardStat?: { stat: Stat; per: number }
  /** objective bonus per matching placement */
  bonus: number
}

export interface StrategyDef {
  id: string
  name: string
  /** highlight chip on the strategy card (e.g. 'NEW') */
  badge?: string
  tagline: string
  source: { label: string; url: string }
  /** the video's guidance, shown on the expanded card */
  guide: string[]
  /** reward-weight override while active (unlisted rewards count as 0) */
  weights: Weights
  rules: PositionRule[]
  /** exact connector layout to build (effective edges [N,E,S,W] per cell after
   *  rotation) - the solver treats any deviation as a heavy penalty */
  layout?: Edges[]
  /** per-cell cost of deviating from the layout. Default is strict (300);
   *  a small value makes the lines a soft preference that yields to the
   *  position rules (piece locations matter more than exact lines) */
  layoutPenalty?: number
  /** selectable layout shapes (first = default); shown as a picker on the
   *  strategy card, the choice persists per strategy */
  layouts?: { id: string; label: string; hint: string; layout: Edges[] }[]
  /** Optional keeper groups excluded while this strategy is active. Users can
   *  enable each group independently in the solver controls. */
  reservationGroups?: StrategyReservationGroup[]
  /** pieces the strategy needs before it's worth running; if the library
   *  can't supply them the UI says to avoid this voyage and wait */
  requirements?: {
    modIds?: string[]
    areaTypes?: ChartAreaType[]
    count: number
    label: string
  }[]
  /** explicit 🔖 keep-wizard chart types; when present they replace the
   *  requirement-derived ones, so banking can be more granular than
   *  readiness (issue #21: split Starfish from boxes, box types from each
   *  other, voyage rares from adjacent rares). keep = default bank count. */
  bankTypes?: {
    label: string
    modIds?: string[]
    areaTypes?: ChartAreaType[]
    keep: number
  }[]
  /** a border roll the strategy hinges on (readiness warns if not entered) */
  requiresBorderId?: { id: string; label: string }
  /** selectable centre-piece family (first = default "best available");
   *  shown as a picker on the card, the choice persists per strategy and
   *  reshapes the centre rules + readiness (issue #49) */
  centerOptions?: { id: string; label: string; modIds: string[] }[]
  /** hard caps on the solve pool: only the best `max` matching charts are
   *  offered to the solver (e.g. Anchorfield Fishing boards exactly ONE
   *  Anchorfield however many the library holds - issue #49) */
  limits?: { modIds?: string[]; areaTypes?: ChartAreaType[]; max: number }[]
  /** what to do instead while pieces are missing */
  waitHint?: string
  /** this strategy is allowed to place rare-implicit charts (Divine strats) */
  allowRareImplicits?: boolean
  /** this strategy is allowed to place Rare Fracture charts (Meatfish) */
  allowFractureCharts?: boolean
  /** Milky's in-game search string highlighting this strategy's keeper charts */
  searchRegex?: string
  /** extra links shown on the card (trade searches, guides) */
  extraLinks?: { label: string; url: string }[]
}

/** rare-monster implicit charts are Divine-strategy fuel: nothing else may
 *  use them (the solver holds them back everywhere except the Divine strats) */
export const RARE_IMPLICITS = ['adj-rare-1', 'adj-rare-2', 'voy-rare'] as const

/** Rare Fracture charts are Meatfish fuel: fracturing multiplies the giga-rare
 *  farm, so only Meatfish may spend them (held back everywhere else) */
export const MEATFISH_FUEL = ['voy-fracture'] as const

/** Milky's master keeper regex - every mod worth saving, across all strats */
export const ALL_GOOD_MODS_REGEX =
  '"at least|cannot drop|poss|fract|bottle|divine|arca|oper|star|pantheon|belt|lantern|4000 w|strongbo|rare monsters in all voy|sulphur found in all"'

const CENTER = [4]
const EDGES = [1, 3, 5, 7]

// Milky's exact Meatfish board (from his planner, screenshotted 2026-07-28):
// corners at 0/2/7... rendered as effective edges [N,E,S,W] per cell.
// 10 connections, all linked to the ⚓ start; cell 6's south arm dangles off-board.
const T = true
const F = false
const MEATFISH_LAYOUT: Edges[] = [
  [F, T, T, F], // 0 corner
  [F, T, T, T], // 1 T-junction
  [F, F, T, T], // 2 corner
  [T, F, T, F], // 3 straight
  [T, T, T, F], // 4 T-junction
  [T, F, T, T], // 5 T-junction
  [T, F, T, F], // 6 straight (start; south dangles off-board)
  [T, T, F, F], // 7 corner
  [T, F, F, T], // 8 corner
]

// Milky's exact Magic Ethereal board: a full cross at centre, 11 connections;
// cells 6 and 7 have south arms dangling off-board.
const ETHEREAL_LAYOUT: Edges[] = [
  [F, T, T, F], // 0 corner
  [F, T, T, T], // 1 T-junction
  [F, F, T, T], // 2 corner
  [T, T, T, F], // 3 T-junction
  [T, T, T, T], // 4 crossing
  [T, F, T, T], // 5 T-junction
  [T, F, T, F], // 6 straight (start)
  [T, T, T, F], // 7 T-junction
  [T, F, F, T], // 8 corner
]

// the ONE chart Speedrun puts in the centre: Diviner's / Operative's boxes or
// Messages in a Bottle (Arcanist's and generic boxes don't qualify)
export const SPEEDRUN_CENTER_MODS = [
  'adj-divbox-1', 'adj-divbox-2',
  'adj-opbox-1', 'adj-opbox-2',
  'adj-msg-1', 'adj-msg-2',
]
const NOT_CENTER = [0, 1, 2, 3, 5, 6, 7, 8]

const MEATFISH_RESERVATION: StrategyReservationGroup = {
  id: 'meatfish',
  label: 'Meatfish',
  modIds: [
    'adj-star-1',
    'adj-star-2',
    'adj-pantheon',
    'adj-lantern',
    'voy-possess',
    'voy-fracture',
    'voy-noequip',
    'adj-wisps-1',
    'adj-wisps-2',
  ],
  areaTypes: ['sea-pillars'],
}

const ETHEREAL_RESERVATION: StrategyReservationGroup = {
  id: 'ethereal',
  label: 'Magic Ethereal',
  modIds: [
    'adj-lantern',
    'voy-noequip',
    'adj-wisps-1',
    'adj-wisps-2',
    'adj-magic-1',
    'adj-magic-2',
    'voy-minmagic',
  ],
}

const DIVINE_RESERVATION_MODS = [
  ...RARE_IMPLICITS,
  'adj-star-1',
  'adj-star-2',
  'adj-box-1',
  'adj-box-2',
  'adj-box-3',
]

const divineReservation = (includeSpeedrunCentres: boolean): StrategyReservationGroup => ({
  id: 'divine',
  label: 'Divine strategies',
  modIds: includeSpeedrunCentres
    ? [...DIVINE_RESERVATION_MODS, ...SPEEDRUN_CENTER_MODS]
    : DIVINE_RESERVATION_MODS,
  areaTypes: ['sea-pillars', 'pelagic-abyss'],
})

// "Alc & Go" highway: three vertical lanes capped at the top,
// joined along the bottom row. 8 connections, all reaching the ⚓ start.
const ALC_GO_LAYOUT: Edges[] = [
  [F, F, T, F], // 0 end (lane cap)
  [F, F, T, F], // 1 end
  [F, F, T, F], // 2 end
  [T, F, T, F], // 3 straight
  [T, F, T, F], // 4 straight
  [T, F, T, F], // 5 straight
  [T, T, F, F], // 6 corner (start)
  [T, T, F, T], // 7 T-junction
  [T, F, F, T], // 8 corner
]

// Alc & Go "S-snake" (community request from the Reddit thread): one
// continuous serpentine from the ⚓ start - fastest to actually run, at the
// cost of burning corner pieces faster than ends.
// Path: 6 → 7 → 8 → 5 → 4 → 3 → 0 → 1 → 2. 8 connections.
const ALC_GO_SNAKE: Edges[] = [
  [F, T, T, F], // 0 corner (S to 3, E to 1)
  [F, T, F, T], // 1 straight
  [F, F, F, T], // 2 end (tail)
  [T, T, F, F], // 3 corner (N to 0, E to 4)
  [F, T, F, T], // 4 straight
  [F, F, T, T], // 5 corner (S to 8, W to 4)
  [F, T, F, F], // 6 end (start; E to 7)
  [F, T, F, T], // 7 straight
  [T, F, F, T], // 8 corner (N to 5, W to 7)
]

export const STRATEGIES: StrategyDef[] = [
  {
    id: 'alc-and-go',
    name: 'Alc & Go',
    tagline: 'Burn the charts nothing else wants - one-lane highways, hope for random encounters.',
    source: { label: 'Milky’s strat', url: '' },
    guide: [
      'Uses only charts no other strategy needs - keeper charts are held back by default, with independent protections in Solver Settings.',
      'Forms single-lane highways (three lanes joined along the bottom) - or whatever the shapes allow.',
      'Don’t care what’s on the tiles: you’re there for scattered loot, sulphur and random encounters.',
      'Alc, go, place every lantern, click everything, leave. Rinse and repeat between real runs.',
    ],
    weights: {
      'self:quant': 2,
      'self:sulph': 2,
      'voyage:sulph': 2,
      'voyage:quant': 2,
    },
    rules: [],
    layout: ALC_GO_LAYOUT,
    layouts: [
      {
        id: 'highway',
        label: 'Three-lane highway',
        hint: 'burns end & corner pieces evenly',
        layout: ALC_GO_LAYOUT,
      },
      {
        id: 'snake',
        label: 'S-snake',
        hint: 'one continuous path - fastest to run',
        layout: ALC_GO_SNAKE,
      },
    ],
    layoutPenalty: 15, // a preference, not a law - "whatever works"
    reservationGroups: [divineReservation(true), MEATFISH_RESERVATION, ETHEREAL_RESERVATION],
  },
  {
    id: 'anchorfield-fishing',
    name: 'ANCHORFIELD FISHING',
    badge: 'NEW',
    tagline:
      'Fish for the chaos→divine blessing, then crack the Anchorfield open - jackpot or go next.',
    source: { label: 'Community strat', url: '' },
    guide: [
      'Put ONE Anchorfield chart in - any of them, just reroll it to decent Quantity. One is all you need.',
      'Fill the rest with increased Quantity charts, and reroll your junk to high quant with chaos.',
      'Got the "+1 Chaos Orb per Rare Monster" border? Consider increased Rare Monsters charts instead of quant (adjacent-rares charts are free to spend by default).',
      'Run the voyage normally, hunting ONE blessing: Chaos Orbs become Divine Orbs. Explore every area EXCEPT the Anchorfield - blast through it, open NO Sunken Loot there yet.',
      'Found the blessing? Sprint back to the Anchorfield and open every single Sunken Loot - each drops a few chaos, and the 20% chaos→divine conversion turns them into Divines.',
      'No blessing and ~6 lanterns left? Open the Anchorfield loot anyway for scraps, or just leave and go next - you are fishing for the jackpot, not peasant loot.',
    ],
    weights: {
      'self:quant': 10,
      'voyage:quant': 8,
      'border:chaos': 6,
      'border:quantconn': 5,
      'self:pack': 2,
      'voyage:sulph': 1,
    },
    rules: [
      // the ONE Anchorfield chart can sit anywhere - it just has to be aboard
      { cells: [0, 1, 2, 3, 4, 5, 6, 7, 8], areaTypes: ['anchorfield'], bonus: 40 },
    ],
    requirements: [
      { areaTypes: ['anchorfield'], count: 1, label: 'Anchorfield chart' },
    ],
    // "One is all you need": however many Anchorfields the library holds,
    // only the single best one is offered to the solver (issue #49 - the
    // any-cell bonus used to stack every Anchorfield onto the board)
    limits: [{ areaTypes: ['anchorfield'], max: 1 }],
    waitHint: 'Alc & Go or Speedrun until an Anchorfield chart drops - any rarity works.',
    searchRegex: '"anchorfield|m q.*(1[2-9].|[2-9]..)%"',
  },
  {
    id: 'milky-speedrun',
    name: 'Speedrun Strongboxes',
    tagline: 'Milky’s interim farm - burn spare charts, crack boxes, get in, get out.',
    source: { label: 'Milkybk_ - Allflame Buffs and My Strategy', url: 'https://www.youtube.com/watch?v=gVKQhYxeavk' },
    guide: [
      'Put exactly ONE Operative’s chart in the CENTRE - it’s the best (a few divines of scarabs per run); Diviner’s or Message-in-a-Bottle are the consistent fallbacks.',
      'Roll charts to 110%+ Item Quantity BEFORE running them - they can’t be rolled after, and quantity scales the boxes.',
      'Put your highest Item Quantity charts on the four sides.',
      'Everything else is junk you don’t need for other strategies - corners just make the connectors line up.',
      'Take Alchemy, Scouring and Exalted orbs in to juice every box before opening.',
      'If a Filthscrabble border appears (a ~4,000-sulphur boss), the solver pins your highest-sulphur chart to its tile.',
      'Speed matters: place lanterns, click everything, open the boxes, leave. Even a junk voyage yields a div or two of scattered loot.',
      'Keeper charts for Divine, Meatfish and Magic Ethereal are held back by default; switch off only the protections you do not want in Solver Settings.',
    ],
    weights: {
      'adjacent:opbox': 10,
      'adjacent:divbox': 7,
      'adjacent:msg': 7,
      'self:quant': 8,
      'voyage:quant': 5,
      'voyage:sulph': 3,
      'self:sulph': 3,
      'border:quantconn': 6,
      'border:divine': 4,
      'border:exalt': 3,
      'border:ancient': 3,
    },
    reservationGroups: [divineReservation(false), MEATFISH_RESERVATION, ETHEREAL_RESERVATION],
    rules: [
      // one centre chart, never a second one wasted elsewhere. Operative's
      // outranks the fallbacks (Milky: "won't yield as much, but consistent")
      { cells: CENTER, modIds: ['adj-opbox-1', 'adj-opbox-2'], bonus: 55 },
      { cells: CENTER, modIds: ['adj-divbox-1', 'adj-divbox-2', 'adj-msg-1', 'adj-msg-2'], bonus: 40 },
      { cells: NOT_CENTER, modIds: SPEEDRUN_CENTER_MODS, bonus: -40 },
      // 150%+ quant charts adjacent to the centre (continuous: higher = better)
      { cells: EDGES, rewardStat: { stat: 'quantity', per: 6 }, bonus: 0 },
      // Filthscrabble border: park the highest-sulphur chart on its tile
      { nearBorderId: 'b-octoboss', rewardStat: { stat: 'sulphur', per: 8 }, bonus: 0 },
    ],
    requirements: [
      { modIds: SPEEDRUN_CENTER_MODS, count: 1, label: 'Diviner’s / Operative’s / Message chart (centre)' },
    ],
    // which family may take the centre (issue #49: e.g. spend Messages,
    // save Diviner's) - the choice reshapes rules + readiness via
    // applyCenterChoice
    centerOptions: [
      { id: 'any', label: 'Best available', modIds: [...SPEEDRUN_CENTER_MODS] },
      { id: 'opbox', label: 'Operative’s only', modIds: ['adj-opbox-1', 'adj-opbox-2'] },
      { id: 'msg', label: 'Message only', modIds: ['adj-msg-1', 'adj-msg-2'] },
      { id: 'divbox', label: 'Diviner’s only', modIds: ['adj-divbox-1', 'adj-divbox-2'] },
    ],
    waitHint: 'Run manual boards until one drops.',
    searchRegex: '"bottle|divine|oper"',
  },
  {
    id: 'milky-meatfish',
    name: 'Meatfish',
    tagline: 'Milky’s big one - possessed, Pantheon-touched giga-starfish rares that rain uniques.',
    source: { label: 'Milkybk_ - Allflame Buffs and My Strategy', url: 'https://www.youtube.com/watch?v=gVKQhYxeavk' },
    guide: [
      'Milky’s full composition (his sheet): 2× Starfish, 1× Pantheon, 2× Sea-Pillars (corners), 2× Golden Lanterns, 1× Possessed Rares, 1× No-Equipment.',
      'Starfish always top- and bottom-middle; Pantheon only ever right-middle; Golden Lantern preferably centre - any chart shape.',
      '"Monsters cannot drop Equipment" is the jackpot piece - Rares Fracture works as the fallback. Optionally swap Pantheon for 4k Wisps.',
      'Collect every lantern in the voyage: ≈280% Quantity, 840 Rarity. Kill all the giga-rares. Obtain Mageblood/Headhunter.',
      'Very risky, all-or-nothing - don’t water it down. Speedrun boxes until you have the pieces.',
    ],
    weights: {
      'adjacent:star': 10,
      'adjacent:pantheon': 10,
      'adjacent:lantern': 10,
      'voyage:possess': 10,
      'voyage:fracture': 8,
      'border:rare': 9,
      'self:quant': 4,
      'self:rarity': 3,
    },
    rules: [
      // Placement rules: Starfish ALWAYS top/bottom-middle, Pantheon
      // ONLY right-middle, Golden Lantern preferably centre - any chart shape.
      // Bonuses outweigh the (soft) layout so location wins over exact lines;
      // negative bonuses keep the locked pieces out of every other square.
      { cells: [1, 7], modIds: ['adj-star-1', 'adj-star-2'], bonus: 80 },
      { cells: [0, 2, 3, 4, 5, 6, 8], modIds: ['adj-star-1', 'adj-star-2'], bonus: -80 },
      { cells: [5], modIds: ['adj-pantheon'], bonus: 80 },
      { cells: [0, 1, 2, 3, 4, 6, 7, 8], modIds: ['adj-pantheon'], bonus: -80 },
      { cells: [4], modIds: ['adj-lantern'], bonus: 40 },
      // Sea-Pillars belong in the corners (their rain juices their own tile)
      { cells: [0, 2, 6, 8], areaTypes: ['sea-pillars'], bonus: 40 },
      { cells: [1, 3, 4, 5, 7], areaTypes: ['sea-pillars'], bonus: -40 },
    ],
    layout: MEATFISH_LAYOUT,
    // soft: a full-board layout deviation (9 cells × 6) must still cost less
    // than any single piece bonus, so lines always yield to piece locations
    layoutPenalty: 6,
    requirements: [
      // Milky's sheet composition (2+1+2+2+1+1 = 9 charts)
      { modIds: ['adj-star-1', 'adj-star-2'], count: 2, label: 'Giant Starfish chart' },
      { modIds: ['adj-pantheon', 'adj-wisps-1', 'adj-wisps-2'], count: 1, label: 'Pantheon (or 4k Wisp) chart' },
      { areaTypes: ['sea-pillars'], count: 2, label: 'Sea-Pillar chart (corners)' },
      { modIds: ['adj-lantern'], count: 2, label: 'Golden Lantern chart' },
      { modIds: ['voy-possess'], count: 1, label: 'Possessed Rares chart' },
      { modIds: ['voy-noequip', 'voy-fracture'], count: 1, label: 'No-Equipment (or Fracture) chart' },
    ],
    waitHint: 'Speedrun Strongboxes in the meantime.',
    searchRegex: '"cannot|poss|lantern|pantheon"',
    allowFractureCharts: true,
  },
  {
    id: 'milky-ethereal',
    name: 'Magic Ethereal',
    tagline: 'Milky’s magic-monster variant - wisps, lanterns and everything at least Magic.',
    source: { label: 'Milkybk_ - Allflame Buffs and My Strategy', url: 'https://www.youtube.com/watch?v=gVKQhYxeavk' },
    guide: [
      '⚠ Field reports are underwhelming so far (Palsteron ran it: ~5 div) - Milky has moved to the rares build (Meatfish). Kept for reference.',
      'Builds Milky’s exact board layout: 3 Corners, 4 T-junctions, 1 Crossing, 1 Straight - 11 connections.',
      'Wisp charts on the four sides, Golden Lanterns on the corners, the Crossing chart dead centre.',
      'Instead of rares, go wide on magic monsters: All Monsters at least Magic + increased Magic Monsters.',
      'Use Infested Bathysphere zones - they spawn far more monsters to convert.',
      'Leans harder on "Monsters cannot drop Equipment" than Meatfish - it’s the big multiplier here.',
    ],
    weights: {
      'adjacent:wisps': 10,
      'voyage:minmagic': 10,
      'adjacent:magic': 9,
      'voyage:magic': 9,
      'adjacent:lantern': 8,
      'border:minmagic': 8,
      'self:quant': 4,
      'self:pack': 3,
    },
    rules: [
      // icon cells from Milky's planner: wisps on the cross, lanterns on corners
      { cells: EDGES, modIds: ['adj-wisps-1', 'adj-wisps-2'], bonus: 6 },
      { cells: [0, 2, 8], modIds: ['adj-lantern'], bonus: 5 },
      { cells: CENTER, modIds: ['adj-magic-1', 'adj-magic-2', 'adj-wisps-1', 'adj-wisps-2'], bonus: 5 },
    ],
    layout: ETHEREAL_LAYOUT,
    requirements: [
      { modIds: ['adj-wisps-1', 'adj-wisps-2'], count: 4, label: 'Wildwood Wisp chart' },
      { modIds: ['adj-lantern'], count: 3, label: 'Golden Lantern chart' },
    ],
    waitHint: 'Speedrun Strongboxes in the meantime.',
  },
  {
    id: 'divine-border-rares',
    name: 'Divine Border Rares',
    tagline:
      'Roll a Divine border, park a Sea-Pillar chart on it, and drown that tile in rares - every rare drops a Divine Orb.',
    source: { label: 'Milky’s strat', url: '' },
    guide: [
      'Reroll borders with Dead Man’s Sulphur until you hit "+1 Divine Orb per Rare Monster" - this is one of the mechanic’s two real jackpots.',
      'Enter your borders on the board - the solver pins your Sea-Pillar chart to the Divine tile (its pillars rain extra rares into that exact area).',
      'The treasure feeders are "+5 Strongboxes" adjacent charts: roll the boxes themselves for "Stream of Monsters" (+4 rares) and "of Rarity" (+3) - 7 rares per box, a Divine each. One +5 chart ≈ 35 Divines; three around the tile ≈ 105.',
      'Starfish charts also feed it if you’re short on Strongbox charts.',
      '5× Increased Rare Monsters charts fill the rest - every rare on that tile is a Divine drop.',
    ],
    weights: {
      'adjacent:rare': 10,
      'voyage:rare': 10,
      'border:rare': 10,
      'adjacent:star': 8,
      'adjacent:box': 8,
      'voyage:possess': 6,
      'border:divine': 10,
      'self:pack': 3,
    },
    rules: [
      // the Sea-Pillar chart sits ON whichever tile the Divine border touches
      { nearBorderId: 'b-divine', areaTypes: ['sea-pillars'], bonus: 100 },
      // feeders shoot INTO the Divine tile from beside it. "+5 Strongboxes"
      // (7 rares per box when rolled = 35 divines) outranks lower tiers/starfish
      { nearBorderId: 'b-divine', adjacentToBorder: true, modIds: ['adj-box-3'], bonus: 35 },
      { nearBorderId: 'b-divine', adjacentToBorder: true, modIds: ['adj-box-1', 'adj-box-2'], bonus: 22 },
      { nearBorderId: 'b-divine', adjacentToBorder: true, modIds: ['adj-star-1', 'adj-star-2'], bonus: 15 },
    ],
    requirements: [
      { areaTypes: ['sea-pillars'], count: 1, label: 'Sea-Pillar chart' },
      {
        modIds: ['adj-star-1', 'adj-star-2', 'adj-box-1', 'adj-box-2', 'adj-box-3'],
        count: 3,
        label: 'Starfish or Strongbox chart',
      },
      { modIds: ['adj-rare-1', 'adj-rare-2', 'voy-rare'], count: 5, label: 'Increased Rares chart' },
    ],
    // banking is more granular than readiness (issue #21): only the big
    // generic boxes (+2-4/+5) are Divine-mandatory - typed boxes cap at +3
    // and stay free for Speedrun; voyage-wide rares outrank adjacent ones
    bankTypes: [
      { label: 'Sea-Pillar chart', areaTypes: ['sea-pillars'], keep: 1 },
      { label: 'Giant Starfish chart', modIds: ['adj-star-1', 'adj-star-2'], keep: 3 },
      { label: 'Strongbox chart (+2-4 / +5)', modIds: ['adj-box-2', 'adj-box-3'], keep: 3 },
      { label: 'Strongbox chart (+1)', modIds: ['adj-box-1'], keep: 0 },
      { label: 'Increased Rares chart (voyage-wide)', modIds: ['voy-rare'], keep: 6 },
      { label: 'Increased Rares chart (adjacent)', modIds: ['adj-rare-1', 'adj-rare-2'], keep: 0 },
    ],
    requiresBorderId: { id: 'b-divine', label: 'a "+1 Divine Orb" border roll (enter your borders)' },
    waitHint: 'Speedrun Strongboxes until the pieces and the Divine border line up.',
    searchRegex: '"rare monsters in all voy|strongbox"',
    allowRareImplicits: true,
  },
  {
    id: 'cutedog-divine-boxes',
    name: 'Divine Strongboxes',
    tagline:
      'cutedog_’s Divine-border variant - Pelagic Abyss on the Divine tile, any strongboxes feeding it, 7 divines per rolled box.',
    source: { label: 'cutedog_ (Twitch)', url: 'https://www.twitch.tv/cutedog_' },
    guide: [
      'Needs the "+1 Divine Orb per Rare" border. Put a Pelagic Abyss chart with high % Pack Size on that exact tile.',
      '3× strongbox adjacent charts (ANY type) beside the Divine tile - each box they shoot in is up to 7 guaranteed divines.',
      'Roll the Strongboxes: "3 additional Rares" prefix = 3 divines, "Stream of Monsters" prefix = 4. Both on one box = 7, difficult to roll.',
      'Every other tile: voyage-wide increased Rare Monsters.',
      'Buy good charts cheap on trade (link below) - whisper "fastge". Use the 120%+ quantity regex when browsing.',
    ],
    weights: {
      'voyage:rare': 10,
      'adjacent:rare': 8,
      'border:rare': 10,
      'adjacent:box': 9,
      'adjacent:divbox': 8,
      'adjacent:arcbox': 8,
      'adjacent:opbox': 8,
      'border:divine': 10,
      'self:pack': 6,
    },
    rules: [
      // Pelagic Abyss (high pack size) sits ON the Divine-border tile
      { nearBorderId: 'b-divine', areaTypes: ['pelagic-abyss'], bonus: 80 },
      { nearBorderId: 'b-divine', rewardStat: { stat: 'packsize', per: 8 }, bonus: 0 },
      // any strongbox adjacent charts feed the Divine tile from beside it
      {
        nearBorderId: 'b-divine',
        adjacentToBorder: true,
        modIds: [
          'adj-box-1', 'adj-box-2', 'adj-box-3',
          'adj-divbox-1', 'adj-divbox-2',
          'adj-arcbox-1', 'adj-arcbox-2',
          'adj-opbox-1', 'adj-opbox-2',
        ],
        bonus: 25,
      },
    ],
    requirements: [
      {
        areaTypes: ['pelagic-abyss'],
        count: 1,
        label: 'Pelagic Abyss chart (high pack size)',
      },
      {
        modIds: [
          'adj-box-1', 'adj-box-2', 'adj-box-3',
          'adj-divbox-1', 'adj-divbox-2',
          'adj-arcbox-1', 'adj-arcbox-2',
          'adj-opbox-1', 'adj-opbox-2',
        ],
        count: 3,
        label: 'Strongbox adjacent chart (any type)',
      },
      { modIds: ['voy-rare'], count: 5, label: 'Increased Rares (voyage) chart' },
    ],
    bankTypes: [
      { label: 'Pelagic Abyss chart (high pack size)', areaTypes: ['pelagic-abyss'], keep: 1 },
      { label: 'Strongbox chart (+2-4 / +5)', modIds: ['adj-box-2', 'adj-box-3'], keep: 3 },
      { label: "Diviner's Strongbox chart", modIds: ['adj-divbox-1', 'adj-divbox-2'], keep: 0 },
      { label: "Arcanist's Strongbox chart", modIds: ['adj-arcbox-1', 'adj-arcbox-2'], keep: 0 },
      { label: "Operative's Strongbox chart", modIds: ['adj-opbox-1', 'adj-opbox-2'], keep: 0 },
      { label: 'Increased Rares chart (voyage-wide)', modIds: ['voy-rare'], keep: 6 },
    ],
    requiresBorderId: { id: 'b-divine', label: 'a "+1 Divine Orb" border roll (enter your borders)' },
    waitHint: 'Speedrun Strongboxes until the pieces and the Divine border line up.',
    searchRegex: '"m q.*(1[2-9].|[2-9]..)%"',
    allowRareImplicits: true,
    extraLinks: [
      { label: 'Trade search: cheap good charts', url: 'https://www.pathofexile.com/trade/search/Allflame/9zRn7YLRHK' },
    ],
  },
]

export const strategyById = new Map(STRATEGIES.map((s) => [s.id, s]))

/**
 * Apply the user's centre-piece pick (issue #49): the chosen family gets the
 * centre bonus, the excluded families are pushed out of the centre, and
 * readiness asks for the chosen family specifically. The default (first)
 * option returns the strategy untouched.
 */
export function applyCenterChoice(strategy: StrategyDef, choiceId?: string): StrategyDef {
  const options = strategy.centerOptions
  if (!options || options.length === 0) return strategy
  const choice = options.find((o) => o.id === choiceId) ?? options[0]
  if (choice === options[0]) return strategy

  const allCenterMods = new Set(options[0].modIds)
  const excluded = options[0].modIds.filter((id) => !choice.modIds.includes(id))

  // strip every rule that touches a centre-family mod, then rebuild them
  // around the chosen family; rules without modIds (quant edges,
  // Filthscrabble) pass through untouched
  const rules = [
    { cells: CENTER, modIds: choice.modIds, bonus: 55 },
    { cells: CENTER, modIds: excluded, bonus: -40 },
    { cells: NOT_CENTER, modIds: options[0].modIds, bonus: -40 },
    ...strategy.rules.filter(
      (r) => !r.modIds || !r.modIds.some((id) => allCenterMods.has(id)),
    ),
  ]
  const requirements = (strategy.requirements ?? []).map((req) =>
    req.modIds?.some((id) => allCenterMods.has(id))
      ? { ...req, modIds: choice.modIds, label: `${choice.label.replace(' only', '')} chart (centre)` }
      : req,
  )
  return { ...strategy, rules, requirements }
}
