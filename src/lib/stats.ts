// 사용자 통계: 세이브의 게임 통계(gameStats) + 도감·스타터에서 계산한 수집 현황.
import type { Dex } from "./dex";
import type { SaveSummary } from "./starters";

export interface Progress {
  have: number;
  total: number;
}

export interface UserStats {
  /** 총 플레이 시간 (초) */
  playTimeSec: number;
  /** 이로치 단계별 수집 (종 기준). 1럭은 모든 종, 2·3럭은 2·3럭이 있는 종만 센다 */
  shiny: { t1: Progress; t2: Progress; t3: Progress; complete: Progress };
  /** 스타터 포획 (종 기준) */
  starters: Progress;
  /** 세대별 스타터 포획 */
  startersByGen: { gen: number; have: number; total: number }[];
  /** 보유 스타터의 육성 현황 (보유 수 기준) */
  growth: { classicCleared: number; passive: number; allEggMoves: number; hiddenAbility: number; sixV: number };
  /** 도감 형태 (메가·폼 포함) */
  forms: { caught: number; seen: number; unseen: number; total: number };
}

const p = (have: number, total: number): Progress => ({ have, total });

export function computeStats(summary: SaveSummary, dex: Dex): UserStats {
  // 종 하나당 기본 형태 하나 (같은 SpeciesId 의 첫 행)
  const species = new Map<number, (typeof dex.species)[number]>();
  for (const s of dex.species) if (!species.has(s.id)) species.set(s.id, s);

  let t1 = 0, t2 = 0, t3 = 0, complete = 0, multi = 0;
  for (const [id, s] of species) {
    const mask = summary.shinyById[id] ?? 0;
    if (mask & 1) t1++;
    if (s.variants === 3) {
      multi++;
      if (mask & 2) t2++;
      if (mask & 4) t3++;
      if ((mask & 7) === 7) complete++;
    } else if (mask & 1) complete++;
  }

  // 스타터 종: 스타팅 화면에서 고를 수 있는 형태의 SpeciesId
  const starterIds = new Map<number, number>(); // id → 세대
  for (const s of dex.species) if (s.starter && !starterIds.has(s.id)) starterIds.set(s.id, s.gen);
  const owned = new Set(summary.starters.map((s) => s.speciesId));
  const gens = [...new Set(starterIds.values())].sort((a, b) => a - b);
  const startersByGen = gens.map((gen) => {
    const ids = [...starterIds].filter(([, g]) => g === gen).map(([id]) => id);
    return { gen, have: ids.filter((id) => owned.has(id)).length, total: ids.length };
  });

  const st = summary.starters;
  const status = Object.values(summary.speciesStatus);
  return {
    playTimeSec: summary.stats.playTime ?? 0,
    shiny: { t1: p(t1, species.size), t2: p(t2, multi), t3: p(t3, multi), complete: p(complete, species.size) },
    starters: p([...owned].filter((id) => starterIds.has(id)).length, starterIds.size),
    startersByGen,
    growth: {
      classicCleared: st.filter((s) => s.classicWins > 0).length,
      passive: st.filter((s) => s.passive.unlocked).length,
      allEggMoves: st.filter((s) => s.eggMovesUnlocked === 4).length,
      hiddenAbility: st.filter((s) => s.abilities.hidden?.unlocked).length,
      sixV: st.filter((s) => s.ivTotal === 186).length,
    },
    forms: {
      caught: status.filter((x) => x === "caught").length,
      seen: status.filter((x) => x === "seen").length,
      unseen: status.filter((x) => x === "unseen").length,
      total: status.length,
    },
  };
}

/** 초 → "376시간 2분" */
export function formatPlayTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h ? `${h.toLocaleString()}시간 ${m}분` : `${m}분`;
}
