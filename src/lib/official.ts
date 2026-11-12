// 공식 저장소에서 뽑은 데이터 (scripts/export-official.mjs → public/data/official.json)

export interface Evolution {
  from: number;
  fromForm: string | null;
  to: number;
  toForm: string | null;
  level: number;
  /** 한국어 조건 문장 (예: "레벨 16", "아이템 사용: 물의돌 (슈퍼)") */
  text: string[];
}

export type PoolTier =
  | "COMMON"
  | "UNCOMMON"
  | "RARE"
  | "SUPER_RARE"
  | "ULTRA_RARE"
  | "BOSS"
  | "BOSS_RARE"
  | "BOSS_SUPER_RARE"
  | "BOSS_ULTRA_RARE";

export interface Biome {
  id: number;
  key: string;
  name: string;
  /** 다음 바이옴. chance 1 이면 항상 후보, 1/n 이면 그 확률로만 후보에 오른다 */
  links: { to: number; chance: number }[];
  trainerChance: number;
  weather: { key: string; weight: number }[];
  pokemon: { tier: PoolTier; species: { id: number; time: "ALL" | "DAWN" | "DAY" | "DUSK" | "NIGHT" }[] }[];
  trainers: { tier: PoolTier; trainers: { type: string; name: string }[] }[];
}

export interface Trainer {
  type: string;
  name: string;
  specialty: string | null;
  /** 관장 대표 포켓몬 (자리별 후보) */
  signature: number[][] | null;
  /** 자리 번호별 고정 후보 (사천왕·챔피언·악의 조직 보스) */
  slots: TrainerSlot[];
  gymLeader: boolean;
  /** 관장의 세대 (관장이 아니면 null) */
  gen: number | null;
  /** 관장으로 나오는 바이옴 */
  biomes: number[];
}

export interface TrainerSlot {
  slot: number;
  /** 후보 SpeciesId (그중 하나) */
  species: number[];
  /** 고정 폼 (메가·거다이맥스 등). 여러 개면 그중 하나 */
  forms?: number[];
  /** 보스 실드가 있는 포켓몬 */
  boss?: boolean;
}

/**
 * 고정 배틀 후보 목록의 순서 (fixed-battle-configs.ts). 한 판 안에서 악의 조직 웨이브끼리,
 * 사천왕·챔피언끼리는 같은 시드로 같은 칸을 고른다. 칸 번호 → 지방/조직.
 */
export const REGIONS: { name: string; gen: number }[] = [
  { name: "관동", gen: 1 },
  { name: "성도", gen: 2 },
  { name: "호연", gen: 3 },
  { name: "신오", gen: 4 },
  { name: "하나", gen: 5 },
  { name: "칼로스", gen: 6 },
  { name: "알로라", gen: 7 },
  { name: "가라르", gen: 8 },
  { name: "팔데아", gen: 9 },
  { name: "블루베리 아카데미", gen: 9 },
];
export const EVIL_TEAMS: { name: string; gens: number[] }[] = [
  { name: "로켓단", gens: [1, 2] },
  { name: "마그마단", gens: [3] },
  { name: "아쿠아단", gens: [3] },
  { name: "갤럭시단", gens: [4] },
  { name: "플라스마단", gens: [5] },
  { name: "플레어단", gens: [6] },
  { name: "에테르재단", gens: [7] },
  { name: "스컬단", gens: [7] },
  { name: "매크로코스모스", gens: [8] },
  { name: "스타단", gens: [9] },
];

export interface FixedWave {
  wave: number;
  key: string;
  /** 후보 트레이너. 안쪽 배열은 그중 하나가 나오는 묶음 */
  trainers: string[][];
}

export interface OfficialData {
  source: { name: string; url: string; license: string; gameVersion: string; commit: string };
  evolutions: Evolution[];
  biomes: Biome[];
  trainers: Trainer[];
  fixedWaves: FixedWave[];
}

/** 비보스 야생 포켓몬 등급 확률 (Arena.generateNonBossBiomeTier: 0~511 중) */
export const WILD_TIER_CHANCE: Partial<Record<PoolTier, number>> = {
  COMMON: 356 / 512,
  UNCOMMON: 124 / 512,
  RARE: 26 / 512,
  SUPER_RARE: 5 / 512,
  ULTRA_RARE: 1 / 512,
};
/** 보스 포켓몬 등급 확률 (Arena.generateBossBiomeTier: 0~63 중) */
export const BOSS_TIER_CHANCE: Partial<Record<PoolTier, number>> = {
  BOSS: 44 / 64,
  BOSS_RARE: 14 / 64,
  BOSS_SUPER_RARE: 5 / 64,
  BOSS_ULTRA_RARE: 1 / 64,
};
export const TIER_NAMES: Record<PoolTier, string> = {
  COMMON: "흔함",
  UNCOMMON: "가끔",
  RARE: "드묾",
  SUPER_RARE: "매우 드묾",
  ULTRA_RARE: "극히 드묾",
  BOSS: "보스",
  BOSS_RARE: "보스 드묾",
  BOSS_SUPER_RARE: "보스 매우 드묾",
  BOSS_ULTRA_RARE: "보스 극히 드묾",
};
export const TIME_NAMES: Record<string, string> = { ALL: "", DAWN: "새벽", DAY: "낮", DUSK: "황혼", NIGHT: "밤" };

/** 게임의 영어 타입 키 → Dex 한국어 타입 이름 */
export const TYPE_KEY_KO: Record<string, string> = {
  NORMAL: "노말", FIRE: "불꽃", WATER: "물", ELECTRIC: "전기", GRASS: "풀", ICE: "얼음", FIGHTING: "격투",
  POISON: "독", GROUND: "땅", FLYING: "비행", PSYCHIC: "에스퍼", BUG: "벌레", ROCK: "바위", GHOST: "고스트",
  DRAGON: "드래곤", DARK: "악", STEEL: "강철", FAIRY: "페어리",
};

/** 클래식 웨이브의 기준 레벨 (Battle.getLevelForWave 의 기본식. 실제로는 ±오차와 트레이너별 보정이 있다) */
export function baseLevelForWave(wave: number): number {
  return Math.round(1 + wave / 2 + Math.pow(wave / 25, 2));
}

/** 클래식 관장 웨이브: 30으로 나눈 나머지가 20 (판에 따라 0) */
export const GYM_WAVES = [20, 50, 80, 110, 140, 170];

export class Official {
  readonly biomeById = new Map<number, Biome>();
  readonly trainerByType = new Map<string, Trainer>();
  private readonly evoByTo = new Map<number, Evolution[]>();

  constructor(readonly data: OfficialData) {
    for (const b of data.biomes) this.biomeById.set(b.id, b);
    for (const t of data.trainers) this.trainerByType.set(t.type, t);
    for (const e of data.evolutions) {
      const list = this.evoByTo.get(e.to);
      if (list) list.push(e);
      else this.evoByTo.set(e.to, [e]);
    }
  }

  /** 이 종(SpeciesId)으로 진화하는 방법들 (같은 문장은 한 번만) */
  evolutionsTo(id: number): Evolution[] {
    const seen = new Set<string>();
    return (this.evoByTo.get(id) ?? []).filter((e) => {
      const k = `${e.from}:${e.text.join("|")}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  trainerName(type: string): string {
    return this.trainerByType.get(type)?.name ?? type;
  }
}

export async function fetchOfficial(url = `${import.meta.env.BASE_URL}data/official.json`): Promise<Official | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return new Official((await res.json()) as OfficialData);
  } catch {
    return null;
  }
}
