// 지도(맵) 아이템이 있을 때 고를 바이옴 경로 추천.
// 바이옴 점수 = 아직 못 잡은 포켓몬을 만날 확률(가중) − 그 바이옴 관장 타입에 대한 파티의 위험도.
import type { Dex } from "./dex";
import type { PartyAnalysis } from "./classic/party";
import { TYPE_KEY_KO, WILD_TIER_CHANCE, type Biome, type Official, type Trainer } from "./official";
import type { FormStatus } from "./starters";

export interface BiomeEval {
  biome: Biome;
  /** 야생 조우 한 번에 아직 못 잡은 포켓몬이 나올 확률 (0~1) */
  newChance: number;
  /** 관장별 위험도: 파티의 해당 타입 약점 수 − 반감 수 (자속기로 찌를 수 있으면 −1) */
  gyms: { trainer: Trainer; typeFid: number; risk: number }[];
  score: number;
}

export interface RouteStep {
  eval: BiomeEval;
  /** 이 바이옴으로 가는 연결이 확률적인가 (1/n 확률로만 선택지에 뜸) */
  chance: number;
}

const CATCH_WEIGHT = 10;
const GYM_WEIGHT = 2;

export function evaluateBiome(
  biome: Biome,
  dex: Dex,
  official: Official,
  status: Record<number, FormStatus> | undefined,
  party: PartyAnalysis | null,
): BiomeEval {
  let newChance = 0;
  if (status) {
    for (const pool of biome.pokemon) {
      const p = WILD_TIER_CHANCE[pool.tier];
      if (!p) continue;
      const ids = [...new Set(pool.species.map((s) => s.id))];
      if (!ids.length) continue;
      const fresh = ids.filter((id) => {
        const s = dex.byId(id);
        return s && status[s.idx] !== "caught";
      }).length;
      newChance += p * (fresh / ids.length);
    }
  }
  const gyms = (biome.trainers.find((t) => t.tier === "BOSS")?.trainers ?? [])
    .map((t) => official.trainerByType.get(t.type))
    .filter((t): t is Trainer => !!t)
    .map((trainer) => {
      const typeFid = dex.fid("type", TYPE_KEY_KO[trainer.specialty ?? ""] ?? "");
      let risk = 0;
      if (party && typeFid >= 0) {
        const row = party.typeTable[typeFid];
        risk = row.weak - row.resist;
        if (party.offenseCoverage.includes(typeFid)) risk -= 1;
      }
      return { trainer, typeFid, risk };
    });
  const gymRisk = gyms.length ? gyms.reduce((a, g) => a + Math.max(0, g.risk), 0) / gyms.length : 0;
  return { biome, newChance, gyms, score: CATCH_WEIGHT * newChance - GYM_WEIGHT * gymRisk };
}

/** start 에서 steps 번 이동하는 경로 중 점수 합이 가장 큰 것 (같은 바이옴 재방문 허용) */
export function bestRoute(
  start: number,
  steps: number,
  dex: Dex,
  official: Official,
  status: Record<number, FormStatus> | undefined,
  party: PartyAnalysis | null,
): RouteStep[] {
  const evals = new Map<number, BiomeEval>();
  const ev = (id: number) => {
    let e = evals.get(id);
    if (!e) {
      e = evaluateBiome(official.biomeById.get(id)!, dex, official, status, party);
      evals.set(id, e);
    }
    return e;
  };
  // best[k][b] = b 에서 k 번 더 이동할 때 얻는 최대 점수
  const ids = official.data.biomes.map((b) => b.id);
  let best = new Map<number, { score: number; next: number | null; chance: number }>(ids.map((id) => [id, { score: 0, next: null, chance: 1 }]));
  const tables = [best];
  for (let k = 1; k <= steps; k++) {
    const cur = new Map<number, { score: number; next: number | null; chance: number }>();
    for (const id of ids) {
      const b = official.biomeById.get(id)!;
      let top = { score: -Infinity, next: null as number | null, chance: 1 };
      for (const l of b.links) {
        if (!official.biomeById.has(l.to)) continue;
        // 확률적 연결은 기대값으로 조금 깎는다
        const s = ev(l.to).score * (l.chance < 1 ? 0.7 : 1) + best.get(l.to)!.score;
        if (s > top.score) top = { score: s, next: l.to, chance: l.chance };
      }
      cur.set(id, top.next == null ? { score: 0, next: null, chance: 1 } : top);
    }
    best = cur;
    tables.push(best);
  }
  const route: RouteStep[] = [];
  let at = start;
  for (let k = steps; k >= 1; k--) {
    const step = tables[k].get(at);
    if (!step || step.next == null) break;
    route.push({ eval: ev(step.next), chance: step.chance });
    at = step.next;
  }
  return route;
}
