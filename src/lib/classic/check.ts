// 내 파티 점검: 파티 분석 결과에서 "부족한 점·보완할 점"을 사람이 읽는 문장으로 만든다
import type { Dex } from "../dex";
import { ROLES, ROLE_NAMES, type Candidate } from "./candidate";
import type { PartyAnalysis } from "./party";

const PARTY_MAX = 6;

export interface Finding {
  level: "warn" | "info" | "ok";
  text: string;
}

export function findings(a: PartyAnalysis, costLimit: number, dex: Dex): Finding[] {
  const out: Finding[] = [];
  const names = (ms: Candidate[]) => ms.map((m) => m.form.name).join(", ");

  // "선공형이나 스위퍼가 없음"은 파티 분석(issues)이 이미 알려 준다
  const unfit = a.members.filter((_, i) => a.positions[i] == null && !a.free[i]);
  if (unfit.length) {
    out.push({
      level: "warn",
      text: `역할이 겹쳐 맡을 자리가 없는 포켓몬: ${names(unfit)}. 같은 역할이 정원보다 많거나, 뚜렷한 역할이 없습니다.`,
    });
  }

  const missing = ROLES.filter((r) => !a.roleCoverage[r]).map((r) => ROLE_NAMES[r]);
  if (missing.length && a.members.length >= 4) out.push({ level: "info", text: `파티에 없는 포지션: ${missing.join(", ")}` });

  for (const x of a.issues) out.push({ level: x.severity === "high" ? "warn" : "info", text: x.text });
  if (a.dangerTypes.length)
    out.push({ level: "info", text: `조심할 공격 타입: ${a.dangerTypes.slice(0, 5).map((t) => dex.name(t)).join(", ")}` });
  if (a.offenseGaps.length)
    out.push({ level: "info", text: `자속기로 약점을 찌를 수 없는 타입: ${a.offenseGaps.map((t) => dex.name(t)).join(", ")}` });

  const noPassive = a.members.filter((m) => !m.passive.active && m.passive.fid != null);
  if (noPassive.length) out.push({ level: "info", text: `패시브 미해금: ${names(noPassive)}` });
  const noNature = a.members.filter((m, i) => {
    const pos = a.positions[i] ?? m.primaryRole;
    return !(pos ? m.builds[pos].nature : m.nature);
  });
  if (noNature.length) out.push({ level: "info", text: `역할에 맞는 성격 미해금: ${names(noNature)}` });

  if (a.members.length < PARTY_MAX) {
    out.push({
      level: "info",
      text: `빈 자리 ${PARTY_MAX - a.members.length}칸, 코스트 ${costLimit - a.cost} 남음. 아래 보완 후보에서 채울 포켓몬을 볼 수 있습니다.`,
    });
  }
  if (!out.some((f) => f.level === "warn")) out.unshift({ level: "ok", text: "큰 문제는 없습니다. 아래 세팅과 경로를 참고하세요." });
  return out;
}

