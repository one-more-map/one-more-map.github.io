import type { BORDER_MODS } from './mods'

export type KoreanBorderEvidenceSource =
  | 'client-screenshot'
  | 'confirmed-numeric-variant'

export interface KoreanBorderModEvidence {
  text: string
  source: KoreanBorderEvidenceSource
  derivedFrom?: string
}

type BorderModId = (typeof BORDER_MODS)[number]['id']

/**
 * Korean border-mod wording confirmed by the player.
 *
 * `client-screenshot` rows are transcribed verbatim from the Korean client.
 * `confirmed-numeric-variant` rows use a player-confirmed rule: when only the
 * numeric tier changes, the already observed Korean sentence template stays
 * exact. PoEDB-only wording is deliberately not promoted into this table.
 */
export const KOREAN_BORDER_MOD_EVIDENCE = {
  'b-pack-1': {
    text: '인접 지역들 내 무리 규모 16% 증가',
    source: 'client-screenshot',
  },
  'b-pack-2': {
    text: '인접 지역들 내 무리 규모 24% 증가',
    source: 'confirmed-numeric-variant',
    derivedFrom: 'b-pack-1',
  },
  'b-pack-3': {
    text: '인접 지역들 내 무리 규모 32% 증가',
    source: 'confirmed-numeric-variant',
    derivedFrom: 'b-pack-1',
  },
  'b-minmagic': {
    text: '인접 지역들 내 몬스터가 마법 이상으로 등장',
    source: 'client-screenshot',
  },
  'b-rare-1': {
    text: '인접 지역들 내 희귀 몬스터 수 50% 증가',
    source: 'confirmed-numeric-variant',
    derivedFrom: 'b-rare-2',
  },
  'b-rare-2': {
    text: '인접 지역들 내 희귀 몬스터 수 75% 증가',
    source: 'client-screenshot',
  },
  'b-rare-3': {
    text: '인접 지역들 내 희귀 몬스터 수 100% 증가',
    source: 'confirmed-numeric-variant',
    derivedFrom: 'b-rare-2',
  },
  'b-beasts-1': {
    text: '인접 지역에 바다 야수 무리 8개 추가 등장',
    source: 'confirmed-numeric-variant',
    derivedFrom: 'b-beasts-2',
  },
  'b-beasts-2': {
    text: '인접 지역에 바다 야수 무리 12개 추가 등장',
    source: 'client-screenshot',
  },
  'b-beasts-3': {
    text: '인접 지역에 바다 야수 무리 16개 추가 등장',
    source: 'confirmed-numeric-variant',
    derivedFrom: 'b-beasts-2',
  },
  'b-crabs-1': {
    text: '인접 지역에 게 무리 8개 추가 등장',
    source: 'client-screenshot',
  },
  'b-crabs-2': {
    text: '인접 지역에 게 무리 12개 추가 등장',
    source: 'confirmed-numeric-variant',
    derivedFrom: 'b-crabs-1',
  },
  'b-crabs-3': {
    text: '인접 지역에 게 무리 16개 추가 등장',
    source: 'confirmed-numeric-variant',
    derivedFrom: 'b-crabs-1',
  },
  'b-drowned-1': {
    text: '인접 지역에 물에 빠진 자 무리 8개 추가 등장',
    source: 'confirmed-numeric-variant',
    derivedFrom: 'b-drowned-3',
  },
  'b-drowned-2': {
    text: '인접 지역에 물에 빠진 자 무리 12개 추가 등장',
    source: 'confirmed-numeric-variant',
    derivedFrom: 'b-drowned-3',
  },
  'b-drowned-3': {
    text: '인접 지역에 물에 빠진 자 무리 16개 추가 등장',
    source: 'client-screenshot',
  },
  'b-mag-1': {
    text: '인접 지역들의 비고정 속성 규모 40% 증가',
    source: 'client-screenshot',
  },
  'b-mag-2': {
    text: '인접 지역들의 비고정 속성 규모 60% 증가',
    source: 'confirmed-numeric-variant',
    derivedFrom: 'b-mag-1',
  },
  'b-mag-3': {
    text: '인접 지역들의 비고정 속성 규모 80% 증가',
    source: 'confirmed-numeric-variant',
    derivedFrom: 'b-mag-1',
  },
  'b-keep-1': {
    text: '항해 시작 시 30% 확률로 인접 해도들이 소모되지 않음',
    source: 'client-screenshot',
  },
  'b-keep-2': {
    text: '항해 시작 시 50% 확률로 인접 해도들이 소모되지 않음',
    source: 'confirmed-numeric-variant',
    derivedFrom: 'b-keep-1',
  },
  'b-octoboss': {
    text: '인접 지역들에 오물더듬이 등장',
    source: 'client-screenshot',
  },
  'b-lanterns': {
    text: '등불을 배치해도 인접 지역들의 등불 개수가 감소하지 않음',
    source: 'client-screenshot',
  },
  'b-locker': {
    text: '인접 지역에 잃어버린 해적의 사물함 등장',
    source: 'client-screenshot',
  },
  'b-ancient': {
    text: '인접 지역 내 희귀 몬스터가 고대의 오브 1개를 추가로 떨어뜨림',
    source: 'client-screenshot',
  },
  'b-chaos': {
    text: '인접 지역들 내 희귀 몬스터가 카오스 오브 1개를 추가로 떨어뜨림',
    source: 'client-screenshot',
  },
  'b-divine': {
    text: '인접 지역 내 희귀 몬스터가 신성한 오브 1개를 추가로 떨어뜨림',
    source: 'client-screenshot',
  },
  'b-vaal': {
    text: '인접 지역들 내 희귀 몬스터가 바알 오브 1개를 추가로 떨어뜨림',
    source: 'client-screenshot',
  },
  'b-regret': {
    text: '인접 지역들 내 희귀 몬스터가 후회의 오브 1개를 추가로 떨어뜨림',
    source: 'client-screenshot',
  },
  'b-blessed': {
    text: '인접 지역들 내 희귀 몬스터가 축복의 오브 1개를 추가로 떨어뜨림',
    source: 'client-screenshot',
  },
  'b-rareconn-1': {
    text: '연결 하나당 인접 지역 내 희귀 몬스터 수 50% 증가',
    source: 'confirmed-numeric-variant',
    derivedFrom: 'b-rareconn-2',
  },
  'b-rareconn-2': {
    text: '연결 하나당 인접 지역 내 희귀 몬스터 수 75% 증가',
    source: 'client-screenshot',
  },
  'b-quantconn-1': {
    text: '연결 하나당 인접 지역들에서 발견하는 아이템 수량 50% 감소\n인접 지역들에서 발견하는 아이템 수량 120% 증가',
    source: 'client-screenshot',
  },
  'b-quantconn-2': {
    text: '연결 하나당 인접 지역들에서 발견하는 아이템 수량 50% 감소\n인접 지역들에서 발견하는 아이템 수량 180% 증가',
    source: 'client-screenshot',
  },
  'b-gold-1': {
    text: '인접 지역 내 몬스터가 떨어뜨리는 장비의 25%가 골드로 전환',
    source: 'client-screenshot',
  },
  'b-gold-2': {
    text: '인접 지역 내 몬스터가 떨어뜨리는 장비의 50%가 골드로 전환',
    source: 'confirmed-numeric-variant',
    derivedFrom: 'b-gold-1',
  },
  'b-decks': {
    text: '인접 지역들에서 몬스터가 떨어뜨리는 기본 화폐 아이템이 카드 묶음으로 떨어짐',
    source: 'client-screenshot',
  },
  'b-scarabdrop': {
    text: '인접 지역 내 희귀 몬스터가 갑충석 1개를 추가로 떨어뜨림',
    source: 'client-screenshot',
  },
  'b-curr-1': {
    text: '인접 지역들에서 발견하는 화폐 50% 증폭',
    source: 'client-screenshot',
  },
  'b-curr-2': {
    text: '인접 지역들에서 발견하는 화폐 75% 증폭',
    source: 'confirmed-numeric-variant',
    derivedFrom: 'b-curr-1',
  },
  'b-curr-3': {
    text: '인접 지역들에서 발견하는 화폐 100% 증폭',
    source: 'confirmed-numeric-variant',
    derivedFrom: 'b-curr-1',
  },
  'b-scarab-1': {
    text: '인접 지역들에서 발견하는 갑충석 50% 증폭',
    source: 'client-screenshot',
  },
  'b-scarab-2': {
    text: '인접 지역들에서 발견하는 갑충석 75% 증폭',
    source: 'confirmed-numeric-variant',
    derivedFrom: 'b-scarab-1',
  },
  'b-scarab-3': {
    text: '인접 지역들에서 발견하는 갑충석 100% 증폭',
    source: 'confirmed-numeric-variant',
    derivedFrom: 'b-scarab-1',
  },
  'b-rarity-1': {
    text: '인접 지역들에서 발견하는 아이템 희귀도 50% 증폭',
    source: 'confirmed-numeric-variant',
    derivedFrom: 'b-rarity-2',
  },
  'b-rarity-2': {
    text: '인접 지역들에서 발견하는 아이템 희귀도 75% 증폭',
    source: 'client-screenshot',
  },
  'b-rarity-3': {
    text: '인접 지역들에서 발견하는 아이템 희귀도 100% 증폭',
    source: 'confirmed-numeric-variant',
    derivedFrom: 'b-rarity-2',
  },
  'b-crabboss': {
    text: '인접 지역에 지휘관의 파멸 등장',
    source: 'client-screenshot',
  },
  'b-exp-1': {
    text: '인접 지역들 내 플레이어들이 획득하는 경험치 100% 증가',
    source: 'client-screenshot',
  },
  'b-exp-2': {
    text: '인접 지역들 내 플레이어들이 획득하는 경험치 150% 증가',
    source: 'confirmed-numeric-variant',
    derivedFrom: 'b-exp-1',
  },
  'b-exp-3': {
    text: '인접 지역들 내 플레이어들이 획득하는 경험치 200% 증가',
    source: 'confirmed-numeric-variant',
    derivedFrom: 'b-exp-1',
  },
  'b-anchor-1': {
    text: '인접 지역들에 보물 닻 2개 추가 등장',
    source: 'client-screenshot',
  },
  'b-anchor-2': {
    text: '인접 지역들에 보물 닻 4개 추가 등장',
    source: 'client-screenshot',
  },
  'b-sulphdrop': {
    text: '인접 지역들 내 희귀 몬스터가 망자의 유황을 떨어뜨림',
    source: 'client-screenshot',
  },
  'b-goldlantern': {
    text: '인접 지역들에 황금 등불 4개 추가 등장',
    source: 'client-screenshot',
  },
  'b-izaro': {
    text: '인접 지역들에 여신에게 바치는 제단 2개 등장',
    source: 'client-screenshot',
  },
} as const satisfies Partial<Record<BorderModId, KoreanBorderModEvidence>>
