// 세이브 + Dex 를 합쳐 "보유 스타터" 목록을 만든다.
import type { Dex, DexSpecies } from "./dex";
import type { RawSave } from "./save";
import {
  AbilityAttr,
  PassiveAttr,
  bestShinyTier,
  shinyTiersOf,
  popcount,
  starterCost,
  unlockedNatures,
} from "./rules";

export interface EggMoveInfo {
  fid: number;
  name: string;
  rare: boolean;
  unlocked: boolean;
}

export interface OwnedStarter {
  speciesId: number;
  dex: DexSpecies;
  name: string;
  types: string[];
  gen: number;
  baseCost: number;
  costReductions: number;
  /** 코스트 감소를 반영한 실제 코스트 */
  cost: number;
  abilities: {
    a1: { name: string; unlocked: boolean };
    a2: { name: string; unlocked: boolean } | null;
    hidden: { name: string; unlocked: boolean } | null;
  };
  passive: { name: string; unlocked: boolean; enabled: boolean };
  eggMoves: EggMoveInfo[];
  eggMovesUnlocked: number;
  /** 보유한 최고 이로치 티어 = 이 포켓몬이 줄 수 있는 럭 */
  luck: 0 | 1 | 2 | 3;
  /** 도감에 등록된 이로치 단계 (1럭 1, 2럭 2, 3럭 4) */
  shinyTiers: number;
  /** 스타터 개체치. 진화형·메가·거다이 폼도 이 값을 그대로 물려받는다 */
  ivs: number[];
  ivTotal: number;
  natures: number[];
  candy: number;
  friendship: number;
  classicWins: number;
  /** 같은 진화 계열의 모든 형태 (진화·메가·거다이 포함) */
  family: DexSpecies[];
  /** 계열 안에서 가장 높은 종족값 (완전진화·메가 기준 평가용) */
  maxBst: number;
  /** 계열 각 형태(Dex idx)의 도감 상태 */
  formStatus: Record<number, FormStatus>;
}

/** caught 잡음, seen 보기만 함, unseen 못 봄 */
export type FormStatus = "caught" | "seen" | "unseen";

/** 세이브 dexData 에서 한 형태의 상태. 폼 비트 = 1 << (7 + formIndex) */
function formStatusOf(save: RawSave, dex: Dex, f: DexSpecies): FormStatus {
  const e = save.dexData[String(f.id)];
  if (!e) return "unseen";
  const bit = 1n << BigInt(7 + dex.formIndex(f));
  if (BigInt(String(e.$ca ?? 0)) & bit) return "caught";
  if (BigInt(String(e.$sa ?? 0)) & bit) return "seen";
  return "unseen";
}

export interface SaveSummary {
  trainerId: number;
  gameVersion: string;
  savedAt: Date;
  stats: Record<string, number>;
  starters: OwnedStarter[];
  /** Dex 에서 찾지 못한 세이브 스타터 키 (데이터 버전 차이 확인용) */
  unmatched: string[];
  /** 도감의 모든 형태(Dex idx)의 상태 */
  speciesStatus: Record<number, FormStatus>;
  /** 종(SpeciesId)별로 도감에 등록된 이로치 단계 (1럭 1, 2럭 2, 3럭 4). 세이브는 폼이 아니라 종 단위로 저장한다 */
  shinyById: Record<number, number>;
}

/** 이 형태를 소유한 스타터 (기본 형태가 정확히 일치하는 스타터를 우선, 없으면 같은 계열) */
export function ownerOf(starters: OwnedStarter[], species: DexSpecies): OwnedStarter | undefined {
  return (
    starters.find((s) => s.speciesId === species.id && s.dex.family === species.family) ??
    starters.find((s) => s.dex.family === species.family)
  );
}

export function buildSummary(save: RawSave, dex: Dex): SaveSummary {
  const starters: OwnedStarter[] = [];
  const unmatched: string[] = [];

  for (const [key, entry] of Object.entries(save.starterData)) {
    const speciesId = Number(key);
    const dexEntry = save.dexData[key];
    const caught = dexEntry ? BigInt(String(dexEntry.$ca ?? 0)) : 0n;
    if (!caught) continue; // 아직 잡지 않은 스타터
    const s = dex.starter(speciesId);
    if (!s) {
      unmatched.push(key);
      continue;
    }

    const eggMoves = s.eggMoves.map((fid, i) => ({
      fid,
      name: dex.name(fid),
      rare: i === 3,
      unlocked: !!(entry.$em & (1 << i)),
    }));
    const family = dex.family(s.family);
    const ivs = dexEntry.$i?.length === 6 ? dexEntry.$i : [0, 0, 0, 0, 0, 0];

    starters.push({
      speciesId,
      dex: s,
      name: s.name,
      types: dex.typeNames(s),
      gen: s.gen,
      baseCost: s.cost,
      costReductions: entry.$vr ?? 0,
      cost: starterCost(s.cost, entry.$vr ?? 0),
      abilities: {
        a1: { name: dex.name(s.abilities.a1), unlocked: !!(entry.$a & AbilityAttr.ABILITY_1) },
        a2:
          s.abilities.a2 == null
            ? null
            : { name: dex.name(s.abilities.a2), unlocked: !!(entry.$a & AbilityAttr.ABILITY_2) },
        hidden:
          s.abilities.ha == null
            ? null
            : { name: dex.name(s.abilities.ha), unlocked: !!(entry.$a & AbilityAttr.ABILITY_HIDDEN) },
      },
      passive: {
        name: dex.name(s.abilities.passive),
        unlocked: !!(entry.$pa & PassiveAttr.UNLOCKED),
        enabled: !!(entry.$pa & PassiveAttr.ENABLED),
      },
      eggMoves,
      eggMovesUnlocked: popcount(entry.$em & 0b1111),
      luck: bestShinyTier(caught),
      shinyTiers: shinyTiersOf(caught),
      ivs,
      ivTotal: ivs.reduce((a, b) => a + b, 0),
      natures: unlockedNatures(dexEntry.$na ?? 0),
      candy: entry.$x ?? 0,
      friendship: entry.$f ?? 0,
      classicWins: entry.$wc ?? 0,
      family,
      maxBst: Math.max(...family.map((f) => f.bst)),
      formStatus: Object.fromEntries(family.map((f) => [f.idx, formStatusOf(save, dex, f)])),
    });
  }

  starters.sort((a, b) => a.speciesId - b.speciesId);
  return {
    trainerId: save.trainerId,
    gameVersion: save.gameVersion,
    savedAt: new Date(save.timestamp),
    stats: save.gameStats ?? {},
    starters,
    unmatched,
    speciesStatus: Object.fromEntries(dex.species.map((f) => [f.idx, formStatusOf(save, dex, f)])),
    shinyById: Object.fromEntries(
      Object.entries(save.dexData).map(([id, e]) => [Number(id), shinyTiersOf(BigInt(String(e.$ca ?? 0)))]),
    ),
  };
}
