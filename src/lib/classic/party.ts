// 파티 단위 분석: 역할 구성, 공통 약점, 4배 약점 보완, 자속 공격 범위.
import type { Dex } from "../dex";
import type { TypeMatrix } from "../typeChart";
import { typeMultiplier } from "../typeChart";
import { ROLES, type Candidate, type Role } from "./candidate";
import type { ResolvedConfig } from "./config";

/** 역할을 "맡았다"고 보는 최소 점수 */
export const ROLE_THRESHOLD = 0.5;

export interface TypeRow {
  type: number;
  /** 멤버별 받는 배율 (멤버 순서) */
  multipliers: number[];
  weak: number;
  resist: number;
  immune: number;
}

export interface PartyIssue {
  severity: "high" | "mid";
  text: string;
}

export interface PartyAnalysis {
  members: Candidate[];
  cost: number;
  luck: number;
  score: number;
  /** 멤버별 맡은 역할 */
  memberRoles: Role[][];
  roleCoverage: Record<Role, number>;
  hasAttacker: boolean;
  typeTable: TypeRow[];
  /** 파티가 조심해야 할 공격 타입 (위험한 순) */
  dangerTypes: number[];
  issues: PartyIssue[];
  /** 자속기로 효과가 굉장한 방어 타입 */
  offenseCoverage: number[];
  /** 자속기로 효과가 굉장한 타입을 찍지 못하는 방어 타입 */
  offenseGaps: number[];
}

export function memberRolesOf(c: Candidate): Role[] {
  return ROLES.filter((r) => c.roles[r].score >= ROLE_THRESHOLD);
}

export function analyzeParty(
  members: Candidate[],
  dex: Dex,
  cfg: ResolvedConfig,
  chart: TypeMatrix,
): PartyAnalysis {
  const w = cfg.raw.weights;
  const nTypes = dex.data.ranges.type[1];
  const memberRoles = members.map(memberRolesOf);
  const roleCoverage = Object.fromEntries(
    ROLES.map((r) => [r, memberRoles.filter((rs) => rs.includes(r)).length]),
  ) as Record<Role, number>;
  const hasAttacker = roleCoverage.fast + roleCoverage.sweeper > 0;

  let score = 0;
  for (const m of members) score += m.value + w.member;
  if (!hasAttacker) score -= w.noAttackerPenalty;
  if (roleCoverage.tank) score += w.tankInParty;
  if (roleCoverage.support) score += w.supportInParty;
  if (roleCoverage.multi) score += w.multiInParty;

  // ── 방어 상성
  const issues: PartyIssue[] = [];
  const typeTable: TypeRow[] = [];
  const danger: [number, number][] = [];
  for (let t = 0; t < nTypes; t++) {
    const multipliers = members.map((m) => m.defense[t]);
    const weak = multipliers.filter((x) => x > 1).length;
    const resist = multipliers.filter((x) => x < 1).length;
    const immune = multipliers.filter((x) => x === 0).length;
    typeTable.push({ type: t, multipliers, weak, resist, immune });

    const net = weak - resist;
    if (weak >= 2 && net >= 1) {
      score -= w.sharedWeakness * net;
      danger.push([t, net * 2 + weak]);
    } else if (weak >= 1 && resist === 0) {
      score -= w.uncoveredWeakness * 0.25 * weak;
      danger.push([t, weak]);
    }
    for (let i = 0; i < members.length; i++) {
      if (multipliers[i] >= 4) {
        const covered = multipliers.some((x, j) => j !== i && x < 1);
        if (!covered) {
          score -= w.uncoveredQuadWeakness;
          issues.push({
            severity: "high",
            text: `${members[i].form.name}: ${dex.name(t)} 4배 약점인데 ${dex.name(t)} 기술을 받아줄 포켓몬이 없음`,
          });
        }
      }
    }
    if (weak >= 3 && resist === 0) {
      issues.push({ severity: "high", text: `${dex.name(t)} 약점이 ${weak}마리, 반감·무효 없음` });
    } else if (weak >= 2 && net >= 1) {
      issues.push({ severity: "mid", text: `${dex.name(t)} 약점 ${weak}마리 / 반감·무효 ${resist}마리` });
    }
  }
  danger.sort((a, b) => b[1] - a[1]);

  // ── 공격 범위 (자속 타입 기준)
  const stab = new Set(members.flatMap((m) => m.types));
  const offenseCoverage: number[] = [];
  const offenseGaps: number[] = [];
  for (let d = 0; d < nTypes; d++) {
    if ([...stab].some((a) => typeMultiplier(chart, a, [d]) > 1)) offenseCoverage.push(d);
    else offenseGaps.push(d);
  }
  score += offenseCoverage.length * w.coveragePerType;

  if (!hasAttacker) issues.unshift({ severity: "high", text: "선공형이나 스위퍼가 없음 (최소 1마리 필요)" });

  return {
    members,
    cost: members.reduce((a, m) => a + m.owned.cost, 0),
    luck: members.reduce((a, m) => a + m.owned.luck, 0),
    score,
    memberRoles,
    roleCoverage,
    hasAttacker,
    typeTable,
    dangerTypes: danger.map(([t]) => t),
    issues,
    offenseCoverage,
    offenseGaps,
  };
}
