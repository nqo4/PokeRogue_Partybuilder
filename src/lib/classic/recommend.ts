// 클래식 파티 추천: 코스트 상한 안에서 빔 탐색으로 점수가 높은 조합을 찾는다.
import type { Dex, DexSpecies } from "../dex";
import type { Official } from "../official";
import type { OwnedStarter } from "../starters";
import { buildTypeMatrix, type TypeMatrix } from "../typeChart";
import { CandidateBuilder, type Candidate } from "./candidate";
import { resolveConfig, type ClassicConfig, type ResolvedConfig } from "./config";
import { CLASSIC, cleared, eligible, formAllowed, type ClearCriterion } from "../ribbons";
import { ROLE_THRESHOLD, analyzeParty, type FixedPosition, type PartyAnalysis } from "./party";

export interface RecommendOptions {
  /** 이 게임 종류(클래식·챌린지)를 아직 클리어하지 못한 포켓몬만 후보로 쓴다 */
  onlyUncleared: boolean;
  /** 파티 포켓몬 수 (1~6). 정확히 이 수만큼 채운다 */
  partySize?: number;
  /** 메가진화·거다이맥스·폼 변화가 가능한 포켓몬의 최대 수 (0~6) */
  maxFormChange?: number;
  /** 반드시 넣을 포켓몬 (SpeciesId) */
  required?: number[];
  /** 고정 포켓몬(SpeciesId)별로 고른 최종 형태 (Dex idx). 없으면 점수가 가장 높은 형태 */
  requiredForms?: Record<number, number>;
  /** 고정 포켓몬(SpeciesId)별로 정한 포지션. 없으면 점수대로 배정 */
  fixedPositions?: Record<number, FixedPosition>;
  /** 이미 보여준 파티 (partyKey). 이 파티들과 겹치지 않는 새 파티를 찾는다 */
  exclude?: string[];
  /** 돌려줄 파티 수 */
  count?: number;
  beamWidth?: number;
}

export interface Suggestion {
  candidate: Candidate;
  /** 교체 대상 (없으면 빈자리에 추가) */
  replace: Candidate | null;
  /** 이 포켓몬이 반감·무효로 받아주는 위험 타입 */
  covers: number[];
  scoreDelta: number;
  /** 고정 포켓몬을 바꾸는 후보 (다른 후보가 없을 때만 나온다) */
  replacesFixed?: boolean;
}

export interface PartyRecommendation {
  /** 파티 식별자 (멤버 SpeciesId 정렬) */
  key: string;
  analysis: PartyAnalysis;
  suggestions: Suggestion[];
}

export const hasFormChange = (c: Candidate) => c.specialForms.length > 0;
export const partyKey = (ms: Candidate[]) =>
  ms.map((m) => m.owned.speciesId).sort((a, b) => a - b).join(",");

export class ClassicRecommender {
  readonly cfg: ResolvedConfig;
  readonly chart: TypeMatrix;
  readonly candidates: Candidate[];
  private readonly byId = new Map<number, Candidate>();
  private readonly builder: CandidateBuilder;
  /** 사용자가 고른 형태로 평가한 후보 ("SpeciesId:Dex idx") */
  private readonly byForm = new Map<string, Candidate>();

  /**
   * challenge 를 주면 그 챌린지 기준으로 추천한다:
   * 도전할 수 있는 스타터만 후보로, 형태는 챌린지에 맞는 것(단일 타입이면 그 타입, 단일 세대면 그 세대)만 쓴다.
   */
  constructor(
    private readonly dex: Dex,
    starters: OwnedStarter[],
    config?: ClassicConfig,
    readonly challenge: ClearCriterion = CLASSIC,
    /** 공식 진화 데이터. 주면 리전폼 진화(히스이 블레이범 등)도 최종 형태로 쓴다 */
    official?: Official | null,
  ) {
    this.cfg = resolveConfig(dex, config);
    this.chart = buildTypeMatrix(dex);
    const builder = (this.builder = new CandidateBuilder(
      dex,
      this.cfg,
      this.chart,
      (f) => formAllowed(f, challenge),
      official ? (id) => official.evolutionLine(id) : undefined,
    ));
    // 챌린지에 맞는 형태가 하나도 없는 스타터는 뺀다
    this.candidates = starters
      .filter((s) => eligible(s, challenge))
      .map((s) => builder.build(s))
      .filter((c) => formAllowed(c.form, challenge));
    for (const c of this.candidates) this.byId.set(c.owned.speciesId, c);
  }

  /** formIdx 를 주면 그 최종 형태(메가진화 등 포함)로 평가한 후보 */
  candidate(speciesId: number, formIdx?: number): Candidate | undefined {
    const base = this.byId.get(speciesId);
    if (!base || formIdx == null || base.form.idx === formIdx) return base;
    const key = `${speciesId}:${formIdx}`;
    let c = this.byForm.get(key);
    if (!c) {
      const form = this.forms(speciesId).find((f) => f.idx === formIdx);
      if (!form) return base;
      c = this.builder.build(base.owned, form);
      this.byForm.set(key, c);
    }
    return c;
  }

  /** 고를 수 있는 최종 형태 (진화 갈래별 최종형 + 메가진화·거다이맥스·폼 변화) */
  forms(speciesId: number): DexSpecies[] {
    const base = this.byId.get(speciesId);
    return base ? this.builder.pickableForms(base.owned) : [];
  }

  analyze(members: Candidate[], fixed?: Map<Candidate, FixedPosition>): PartyAnalysis {
    return analyzeParty(members, this.dex, this.cfg, this.chart, fixed);
  }

  recommend(opts: RecommendOptions): PartyRecommendation[] {
    const { costLimit } = this.cfg.raw;
    const size = Math.max(1, Math.min(this.cfg.raw.partySize, opts.partySize ?? this.cfg.raw.partySize));
    const maxForm = opts.maxFormChange ?? size;
    const count = opts.count ?? 5;
    const beamWidth = opts.beamWidth ?? 60;
    const required = (opts.required ?? [])
      .map((id) => this.candidate(id, opts.requiredForms?.[id]))
      .filter((c): c is Candidate => !!c);
    const requiredIds = new Set(required.map((c) => c.owned.speciesId));
    const fixed = new Map<Candidate, FixedPosition>();
    for (const c of required) {
      const f = opts.fixedPositions?.[c.owned.speciesId];
      if (f) fixed.set(c, f);
    }
    const pool = this.candidates.filter(
      (c) =>
        !requiredIds.has(c.owned.speciesId) &&
        (!opts.onlyUncleared || !cleared(c.owned, this.challenge, this.dex)) &&
        c.owned.cost <= costLimit &&
        (maxForm > 0 || !hasFormChange(c)),
    );

    // 남은 자리를 가장 싼 후보로 채워도 코스트를 넘는 조합은 끝까지 채울 수 없으니 일찍 버린다
    // (비싼 포켓몬이 많은 챌린지에서 빔이 채울 수 없는 조합으로만 차는 것을 막는다)
    const cheapest = pool.map((c) => c.owned.cost).sort((a, b) => a - b);
    const minFill = (k: number) => cheapest.slice(0, Math.max(0, k)).reduce((a, b) => a + b, 0);

    type State = { members: Candidate[]; cost: number; forms: number; key: string; analysis: PartyAnalysis };
    const make = (members: Candidate[]): State => ({
      members,
      cost: members.reduce((a, m) => a + m.owned.cost, 0),
      forms: members.filter(hasFormChange).length,
      key: partyKey(members),
      analysis: this.analyze(members, fixed),
    });

    const seen = new Map<string, State>();
    let beam: State[];
    if (required.length) {
      beam = [make(required.slice(0, size))];
    } else {
      // 첫 자리는 공격 역할(선공형·스위퍼)을 맡을 수 있는 포켓몬으로 시작한다
      beam = pool
        .filter((c) => Math.max(c.roles.fast.score, c.roles.sweeper.score) >= ROLE_THRESHOLD)
        .sort((a, b) => b.value - a.value)
        .slice(0, beamWidth * 2)
        .map((c) => make([c]));
    }
    beam.forEach((s) => seen.set(s.key, s));

    for (let n = beam[0]?.members.length ?? size; n < size; n++) {
      const next = new Map<string, State>();
      for (const s of beam) {
        for (const c of pool) {
          if (s.cost + c.owned.cost > costLimit) continue;
          if (s.members.includes(c)) continue;
          if (hasFormChange(c) && s.forms >= maxForm) continue;
          const members = [...s.members, c];
          const key = partyKey(members);
          if (next.has(key)) continue;
          next.set(key, make(members));
        }
      }
      // 재검색일 때 다른 조합이 살아남도록 빔을 넓게 유지한다
      const width = beamWidth * (1 + Math.min(4, Math.floor((opts.exclude?.length ?? 0) / count)));
      beam = [...next.values()]
        .filter((st) => st.cost + minFill(size - st.members.length) <= costLimit)
        .sort((a, b) => b.analysis.score - a.analysis.score)
        .slice(0, width);
      beam.forEach((s) => seen.set(s.key, s));
    }

    // 지정한 마리 수를 채운 파티 중 점수 순으로, 이미 고른(또는 이전에 보여준) 파티와 2마리 이상 다른 것만
    const shown = (opts.exclude ?? []).map((k) => new Set(k.split(",").map(Number)));
    const ranked = [...seen.values()]
      .filter((s) => s.members.length === size)
      .sort((a, b) => b.analysis.score - a.analysis.score);
    const picked: State[] = [];
    const minDiff = size >= 3 ? 2 : 1;
    const differs = (ids: Set<number>, other: Set<number>) =>
      [...ids].filter((id) => !other.has(id)).length >= minDiff;
    for (const s of ranked) {
      if (picked.length >= count) break;
      const ids = new Set(s.members.map((m) => m.owned.speciesId));
      if (shown.some((p) => !differs(ids, p))) continue;
      if (picked.some((p) => !differs(ids, new Set(p.members.map((m) => m.owned.speciesId))))) continue;
      picked.push(s);
    }

    return picked.map((s) => ({
      key: s.key,
      // 표시 순서대로 다시 분석해서 멤버별 정보(역할·상성표)의 순서를 맞춘다
      analysis: this.analyze(sortMembers(s.members), fixed),
      suggestions: this.suggest(s.members, pool, size, maxForm, 3, new Set(required), fixed),
    }));
  }

  /**
   * 위험 타입을 받아줄 수 있는 교체 후보 (마리 수가 남으면 추가 후보도).
   * 고정 포켓몬(fixed)은 다른 후보가 하나도 없을 때만 교체 대상으로 삼고 replacesFixed 로 표시한다.
   */
  suggest(
    members: Candidate[],
    pool: Candidate[],
    size: number,
    maxForm: number,
    limit = 3,
    fixed: Set<Candidate> = new Set(),
    positions?: Map<Candidate, FixedPosition>,
  ): Suggestion[] {
    const { costLimit } = this.cfg.raw;
    const base = this.analyze(members, positions);
    const danger = base.dangerTypes.slice(0, 4);
    if (!danger.length) return [];
    const cost = base.cost;
    const forms = members.filter(hasFormChange).length;
    const out: Suggestion[] = [];
    const outFixed: Suggestion[] = [];
    for (const c of pool) {
      if (members.includes(c)) continue;
      const covers = danger.filter((t) => c.defense[t] < 1);
      if (!covers.length) continue;
      let best: Suggestion | null = null;
      let bestFixed: Suggestion | null = null;
      if (members.length < size && cost + c.owned.cost <= costLimit && (!hasFormChange(c) || forms < maxForm)) {
        const a = this.analyze([...members, c], positions);
        best = { candidate: c, replace: null, covers, scoreDelta: a.score - base.score };
      }
      for (const m of members) {
        if (cost - m.owned.cost + c.owned.cost > costLimit) continue;
        if (hasFormChange(c) && !hasFormChange(m) && forms >= maxForm) continue;
        const a = this.analyze(members.map((x) => (x === m ? c : x)), positions);
        if (!a.hasAttacker) continue;
        const d = a.score - base.score;
        if (fixed.has(m)) {
          if (!bestFixed || d > bestFixed.scoreDelta) bestFixed = { candidate: c, replace: m, covers, scoreDelta: d, replacesFixed: true };
        } else if (!best || d > best.scoreDelta) best = { candidate: c, replace: m, covers, scoreDelta: d };
      }
      if (best && best.scoreDelta > 0) out.push(best);
      if (bestFixed && bestFixed.scoreDelta > 0) outFixed.push(bestFixed);
    }
    const byDelta = (a: Suggestion, b: Suggestion) => b.scoreDelta - a.scoreDelta;
    return (out.length ? out : outFixed).sort(byDelta).slice(0, limit);
  }
}

/** 공격 역할 → 나머지 순, 같은 그룹 안에서는 점수 순 */
function sortMembers(ms: Candidate[]): Candidate[] {
  const atk = (c: Candidate) => Math.max(c.roles.fast.score, c.roles.sweeper.score) >= ROLE_THRESHOLD;
  return [...ms].sort((a, b) => Number(atk(b)) - Number(atk(a)) || b.value - a.value);
}
