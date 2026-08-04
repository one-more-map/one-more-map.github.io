// ============================================================================
// 3.29 mod pools - from datamined mod lists (launch day, 2026-07-24).
// Reward stat mappings + heuristic values for count-based mods are ours;
// mod texts and numbers are the game's. Ranges use representative mid values.
// ============================================================================

import type { BorderModDef, VoyageModDef } from '../types'

// ---------------------------------------------------------------------------
// Chart map-mods (magic prefix/suffix): a reward line + downside line(s).
// Only the reward line carries scoring effects; downsides are kept in text.
// One entry per family tier (Low → VeryHigh) so values stay accurate.
// ---------------------------------------------------------------------------
const chartMapMods: VoyageModDef[] = [
  // Canonical reward lines (families share these; downside lines vary and are
  // kept as raw text on import). Tiers: quantity 20/28/32/45, sulphur 30/45,
  // rarity 12/18/20/30, pack 14/16/18, gold 50/70.
  { id: 'cm-quant-20', text: '20% increased Quantity of Items found in this Area', scope: 'self', effects: [{ stat: 'quantity', percent: 20 }] },
  { id: 'cm-quant-28', text: '28% increased Quantity of Items found in this Area', scope: 'self', effects: [{ stat: 'quantity', percent: 28 }] },
  { id: 'cm-quant-32', text: '32% increased Quantity of Items found in this Area', scope: 'self', effects: [{ stat: 'quantity', percent: 32 }] },
  { id: 'cm-quant-45', text: '45% increased Quantity of Items found in this Area', scope: 'self', effects: [{ stat: 'quantity', percent: 45 }] },
  { id: 'cm-sulph-30', text: "30% increased Dead Man's Sulphur found in this Area", scope: 'self', effects: [{ stat: 'sulphur', percent: 30 }] },
  { id: 'cm-sulph-45', text: "45% increased Dead Man's Sulphur found in this Area", scope: 'self', effects: [{ stat: 'sulphur', percent: 45 }] },
  { id: 'cm-rarity-12', text: '12% increased Rarity of Items found in this Area', scope: 'self', effects: [{ stat: 'rarity', percent: 12 }] },
  { id: 'cm-rarity-18', text: '18% increased Rarity of Items found in this Area', scope: 'self', effects: [{ stat: 'rarity', percent: 18 }] },
  { id: 'cm-rarity-20', text: '20% increased Rarity of Items found in this Area', scope: 'self', effects: [{ stat: 'rarity', percent: 20 }] },
  { id: 'cm-rarity-30', text: '30% increased Rarity of Items found in this Area', scope: 'self', effects: [{ stat: 'rarity', percent: 30 }] },
  { id: 'cm-pack-14', text: '14% increased Pack size', scope: 'self', effects: [{ stat: 'packsize', percent: 14 }] },
  { id: 'cm-pack-16', text: '16% increased Pack size', scope: 'self', effects: [{ stat: 'packsize', percent: 16 }] },
  { id: 'cm-pack-18', text: '18% increased Pack size', scope: 'self', effects: [{ stat: 'packsize', percent: 18 }] },
  { id: 'cm-gold-50', text: '50% increased Gold found in this Area', scope: 'self', effects: [{ stat: 'gold', percent: 50 }] },
  { id: 'cm-gold-70', text: '70% increased Gold found in this Area', scope: 'self', effects: [{ stat: 'gold', percent: 70 }] },
]

// ---------------------------------------------------------------------------
// Chart implicits - Adjacent pool (revealed on charting)
// ---------------------------------------------------------------------------
// Korean aliases are either verbatim Ctrl+C lines observed in a 60-chart
// Korean-client corpus, or numeric-tier variants explicitly confirmed by that
// player to use the same localized sentence template. Tests keep those two
// provenance groups separate.
const adjacentImplicits: VoyageModDef[] = [
  { id: 'adj-ess-1', short: '+1-2 Imprisoned', text: 'Adjacent Areas contain 1-2 additional Imprisoned Monsters', aliases: ['인접 지역들에 갇힌 몬스터 1(1-2)마리 추가 등장'], scope: 'adjacent', effects: [{ stat: 'essences', percent: 15 }] },
  { id: 'adj-ess-2', short: '+2-4 Imprisoned', text: 'Adjacent Areas contain 2-4 additional Imprisoned Monsters', aliases: ['인접 지역들에 갇힌 몬스터 4(2-4)마리 추가 등장'], scope: 'adjacent', effects: [{ stat: 'essences', percent: 30 }] },
  { id: 'adj-ess-3', short: '+5 Imprisoned', text: 'Adjacent Areas contain 5 additional Imprisoned Monsters', aliases: ['인접 지역들에 갇힌 몬스터 5마리 추가 등장'], scope: 'adjacent', effects: [{ stat: 'essences', percent: 50 }] },
  { id: 'adj-box-1', short: '+1 Strongbox', text: 'Adjacent Areas contain an additional Strongbox', aliases: ['인접 지역들에 금고 1개 추가 등장'], scope: 'adjacent', effects: [{ stat: 'treasure', percent: 15 }] },
  { id: 'adj-box-2', short: '+2-4 Strongboxes', text: 'Adjacent Areas contain 2-4 additional Strongboxes', aliases: ['인접 지역들에 금고 3(2-4)개 추가 등장'], scope: 'adjacent', effects: [{ stat: 'treasure', percent: 35 }] },
  { id: 'adj-box-3', short: '+5 Strongboxes', text: 'Adjacent Areas contain 5 additional Strongboxes', aliases: ['인접 지역들에 금고 5개 추가 등장'], scope: 'adjacent', effects: [{ stat: 'treasure', percent: 55 }] },
  {
    id: 'adj-octo-1',
    short: '+8-10 Octopi',
    text: 'Adjacent Areas contain 8-10 additional packs of Octopi',
    aliases: ['인접 지역들에 문어 무리 8(8-10)개 추가 등장'],
    scope: 'adjacent',
    effects: [{ stat: 'packsize', percent: 25 }],
  },
  { id: 'adj-octo-2', short: '+11-14 Octopi', text: 'Adjacent Areas contain 11-14 additional packs of Octopi', aliases: ['인접 지역들에 문어 무리 11(11-14)개 추가 등장'], scope: 'adjacent', effects: [{ stat: 'packsize', percent: 35 }] },
  { id: 'adj-crab-1', short: '+8-10 Crabs', text: 'Adjacent Areas contain 8-10 additional packs of Crabs', aliases: ['인접 지역에 게 무리 8(8-10)개 추가 등장'], scope: 'adjacent', effects: [{ stat: 'packsize', percent: 25 }] },
  { id: 'adj-crab-2', short: '+11-14 Crabs', text: 'Adjacent Areas contain 11-14 additional packs of Crabs', aliases: ['인접 지역에 게 무리 11(11-14)개 추가 등장'], scope: 'adjacent', effects: [{ stat: 'packsize', percent: 35 }] },
  { id: 'adj-magic-1', text: '30% increased Magic Monsters', aliases: ['인접 지역들 내 마법 몬스터 수 30% 증가'], scope: 'adjacent', effects: [{ stat: 'magicmonsters', percent: 30 }] },
  { id: 'adj-magic-2', text: '60% increased Magic Monsters', aliases: ['인접 지역들 내 마법 몬스터 수 60% 증가'], scope: 'adjacent', effects: [{ stat: 'magicmonsters', percent: 60 }] },
  { id: 'adj-rare-1', text: '30% increased number of Rare Monsters', aliases: ['인접 지역들 내 희귀 몬스터 수 30% 증가'], scope: 'adjacent', effects: [{ stat: 'rares', percent: 30 }] },
  { id: 'adj-rare-2', text: '60% increased number of Rare Monsters', aliases: ['인접 지역들 내 희귀 몬스터 수 60% 증가'], scope: 'adjacent', effects: [{ stat: 'rares', percent: 60 }] },
  { id: 'adj-msg-1', short: '+1 Message', text: 'Adjacent Areas contain an additional Message in a Bottle', scope: 'adjacent', effects: [{ stat: 'treasure', percent: 12 }] },
  { id: 'adj-msg-2', short: '+2 Messages', text: 'Adjacent Areas contain 2 additional Messages in Bottles', scope: 'adjacent', effects: [{ stat: 'treasure', percent: 22 }] },
  { id: 'adj-fish', short: 'Exotic Fish', text: 'Adjacent Areas contain highly prized and exotic Fish', scope: 'adjacent', effects: [{ stat: 'treasure', percent: 20 }] },
  { id: 'adj-wisps-1', short: '2000 Wisps', text: 'Monsters have a chance to be Empowered by 2000 Wildwood Wisps', aliases: ['몬스터가 일정 확률로 야생림 도깨비불 2000마리로 강화'], scope: 'adjacent', effects: [{ stat: 'wisps', percent: 30 }] },
  { id: 'adj-wisps-2', short: '4000 Wisps', text: 'Monsters have a chance to be Empowered by 4000 Wildwood Wisps', aliases: ['몬스터가 일정 확률로 야생림 도깨비불 4000마리로 강화'], scope: 'adjacent', effects: [{ stat: 'wisps', percent: 55 }] },
  { id: 'adj-atziri', short: "Atziri's Influence", text: "Atziri's Influence", aliases: ['앗지리의 영향력'], scope: 'adjacent', effects: [{ stat: 'treasure', percent: 40 }] },
  {
    id: 'adj-gold-1',
    text: '40% of Equipment dropped by Monsters in Area is converted to Gold',
    aliases: ['인접 지역 내 몬스터가 떨어뜨리는 장비의 40%가 골드로 전환'],
    scope: 'adjacent',
    effects: [{ stat: 'gold', percent: 40 }],
  },
  { id: 'adj-gold-2', text: '80% of Equipment dropped by Monsters in Area is converted to Gold', aliases: ['인접 지역 내 몬스터가 떨어뜨리는 장비의 80%가 골드로 전환'], scope: 'adjacent', effects: [{ stat: 'gold', percent: 80 }] },
  { id: 'adj-spirit-1', short: '+1 Spirit Cage', text: 'Adjacent Areas contain an additional cage of Tormented Spirits', aliases: ['인접 지역들에 고통받는 혼백의 창살 1개 추가 등장'], scope: 'adjacent', effects: [{ stat: 'spirits', percent: 20 }] },
  { id: 'adj-spirit-2', short: '+2 Spirit Cages', text: 'Adjacent Areas contain 2 additional cages of Tormented Spirits', aliases: ['인접 지역들에 고통받는 혼백의 창살 2개 추가 등장'], scope: 'adjacent', effects: [{ stat: 'spirits', percent: 38 }] },
  { id: 'adj-divbox-1', short: "+2 Diviner's Boxes", text: "Adjacent Areas contain 2 additional Diviner's Strongboxes", aliases: ['인접 지역들에 예언자의 금고 2개 추가 등장'], scope: 'adjacent', effects: [{ stat: 'divcards', percent: 45 }] },
  { id: 'adj-divbox-2', short: "+3 Diviner's Boxes", text: "Adjacent Areas contain 3 additional Diviner's Strongboxes", aliases: ['인접 지역들에 예언자의 금고 3개 추가 등장'], scope: 'adjacent', effects: [{ stat: 'divcards', percent: 65 }] },
  { id: 'adj-arcbox-1', short: '+2 Arcanist Boxes', text: "Adjacent Areas contain 2 additional Arcanist's Strongboxes", aliases: ['인접 지역들에 신비학자의 금고 2개 추가 등장'], scope: 'adjacent', effects: [{ stat: 'currency', percent: 40 }] },
  { id: 'adj-arcbox-2', short: '+3 Arcanist Boxes', text: "Adjacent Areas contain 3 additional Arcanist's Strongboxes", aliases: ['인접 지역들에 신비학자의 금고 3개 추가 등장'], scope: 'adjacent', effects: [{ stat: 'currency', percent: 55 }] },
  { id: 'adj-opbox-1', short: '+2 Operative Boxes', text: "Adjacent Areas contain 2 additional Operative's Strongboxes", aliases: ['인접 지역들에 첩보원의 금고 2개 추가 등장'], scope: 'adjacent', effects: [{ stat: 'scarabs', percent: 40 }] },
  { id: 'adj-opbox-2', short: '+3 Operative Boxes', text: "Adjacent Areas contain 3 additional Operative's Strongboxes", aliases: ['인접 지역들에 첩보원의 금고 3개 추가 등장'], scope: 'adjacent', effects: [{ stat: 'scarabs', percent: 55 }] },
  {
    id: 'adj-barrel-1',
    short: '+12-15 Barrels',
    text: 'Adjacent Areas contain 12-15 additional Clusters of Barrels',
    aliases: ['인접 지역들에 통 무더기 14(12-15)개 추가 등장'],
    scope: 'adjacent',
    effects: [{ stat: 'treasure', percent: 15 }],
  },
  {
    id: 'adj-barrel-2',
    short: '+16-20 Barrels',
    text: 'Adjacent Areas contain 16-20 additional Clusters of Mysterious Barrels',
    aliases: ['인접 지역들에 통 무더기 17(16-20)개 추가 등장'],
    scope: 'adjacent',
    effects: [{ stat: 'treasure', percent: 22 }],
  },
  {
    id: 'adj-star-1',
    short: '+4-5 Starfish',
    text: 'Adjacent Areas contains 4-5 additional Giant Starfish',
    aliases: ['인접 지역들에 에 거대 불가사리 4(4-5)마리 추가 등장'],
    scope: 'adjacent',
    effects: [{ stat: 'packsize', percent: 15 }],
  },
  { id: 'adj-star-2', short: '+6-7 Starfish', text: 'Adjacent Areas contains 6-7 additional Giant Starfish', aliases: ['인접 지역들에 에 거대 불가사리 7(6-7)마리 추가 등장'], scope: 'adjacent', effects: [{ stat: 'packsize', percent: 20 }] },
  { id: 'adj-fracture', short: '2% Fractured Items', text: 'Items dropped in adjacent Areas have 2% chance to be Fractured', aliases: ['인접 지역들에서 떨어지는 아이템이 2% 확률로 분열된 등급'], scope: 'adjacent', effects: [] },
  { id: 'adj-lantern', short: '+4 Gold Lanterns', text: 'Adjacent Areas contain 4 additional Golden Lanterns', aliases: ['인접 지역들에 황금 등불 4개 추가 등장'], scope: 'adjacent', effects: [{ stat: 'treasure', percent: 20 }] },
  { id: 'adj-pantheon', short: 'Pantheon Rares', text: 'Rare Monsters in adjacent Areas will have a Pantheon Modifier', aliases: ['인접 지역들 내 희귀 몬스터가 판테온 속성 1개 보유'], scope: 'adjacent', effects: [{ stat: 'rares', percent: 25 }] },
  { id: 'adj-uring-1', short: '10% Unique Ring', text: 'Rings dropped in adjacent Areas have 10% chance to instead drop as a Unique Ring', aliases: ['인접 지역들에서 떨어지는 반지가 10% 확률로 고유 반지로 떨어짐'], scope: 'adjacent', effects: [{ stat: 'uniques', percent: 20 }] },
  { id: 'adj-uring-2', short: '20% Unique Ring', text: 'Rings dropped in adjacent Areas have 20% chance to instead drop as a Unique Ring', aliases: ['인접 지역들에서 떨어지는 반지가 20% 확률로 고유 반지로 떨어짐'], scope: 'adjacent', effects: [{ stat: 'uniques', percent: 40 }] },
  { id: 'adj-uamu-1', short: '10% Unique Amulet', text: 'Amulets dropped in adjacent Areas have 10% chance to instead drop as a Unique Amulet', aliases: ['인접 지역들에서 떨어지는 목걸이가 10% 확률로 고유 목걸이로 떨어짐'], scope: 'adjacent', effects: [{ stat: 'uniques', percent: 20 }] },
  { id: 'adj-uamu-2', short: '20% Unique Amulet', text: 'Amulets dropped in adjacent Areas have 20% chance to instead drop as a Unique Amulet', aliases: ['인접 지역들에서 떨어지는 목걸이가 20% 확률로 고유 목걸이로 떨어짐'], scope: 'adjacent', effects: [{ stat: 'uniques', percent: 40 }] },
  { id: 'adj-ubelt-1', short: '10% Unique Belt', text: 'Belts dropped in adjacent Areas have 10% chance to instead drop as a Unique Belt', aliases: ['인접 지역들에서 떨어지는 허리띠가 10% 확률로 고유 허리띠로 떨어짐'], scope: 'adjacent', effects: [{ stat: 'uniques', percent: 20 }] },
  { id: 'adj-ubelt-2', short: '20% Unique Belt', text: 'Belts dropped in adjacent Areas have 20% chance to instead drop as a Unique Belt', aliases: ['인접 지역들에서 떨어지는 허리띠가 20% 확률로 고유 허리띠로 떨어짐'], scope: 'adjacent', effects: [{ stat: 'uniques', percent: 40 }] },
]

// ---------------------------------------------------------------------------
// Chart implicits - Voyage (global) pool
// ---------------------------------------------------------------------------
const voyageImplicits: VoyageModDef[] = [
  { id: 'voy-soul', short: 'Soul Eater', text: 'Players in Area have Soul Eater', aliases: ['모든 항해 지역 내 플레이어들이 영혼 포식자 획득'], scope: 'global', effects: [] },
  { id: 'voy-pack-1', text: '5% increased Pack size', aliases: ['모든 항해 지역 내 무리 규모 5% 증가'], scope: 'global', effects: [{ stat: 'packsize', percent: 5 }] },
  { id: 'voy-pack-2', text: '7% increased Pack size', aliases: ['모든 항해 지역 내 무리 규모 7% 증가'], scope: 'global', effects: [{ stat: 'packsize', percent: 7 }] },
  { id: 'voy-quant-1', text: '8% increased Quantity of Items found in this Area', aliases: ['모든 항해 지역에서 발견하는 아이템 수량 8% 증가'], scope: 'global', effects: [{ stat: 'quantity', percent: 8 }] },
  { id: 'voy-quant-2', text: '10% increased Quantity of Items found in this Area', aliases: ['모든 항해 지역에서 발견하는 아이템 수량 10% 증가'], scope: 'global', effects: [{ stat: 'quantity', percent: 10 }] },
  { id: 'voy-rarity-1', text: '7% increased Rarity of Items found in this Area', aliases: ['모든 항해 지역에서 발견하는 아이템 희귀도 7% 증가'], scope: 'global', effects: [{ stat: 'rarity', percent: 7 }] },
  { id: 'voy-rarity-2', text: '9% increased Rarity of Items found in this Area', aliases: ['모든 항해 지역에서 발견하는 아이템 희귀도 9% 증가'], scope: 'global', effects: [{ stat: 'rarity', percent: 9 }] },
  { id: 'voy-jelly', short: 'Friendly Jellyfish', text: 'All Voyage Areas contain Friendly Jellyfish', aliases: ['지역에 살가운 해파리 등장'], scope: 'global', effects: [] },
  { id: 'voy-sulph-1', text: "15% increased Dead Man's Sulphur found in this Area", aliases: ['모든 항해 지역에서 발견하는 망자의 유황 15% 증가'], scope: 'global', effects: [{ stat: 'sulphur', percent: 15 }] },
  { id: 'voy-sulph-2', text: "20% increased Dead Man's Sulphur found in this Area", aliases: ['모든 항해 지역에서 발견하는 망자의 유황 20% 증가'], scope: 'global', effects: [{ stat: 'sulphur', percent: 20 }] },
  { id: 'voy-sulph-3', text: "25% increased Dead Man's Sulphur found in this Area", aliases: ['모든 항해 지역에서 발견하는 망자의 유황 25% 증가'], scope: 'global', effects: [{ stat: 'sulphur', percent: 25 }] },
  { id: 'voy-rare', text: '25% increased number of Rare Monsters', aliases: ['모든 항해 지역 내 희귀 몬스터 수 25% 증가'], scope: 'global', effects: [{ stat: 'rares', percent: 25 }] },
  { id: 'voy-magic', text: '25% increased Magic Monsters', aliases: ['모든 항해 지역 내 마법 몬스터 수 25% 증가'], scope: 'global', effects: [{ stat: 'magicmonsters', percent: 25 }] },
  { id: 'voy-noequip', short: 'No Equipment Drops', text: 'Monsters in all Voyage Areas cannot drop Equipment, Flasks or Tinctures', scope: 'global', effects: [] },
  { id: 'voy-minmagic', short: 'All at least Magic', text: 'Monsters in Area are at least Magic', aliases: ['모든 항해 지역 내 몬스터가 마법 이상으로 등장'], scope: 'global', effects: [{ stat: 'magicmonsters', percent: 30 }] },
  { id: 'voy-possess', short: 'Rares Possessed', text: '100% chance for Rare Monsters in Area to be Possessed', aliases: ['모든 항해 지역 내 희귀 몬스터가 100%의 확률로 사로잡힘'], scope: 'global', effects: [{ stat: 'spirits', percent: 100 }] },
  { id: 'voy-essence', short: 'Rares Essenced', text: 'Rare monsters that are natural inhabitants are imprisoned by Essences', aliases: ['모든 항해 지역 내 자연적으로 서식하는 희귀 몬스터가 에센스에 갇힘'], scope: 'global', effects: [{ stat: 'essences', percent: 40 }] },
  { id: 'voy-fracture', short: '50% Rare Fracture', text: '50% chance for Rare Monsters to Fracture on death', scope: 'global', effects: [{ stat: 'rares', percent: 50 }] },
  { id: 'voy-flask', short: '20% Flask Quality', text: 'Flasks found in all Voyage Areas have 100% chance to have 20% Quality', scope: 'global', effects: [] },
]

export const VOYAGE_MODS: VoyageModDef[] = [...chartMapMods, ...adjacentImplicits, ...voyageImplicits]

// ---------------------------------------------------------------------------
// Border pool ("Corruption Currents") - applies to the touched Area
// ---------------------------------------------------------------------------
export const BORDER_MODS: BorderModDef[] = [
  { id: 'b-pack-1', short: '16% Pack Size', text: '16% increased Pack Size in adjacent Areas', effects: [{ stat: 'packsize', percent: 16 }] },
  { id: 'b-pack-2', short: '24% Pack Size', text: '24% increased Pack Size in adjacent Areas', effects: [{ stat: 'packsize', percent: 24 }] },
  { id: 'b-pack-3', short: '32% Pack Size', text: '32% increased Pack Size in adjacent Areas', effects: [{ stat: 'packsize', percent: 32 }] },
  { id: 'b-minmagic', short: 'At Least Magic', text: 'Monsters in adjacent Areas are at least Magic', effects: [{ stat: 'magicmonsters', percent: 30 }] },
  { id: 'b-rare-1', short: '50% Rares', text: '50% increased number of Rare Monsters in adjacent Areas', effects: [{ stat: 'rares', percent: 50 }] },
  { id: 'b-rare-2', short: '75% Rares', text: '75% increased number of Rare Monsters in adjacent Areas', effects: [{ stat: 'rares', percent: 75 }] },
  { id: 'b-rare-3', short: '100% Rares', text: '100% increased number of Rare Monsters in adjacent Areas', effects: [{ stat: 'rares', percent: 100 }] },
  { id: 'b-beasts-1', short: '+8 Sea Beast Packs', text: 'Adjacent Areas contain 8 additional packs of Sea Beasts', effects: [{ stat: 'packsize', percent: 25 }] },
  { id: 'b-beasts-2', short: '+12 Sea Beast Packs', text: 'Adjacent Areas contain 12 additional packs of Sea Beasts', effects: [{ stat: 'packsize', percent: 35 }] },
  { id: 'b-beasts-3', short: '+16 Sea Beast Packs', text: 'Adjacent Areas contain 16 additional packs of Sea Beasts', effects: [{ stat: 'packsize', percent: 45 }] },
  { id: 'b-crabs-1', short: '+8 Crab Packs', text: 'Adjacent Areas contain 8 additional packs of Crabs', effects: [{ stat: 'packsize', percent: 25 }] },
  { id: 'b-crabs-2', short: '+12 Crab Packs', text: 'Adjacent Areas contain 12 additional packs of Crabs', effects: [{ stat: 'packsize', percent: 35 }] },
  { id: 'b-crabs-3', short: '+16 Crab Packs', text: 'Adjacent Areas contain 16 additional packs of Crabs', effects: [{ stat: 'packsize', percent: 45 }] },
  { id: 'b-drowned-1', short: '+8 Drowned Packs', text: 'Adjacent Areas contain 8 additional packs of the Drowned', effects: [{ stat: 'packsize', percent: 25 }] },
  { id: 'b-drowned-2', short: '+12 Drowned Packs', text: 'Adjacent Areas contain 12 additional packs of the Drowned', effects: [{ stat: 'packsize', percent: 35 }] },
  { id: 'b-drowned-3', short: '+16 Drowned Packs', text: 'Adjacent Areas contain 16 additional packs of the Drowned', effects: [{ stat: 'packsize', percent: 45 }] },
  { id: 'b-mag-1', short: '40% Magnitude', text: 'Adjacent Areas have 40% increased explicit modifier magnitudes', effects: [], magnitude: 40 },
  { id: 'b-mag-2', short: '60% Magnitude', text: 'Adjacent Areas have 60% increased explicit modifier magnitudes', effects: [], magnitude: 60 },
  { id: 'b-mag-3', short: '80% Magnitude', text: 'Adjacent Areas have 80% increased explicit modifier magnitudes', effects: [], magnitude: 80 },
  { id: 'b-keep-1', short: '30% Keep Charts', text: 'Adjacent Charts have 30% chance to not be consumed when beginning a Voyage', effects: [{ stat: 'preserve', percent: 30 }] },
  { id: 'b-keep-2', short: '50% Keep Charts', text: 'Adjacent Charts have 50% chance to not be consumed when beginning a Voyage', effects: [{ stat: 'preserve', percent: 50 }] },
  { id: 'b-octoboss', short: 'Filthscrabble', text: 'Adjacent Areas contain Filthscrabble', effects: [{ stat: 'treasure', percent: 30 }] },
  { id: 'b-lanterns', short: 'Free Lanterns', text: 'Placing Lanterns does not reduce your Lantern count in adjacent Areas', effects: [{ stat: 'sulphur', percent: 20 }] },
  { id: 'b-ancient', short: '+1 Ancient Drop', text: 'Rare Monsters in adjacent Areas drop an additional Ancient Orb', aliases: ['Rare Monsters in adjacent Areas drop 1 additional Ancient Orbs'], effects: [{ stat: 'currency', percent: 30 }] },
  { id: 'b-divine', short: '+1 Divine Drop', text: 'Rare Monsters in adjacent Areas drop an additional Divine Orb', aliases: ['Rare Monsters adjacent in Areas drop 1 additional Divine Orbs'], effects: [{ stat: 'currency', percent: 120 }] },
  { id: 'b-exalt', short: '+1 Exalt Drop', text: 'Rare Monsters in adjacent Areas drop an additional Exalted Orb', aliases: ['Rare Monsters in adjacent Areas drop 1 additional Exalted Orbs'], effects: [{ stat: 'currency', percent: 45 }] },
  { id: 'b-annul', short: '+1 Annul Drop', text: 'Rare Monsters in adjacent Areas drop an additional Orb of Annulment', aliases: ['Rare Monsters in adjacent Areas drop 1 additional Orbs of Annulment'], effects: [{ stat: 'currency', percent: 25 }] },
  { id: 'b-chaos', short: '+1 Chaos Drop', text: 'Rare Monsters in adjacent Areas drop an additional Chaos Orb', aliases: ['Rare Monsters in adjacent Areas drop 1 additional Chaos Orbs'], effects: [{ stat: 'currency', percent: 15 }] },
  { id: 'b-vaal', short: '+1 Vaal Drop', text: 'Rare Monsters in adjacent Areas drop an additional Vaal Orb', aliases: ['Rare Monsters in adjacent Areas drop 1 additional Vaal Orbs'], effects: [{ stat: 'currency', percent: 10 }] },
  { id: 'b-gcp', short: '+1 GCP Drop', text: "Rare Monsters in adjacent Areas drop an additional Gemcutter's Prism", aliases: ["Rare Monsters in adjacent Areas drop 1 additional Gemcutter's Prisms"], effects: [{ stat: 'currency', percent: 12 }] },
  { id: 'b-chrome', short: '+1 Chromatic Drop', text: 'Rare Monsters in adjacent Areas drop an additional Chromatic Orb', aliases: ['Rare Monsters in adjacent Areas drop 1 additional Chromatic Orbs'], effects: [{ stat: 'currency', percent: 3 }] },
  { id: 'b-regret', short: '+1 Regret Drop', text: 'Rare Monsters in adjacent Areas drop an additional Orb of Regret', aliases: ['Rare Monsters in adjacent Areas drop 1 additional Orbs of Regret'], effects: [{ stat: 'currency', percent: 8 }] },
  { id: 'b-blessed', short: '+1 Blessed Drop', text: 'Rare Monsters in adjacent Areas drop an additional Blessed Orb', aliases: ['Rare Monsters in adjacent Areas drop 1 additional Blessed Orbs'], effects: [{ stat: 'currency', percent: 5 }] },
  { id: 'b-regal', short: '+1 Regal Drop', text: 'Rare Monsters in adjacent Areas drop an additional Regal Orb', aliases: ['Rare Monsters in adjacent Areas drop 1 additional Regal Orbs'], effects: [{ stat: 'currency', percent: 8 }] },
  { id: 'b-support', short: '20% Support Gem', text: 'Rare Monsters in adjacent Areas have 20% chance to drop a Support Gem', effects: [{ stat: 'currency', percent: 15 }] },
  { id: 'b-locker', short: "Pirate's Locker", text: "Adjacent Areas contain a lost Pirate's Locker", effects: [{ stat: 'treasure', percent: 30 }] },
  { id: 'b-pirates', short: 'Brinerot Party', text: 'Adjacent Areas contain a Brinerot raiding party', effects: [{ stat: 'packsize', percent: 20 }] },
  { id: 'b-rareconn-1', short: '50% Rares / Conn', text: '50% increased number of Rare monsters in adjacent Areas per connection', effects: [], perConnEffects: [{ stat: 'rares', percent: 50 }] },
  { id: 'b-rareconn-2', short: '75% Rares / Conn', text: '75% increased number of Rare monsters in adjacent Areas per connection', effects: [], perConnEffects: [{ stat: 'rares', percent: 75 }] },
  { id: 'b-quantconn-1', short: '120% Qty, -50%/Conn', text: '50% reduced Quantity of Items found in adjacent Areas per connection 120% increased Quantity of Items found in adjacent Areas', effects: [{ stat: 'quantity', percent: 120 }], perConnEffects: [{ stat: 'quantity', percent: -50 }] },
  { id: 'b-quantconn-2', short: '180% Qty, -50%/Conn', text: '50% reduced Quantity of Items found in adjacent Areas per connection 180% increased Quantity of Items found in adjacent Areas', effects: [{ stat: 'quantity', percent: 180 }], perConnEffects: [{ stat: 'quantity', percent: -50 }] },
  { id: 'b-gold-1', short: '25% Gear to Gold', text: '25% of Equipment dropped by monsters in adjacent Areas is converted to Gold', effects: [{ stat: 'gold', percent: 25 }] },
  { id: 'b-gold-2', short: '50% Gear to Gold', text: '50% of Equipment dropped by monsters in adjacent Areas is converted to Gold', effects: [{ stat: 'gold', percent: 50 }] },
  { id: 'b-decks', short: 'Stacked Decks', text: 'Basic Currency items dropped by Monsters in adjacent Areas will instead drop as Stacked Decks', effects: [{ stat: 'divcards', percent: 40 }] },
  { id: 'b-scarabdrop', short: '+1 Scarab Drop', text: 'Rare Monsters in adjacent Areas drop an additional Scarab', aliases: ['Rare Monsters in adjacent Areas drop 1 additional Scarabs'], effects: [{ stat: 'scarabs', percent: 25 }] },
  { id: 'b-curr-1', short: '50% Currency', text: '50% more Currency found in adjacent Areas', effects: [{ stat: 'currency', percent: 50 }] },
  { id: 'b-curr-2', short: '75% Currency', text: '75% more Currency found in adjacent Areas', effects: [{ stat: 'currency', percent: 75 }] },
  { id: 'b-curr-3', short: '100% Currency', text: '100% more Currency found in adjacent Areas', effects: [{ stat: 'currency', percent: 100 }] },
  { id: 'b-scarab-1', short: '50% Scarabs', text: '50% more Scarabs found in adjacent Areas', effects: [{ stat: 'scarabs', percent: 50 }] },
  { id: 'b-scarab-2', short: '75% Scarabs', text: '75% more Scarabs found in adjacent Areas', effects: [{ stat: 'scarabs', percent: 75 }] },
  { id: 'b-scarab-3', short: '100% Scarabs', text: '100% more Scarabs found in adjacent Areas', effects: [{ stat: 'scarabs', percent: 100 }] },
  { id: 'b-rarity-1', short: '50% Rarity', text: '50% more Rarity of Items found in adjacent Areas', effects: [{ stat: 'rarity', percent: 50 }] },
  { id: 'b-rarity-2', short: '75% Rarity', text: '75% more Rarity of Items found in adjacent Areas', effects: [{ stat: 'rarity', percent: 75 }] },
  { id: 'b-rarity-3', short: '100% Rarity', text: '100% more Rarity of Items found in adjacent Areas', effects: [{ stat: 'rarity', percent: 100 }] },
  { id: 'b-crabboss', short: 'Captainsbane', text: 'Adjacent Areas contain Captainsbane', effects: [{ stat: 'treasure', percent: 30 }] },
  { id: 'b-exp-1', short: '100% XP', text: 'Players in adjacent Areas gain 100% increased Experience', effects: [{ stat: 'exp', percent: 100 }] },
  { id: 'b-exp-2', short: '150% XP', text: 'Players in adjacent Areas gain 150% increased Experience', effects: [{ stat: 'exp', percent: 150 }] },
  { id: 'b-exp-3', short: '200% XP', text: 'Players in adjacent Areas gain 200% increased Experience', effects: [{ stat: 'exp', percent: 200 }] },
  { id: 'b-magicmods', short: 'Magic +1 Mod', text: 'Magic Monsters in adjacent Areas have an additional modifier', effects: [{ stat: 'magicmonsters', percent: 20 }] },
  { id: 'b-anchor-1', short: '+2 Anchors', text: 'Adjacent Areas contain 2 additional Treasure Anchors', effects: [{ stat: 'treasure', percent: 35 }] },
  { id: 'b-anchor-2', short: '+4 Anchors', text: 'Adjacent Areas contain 4 additional Treasure Anchors', effects: [{ stat: 'treasure', percent: 65 }] },
  { id: 'b-sulphdrop', short: 'Rares Drop Sulphur', text: "Rare Monsters in adjacent Areas drop Dead Man's Sulphur", effects: [{ stat: 'sulphur', percent: 35 }] },
  { id: 'b-goldlantern', short: '+4 Gold Lanterns', text: 'Adjacent Areas contain 4 additional Golden Lanterns', effects: [{ stat: 'treasure', percent: 20 }] },
  { id: 'b-izaro', short: '2 Goddess Altars', text: 'Adjacent Areas contain 2 Altars to the Goddess', effects: [{ stat: 'treasure', percent: 30 }] },
]

export const voyageModById = new Map(VOYAGE_MODS.map((m) => [m.id, m]))
export const borderModById = new Map(BORDER_MODS.map((m) => [m.id, m]))
