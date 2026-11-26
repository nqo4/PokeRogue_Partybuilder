// 리본: 세이브 dexData[종].ribbons 에 16진수 비트 문자열로 저장된다.
// 비트 정의는 공식 클라이언트 src/system/ribbons/ribbon-data.ts, 이름은 pokerogue-locales ko/ribbons.json 과 같다.
// 리본은 파티에 있던 포켓몬과 그 진화 전 단계 전부에 붙으므로, 스타터 종의 dexData 에서 읽으면 된다.
import { gameTypeIndex, type Dex, type DexSpecies } from "./dex";
import type { OwnedStarter } from "./starters";

export interface RibbonDef {
  bit: number;
  key: string;
  name: string;
  /** Image file in public/images/ribbons (official item image, same as the game's ribbonFlagToAssetKey) */
  icon: string;
  /** Mono generation (1-9) or mono type (game type index 0-17) this ribbon needs, if any */
  gen?: number;
  gameType?: number;
}

const TYPE_KEYS = ["Normal", "Fighting", "Flying", "Poison", "Ground", "Rock", "Bug", "Ghost", "Steel", "Fire", "Water", "Grass", "Electric", "Psychic", "Ice", "Dragon", "Dark", "Fairy"];
const TYPE_NAMES = ["노말", "격투", "비행", "독", "땅", "바위", "벌레", "고스트", "강철", "불꽃", "물", "풀", "전기", "에스퍼", "얼음", "드래곤", "악", "페어리"];

/** 게임의 모든 리본 (39종). 순서는 게임 도감의 리본 표시 순서와 비슷하게 묶었다 */
// Ribbons without their own image use the game's fallback "ribbon_typeless"
const TYPELESS = "ribbon_typeless";

export const RIBBONS: RibbonDef[] = [
  { bit: 27, key: "classic", name: "클래식", icon: "classic_ribbon_default" },
  { bit: 29, key: "friendship", name: "친밀 맥스", icon: "ribbon_friendship" },
  { bit: 32, key: "freshStart", name: "새 출발", icon: "fresh_start_ribbon" },
  { bit: 33, key: "hardcore", name: "하드코어", icon: "hardcore_ribbon" },
  { bit: 34, key: "limitedCatch", name: "포획 제한", icon: TYPELESS },
  { bit: 28, key: "nuzlocke", name: "너즐록", icon: TYPELESS },
  { bit: 35, key: "noHeal", name: "회복 없음", icon: TYPELESS },
  { bit: 36, key: "noShop", name: "상점 없음", icon: TYPELESS },
  { bit: 37, key: "noSupport", name: "회복 제한", icon: TYPELESS },
  ...Array.from({ length: 9 }, (_, i) => ({
    bit: 18 + i,
    key: `monoGen${i + 1}`,
    name: `단일 ${i + 1}세대`,
    icon: `ribbon_gen${i + 1}`,
    gen: i + 1,
  })),
  ...TYPE_KEYS.map((k, i) => ({
    bit: i,
    key: `mono${k}`,
    name: `단일 ${TYPE_NAMES[i]}`,
    icon: `ribbon_${k.toLowerCase()}`,
    gameType: i,
  })),
  { bit: 38, key: "activePassives", name: "패시브", icon: TYPELESS },
  { bit: 31, key: "inverse", name: "거꾸로 배틀", icon: "inverse_ribbon" },
  { bit: 30, key: "flipStats", name: "능력치 역전", icon: "flip_stats_ribbon" },
];

/** 세이브의 리본 문자열(16진수) → 비트 */
export function parseRibbons(hex: string | undefined): bigint {
  if (!hex) return 0n;
  try {
    return BigInt(`0x${hex}`);
  } catch {
    return 0n;
  }
}

export const hasRibbon = (ribbons: bigint, bit: number) => (ribbons & (1n << BigInt(bit))) !== 0n;

export const monoGenBit = (gen: number) => 17 + gen;

/** 클리어 여부를 따지는 기준. 엔드리스는 클리어 리본이 없어서 넣지 않는다 */
export type ClearCriterion = { mode: "classic" } | { mode: "gen"; gen: number } | { mode: "type"; type: number };

export const CLASSIC: ClearCriterion = { mode: "classic" };

export function criterionLabel(c: ClearCriterion, dex: Dex): string {
  if (c.mode === "classic") return "클래식";
  if (c.mode === "gen") return `챌린지 · 단일 ${c.gen}세대`;
  return `챌린지 · 단일 ${dex.name(c.type)}`;
}

/** 플레이어가 쓸 수 있는 형태 (스타모빌처럼 상대 전용인 별도 폼은 빼고, 진화형·폼 변화·스타팅 형태) */
const playable = (f: DexSpecies) => f.form !== 0 || f.starter || f.img === String(f.id);

/** 이 기준으로 도전할 수 있는 스타터인가 (진화·폼 변화로 얻는 세대·타입 포함, 게임의 스타터 선택 규칙과 같다) */
export function eligible(s: OwnedStarter, c: ClearCriterion): boolean {
  return c.mode === "classic" || s.family.some((f) => playable(f) && formAllowed(f, c));
}

/** 챌린지 배틀에 나갈 수 있는 형태인가 (게임: 단일 타입은 그 타입, 단일 세대는 그 세대인 형태만 싸울 수 있다) */
export function formAllowed(f: DexSpecies, c: ClearCriterion): boolean {
  if (c.mode === "classic") return true;
  if (c.mode === "gen") return f.gen === c.gen;
  return f.types.includes(c.type);
}

/** 같은 기준인가 */
export const sameCriterion = (a: ClearCriterion, b: ClearCriterion) => JSON.stringify(a) === JSON.stringify(b);

/**
 * 이 기준으로 클리어했는가.
 * 클래식은 클리어 횟수($wc)로 본다: 리본이 생기기 전에 깬 기록은 리본이 없고 횟수에만 남아 있다.
 * 챌린지는 해당 리본으로 본다.
 */
export function cleared(s: OwnedStarter, c: ClearCriterion, dex: Dex): boolean {
  if (c.mode === "classic") return s.classicWins > 0;
  if (c.mode === "gen") return hasRibbon(s.ribbons, monoGenBit(c.gen));
  const i = gameTypeIndex(dex, c.type);
  return i >= 0 && hasRibbon(s.ribbons, i);
}

export interface RibbonState {
  def: RibbonDef;
  earned: boolean;
}

/**
 * Ribbons a family can earn, with whether each is earned.
 * Mono generation / type ribbons follow the game's starter rule (eligible): some playable form in the
 * family must have that generation or type. Every other ribbon is open to all.
 * A ribbon found in the save is always listed, even if the rule above would leave it out.
 * Classic also counts as earned when the starter has classic wins from before ribbons existed.
 */
export function ribbonStates(family: DexSpecies[], dex: Dex, ribbons = 0n, classicWins = 0): RibbonState[] {
  const forms = family.filter(playable);
  const canEarn = (r: RibbonDef) =>
    r.gen != null
      ? forms.some((f) => formAllowed(f, { mode: "gen", gen: r.gen! }))
      : r.gameType != null
        ? forms.some((f) => f.types.some((t) => gameTypeIndex(dex, t) === r.gameType))
        : true;
  return RIBBONS.map((def) => ({
    def,
    earned: hasRibbon(ribbons, def.bit) || (def.key === "classic" && classicWins > 0),
  })).filter((r) => r.earned || canEarn(r.def));
}
