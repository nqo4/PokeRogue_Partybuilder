// 설정 파일(JSON)을 fid 기반으로 풀어 둔다. 이름이 Dex 에 없으면 바로 오류를 낸다.
import classicJson from "../../config/classic.json";
import abilityEffectsJson from "../../config/abilityEffects.json";
import type { Dex } from "../dex";

export type ClassicConfig = typeof classicJson;

export interface AbilityEffect {
  /** 공격 타입 fid → 받는 배율 */
  multiplier: Map<number, number>;
  superEffective?: number;
  onlySuperEffective?: boolean;
  notes: string[];
}

export interface ResolvedConfig {
  raw: ClassicConfig;
  excludePriority: Set<number>;
  recoveryMoves: Set<number>;
  /** 물리막이·특수막이로 보는 특성 */
  physTankAbilities: Set<number>;
  specTankAbilities: Set<number>;
  /** 회복기처럼 보는 특성 (재생력·포이즌힐 등) */
  healAbilities: Set<number>;
  supportMoves: Set<number>;
  supportAbilities: Set<number>;
  multiHitAbilities: Set<number>;
  excludeMultiMoves: Set<number>;
  /** 기술 4개 추천에서 뺄 기술 */
  movesetExclude: Set<number>;
  /** 반동기 감점을 하지 않는 특성 */
  recoilImmuneAbilities: Set<number>;
  /** 단점 특성 fid → 공격 역할 배율 */
  drawbackAbilities: Map<number, number>;
  offenseAbilities: Map<number, number>;
  synergyPairs: { abilities: [number, number]; bonus: number; label: string }[];
  abilityEffects: Map<number, AbilityEffect>;
  /** Pokemon always treated as physical/special hybrid regardless of stats (evaluated form names) */
  hybridSpecies: Set<string>;
}

export class ConfigError extends Error {}

export function resolveConfig(dex: Dex, raw: ClassicConfig = classicJson): ResolvedConfig {
  const missing: string[] = [];
  const ab = (n: string) => {
    const f = dex.fid("ability", n);
    if (f < 0) missing.push(`특성 "${n}"`);
    return f;
  };
  const mv = (n: string) => {
    const f = dex.fid("move", n);
    if (f < 0) missing.push(`기술 "${n}"`);
    return f;
  };
  const ty = (n: string) => {
    const f = dex.fid("type", n);
    if (f < 0) missing.push(`타입 "${n}"`);
    return f;
  };

  const abilityEffects = new Map<number, AbilityEffect>();
  for (const [name, e] of Object.entries(abilityEffectsJson.abilities) as [
    string,
    { multiplier?: Record<string, number>; superEffective?: number; onlySuperEffective?: boolean; notes?: string[] },
  ][]) {
    abilityEffects.set(ab(name), {
      multiplier: new Map(Object.entries(e.multiplier ?? {}).map(([t, m]) => [ty(t), m])),
      superEffective: e.superEffective,
      onlySuperEffective: e.onlySuperEffective,
      notes: e.notes ?? [],
    });
  }

  const offenseAbilities = new Map<number, number>();
  for (const [name, v] of Object.entries(raw.offenseAbilities)) {
    if (name.startsWith("_")) continue;
    offenseAbilities.set(ab(name), v as number);
  }

  const resolved: ResolvedConfig = {
    raw,
    excludePriority: new Set(raw.fast.excludePriorityMoves.map(mv)),
    recoveryMoves: new Set(raw.tank.recoveryMoves.map(mv)),
    physTankAbilities: new Set(raw.tank.physAbilities.map(ab)),
    specTankAbilities: new Set(raw.tank.specAbilities.map(ab)),
    healAbilities: new Set(raw.tank.healAbilities.map(ab)),
    supportMoves: new Set(raw.support.moves.map(mv)),
    supportAbilities: new Set(raw.support.abilities.map(ab)),
    multiHitAbilities: new Set(raw.multi.multiHitAbilities.map(ab)),
    excludeMultiMoves: new Set(raw.multi.excludeMoves.map(mv)),
    movesetExclude: new Set(raw.moveset.excludeMoves.map(mv)),
    recoilImmuneAbilities: new Set(raw.moveset.recoilImmuneAbilities.map(ab)),
    drawbackAbilities: new Map(
      Object.entries(raw.drawbackAbilities)
        .filter(([k]) => !k.startsWith("_"))
        .map(([k, v]) => [ab(k), v as number]),
    ),
    offenseAbilities,
    synergyPairs: raw.synergyPairs.pairs.map((p) => ({
      abilities: [ab(p.abilities[0]), ab(p.abilities[1])] as [number, number],
      bonus: p.bonus,
      label: p.label,
    })),
    abilityEffects,
    hybridSpecies: new Set(raw.hybrid.species),
  };
  for (const n of raw.hybrid.species) if (!dex.species.some((s) => s.name === n)) missing.push(`포켓몬 "${n}"`);
  if (missing.length) throw new ConfigError(`설정 파일의 이름을 도감에서 찾지 못했습니다: ${missing.join(", ")}`);
  return resolved;
}
