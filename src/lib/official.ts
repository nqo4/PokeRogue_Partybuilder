// 공식 저장소에서 뽑은 데이터 (scripts/export-official.mjs → public/data/official.json)

export interface Evolution {
  from: number;
  fromForm: string | null;
  to: number;
  toForm: string | null;
  level: number;
  /** 한국어 조건 문장 (예: "레벨 16", "아이템 사용: 물의돌 (슈퍼)") */
  text: string[];
  /** 진화 아이템 그림 키 (itemSprites) */
  item?: string | null;
}

/** 폼 변화: 메가진화·거다이맥스·원시회귀·오리진폼·아이템·날씨 등 */
export interface FormChange {
  species: number;
  /** 게임 formIndex (Dex 의 같은 SpeciesId 안 순서) */
  fromForm: number;
  toForm: number;
  /** 한국어 조건 문장 (예: "리자몽나이트 X를 통해 폼체인지") */
  text: string;
  /** 필요한 아이템 그림 키 (itemSprites) */
  items: string[];
}

/** 아이템 스프라이트 시트(public/images/items.png) 안의 한 칸 */
export interface ItemSprite {
  /** 게임 상점 등급: common 노말, great 슈퍼, ultra 하이퍼, rogue 로그, master 마스터 */
  tier?: "common" | "great" | "ultra" | "rogue" | "master";
  x: number;
  y: number;
  w: number;
  h: number;
  /** 원래 칸(sw×sh) 안에서 그림이 놓인 위치 */
  ox: number;
  oy: number;
  sw: number;
  sh: number;
  /** 한국어 아이템 이름 */
  name: string;
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
  formChanges?: FormChange[];
  itemSprites?: Record<string, ItemSprite>;
  itemAtlas?: { w: number; h: number } | null;
  /** 스타터 사탕 색 [바탕, 덧그림] (SpeciesId 문자열 → 16진 색) */
  starterColors?: Record<string, [string, string]>;
  /** 게임의 전체 스타터 목록 (getAllStarters 순서 그대로). 포켓러스 계산에 쓴다 */
  starterIds?: number[];
  /** 검증용: 게임 코드로 뽑은 날짜별 포켓러스 */
  pokerusSamples?: { date: string; ids: number[] }[];
  /** 알 뽑기 전설 픽업 후보 (getValidLegendaryGachaSpecies 순서 그대로) */
  legendaryGachaIds?: number[];
  /** 검증용: 게임 코드로 뽑은 날짜별 전설 픽업 */
  legendarySamples?: { date: string; id: number }[];
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
// 순서 = 게임의 타입 순서 (필터·목록에 이 순서대로 나온다)
export const TYPE_KEY_KO: Record<string, string> = {
  NORMAL: "노말", FIGHTING: "격투", FLYING: "비행", POISON: "독", GROUND: "땅", ROCK: "바위",
  BUG: "벌레", GHOST: "고스트", STEEL: "강철", FIRE: "불꽃", WATER: "물", GRASS: "풀",
  ELECTRIC: "전기", PSYCHIC: "에스퍼", ICE: "얼음", DRAGON: "드래곤", DARK: "악", FAIRY: "페어리",
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
  private readonly evoByFrom = new Map<number, Evolution[]>();

  constructor(readonly data: OfficialData) {
    for (const b of data.biomes) this.biomeById.set(b.id, b);
    for (const t of data.trainers) this.trainerByType.set(t.type, t);
    for (const e of data.evolutions) {
      const list = this.evoByTo.get(e.to);
      if (list) list.push(e);
      else this.evoByTo.set(e.to, [e]);
      const from = this.evoByFrom.get(e.from);
      if (from) from.push(e);
      else this.evoByFrom.set(e.from, [e]);
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

  /** 이 종(SpeciesId)에서 진화해 닿을 수 있는 모든 종 (자기 자신 포함, 리전폼 진화 포함) */
  evolutionLine(id: number): number[] {
    const out = [id];
    for (let i = 0; i < out.length; i++) {
      for (const e of this.evoByFrom.get(out[i]) ?? []) if (!out.includes(e.to)) out.push(e.to);
    }
    return out;
  }

  /** 이 종의 이 폼으로 바뀌는 조건 */
  formChangesTo(id: number, formIndex: number): FormChange[] {
    return (this.data.formChanges ?? []).filter((f) => f.species === id && f.toForm === formIndex);
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
