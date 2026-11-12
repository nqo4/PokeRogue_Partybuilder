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
  supportMoves: Set<number>;
  supportAbilities: Set<number>;
  multiHitAbilities: Set<number>;
  excludeMultiMoves: Set<number>;
  /** 단점 특성 fid → 공격 역할 배율 */
  drawbackAbilities: Map<number, number>;
  offenseAbilities: Map<number, number>;
  synergyPairs: { abilities: [number, number]; bonus: number; label: string }[];
  abilityEffects: Map<number, AbilityEffect>;
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
    supportMoves: new Set(raw.support.moves.map(mv)),
    supportAbilities: new Set(raw.support.abilities.map(ab)),
    multiHitAbilities: new Set(raw.multi.multiHitAbilities.map(ab)),
    excludeMultiMoves: new Set(raw.multi.excludeMoves.map(mv)),
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
  };
  if (missing.length) throw new ConfigError(`설정 파일의 이름을 도감에서 찾지 못했습니다: ${missing.join(", ")}`);
  return resolved;
}
