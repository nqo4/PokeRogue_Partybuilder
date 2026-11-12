// 게임 규칙 계산 (공식 클라이언트 pagefaultgames/pokerogue 와 대조해서 확인한 것만 둔다)

/** DexAttr (src/enums/dex-attr.ts) */
export const DexAttr = {
  NON_SHINY: 1n,
  SHINY: 2n,
  MALE: 4n,
  FEMALE: 8n,
  DEFAULT_VARIANT: 16n,
  VARIANT_2: 32n,
  VARIANT_3: 64n,
  DEFAULT_FORM: 128n,
} as const;

/** AbilityAttr (src/enums/ability-attr.ts) */
export const AbilityAttr = { ABILITY_1: 1, ABILITY_2: 2, ABILITY_HIDDEN: 4 } as const;

/** Passive (src/enums/passive.ts) */
export const PassiveAttr = { UNLOCKED: 1, ENABLED: 2 } as const;

/** 코스트 감소를 반영한 실제 코스트.
 * GameData.getSpeciesStarterValue 와 같은 규칙: 감소 1회마다 1보다 크면 −1, 1 이하이면 절반. */
export function starterCost(baseCost: number, valueReduction: number): number {
  let cost = baseCost;
  for (let v = 0; v < valueReduction; v++) cost = cost > 1 ? cost - 1 : cost / 2;
  return cost;
}

/** 보유한 이로치 중 가장 높은 티어 (0 = 이로치 없음). 파티 럭에 그대로 더해진다. */
export function bestShinyTier(caughtAttr: bigint): 0 | 1 | 2 | 3 {
  if (!(caughtAttr & DexAttr.SHINY)) return 0;
  if (caughtAttr & DexAttr.VARIANT_3) return 3;
  if (caughtAttr & DexAttr.VARIANT_2) return 2;
  return 1;
}

/** Nature enum 순서 (src/enums/nature.ts) */
export const NATURE_NAMES = [
  "노력", "외로움", "용감", "고집", "개구쟁이",
  "대담", "온순", "무사태평", "장난꾸러기", "촐랑",
  "겁쟁이", "성급", "성실", "명랑", "천진난만",
  "조심", "의젓", "냉정", "수줍음", "덜렁",
  "차분", "얌전", "건방", "신중", "변덕",
] as const;

/** 성격표의 행·열 순서는 공격, 방어, 스피드, 특공, 특방이다. 이를 능력치 인덱스(1 공격 … 5 스피드)로 바꾼다. */
const NATURE_GRID_STAT = [1, 2, 5, 3, 4] as const;

/** 성격별 [올리는 능력치, 내리는 능력치] (능력치 인덱스: 1 공격, 2 방어, 3 특공, 4 특방, 5 스피드). 무보정 성격은 null */
export const NATURE_EFFECT: ([number, number] | null)[] = NATURE_NAMES.map((_, n) => {
  const up = NATURE_GRID_STAT[Math.floor(n / 5)];
  const down = NATURE_GRID_STAT[n % 5];
  return up === down ? null : [up, down];
});

export function unlockedNatures(natureAttr: number): number[] {
  const out: number[] = [];
  for (let n = 0; n < NATURE_NAMES.length; n++) if (natureAttr & (1 << (n + 1))) out.push(n);
  return out;
}

export function popcount(n: number): number {
  let c = 0;
  for (let v = n >>> 0; v; v >>>= 1) c += v & 1;
  return c;
}
