// 보유 스타터 하나를 "클래식에서 어떻게 쓸 수 있는가"로 평가한다.
// 진화 후 형태(최종형)를 기준으로 타입·특성·기술·종족값을 보고, 역할 점수와 이유를 만든다.
import { TAG, type Dex, type DexSpecies, type MoveInfo } from "../dex";
import { NATURE_EFFECT, NATURE_NAMES } from "../rules";
import type { OwnedStarter } from "../starters";
import type { TypeMatrix } from "../typeChart";
import { typeMultiplier } from "../typeChart";
import type { ResolvedConfig } from "./config";

export type Role =
  | "fastPhys"
  | "fastSpec"
  | "sweeperPhys"
  | "sweeperSpec"
  | "spread"
  | "boss"
  | "physTank"
  | "specTank"
  | "support";
export const ROLES: Role[] = [
  "fastPhys",
  "fastSpec",
  "sweeperPhys",
  "sweeperSpec",
  "spread",
  "boss",
  "physTank",
  "specTank",
  "support",
];
export const ROLE_NAMES: Record<Role, string> = {
  fastPhys: "물리 선공형",
  fastSpec: "특수 선공형",
  sweeperPhys: "물리 스위퍼",
  sweeperSpec: "특수 스위퍼",
  spread: "광역기",
  boss: "보스 대응",
  physTank: "물리막이",
  specTank: "특수막이",
  support: "서포터",
};
/** 공격 역할 (파티에 최소 1마리 필요) */
export const ATTACK_ROLES: Role[] = ["fastPhys", "fastSpec", "sweeperPhys", "sweeperSpec"];
/** 역할이 쓰는 공격 능력치 (물리 atk, 특수 spa). 공격 분류와 상관없는 역할은 null */
export const roleStat = (r: Role | null): "atk" | "spa" | null =>
  r === "fastPhys" || r === "sweeperPhys" ? "atk" : r === "fastSpec" || r === "sweeperSpec" ? "spa" : null;
const isFast = (r: Role | null) => r === "fastPhys" || r === "fastSpec";
/** 공격 역할 점수 중 가장 높은 것 */
export const attackScore = (c: { roles: Record<Role, RoleResult> }) =>
  Math.max(...ATTACK_ROLES.map((r) => c.roles[r].score));

export interface RoleResult {
  /** 0~1 */
  score: number;
  reasons: Reason[];
}

/** 판정 이유. refs 는 클릭하면 설명을 볼 수 있는 특성·기술 fid */
export interface Reason {
  text: string;
  refs?: number[];
}

export function reasonText(r: Reason, name: (fid: number) => string): string {
  return [r.text, r.refs?.map(name).join("·")].filter(Boolean).join(" ");
}

export interface AbilityPick {
  fid: number;
  name: string;
  slot: "특성1" | "특성2" | "숨겨진 특성";
}

/** 추천 기술 한 칸: 기술 fid 와 고른 이유 */
export interface MovePick {
  fid: number;
  why: string;
}

/** 특성 선택 기준: 기본은 화력, 막이·서포터가 주 역할이면 그 역할에 맞는 특성을 다시 고른다 */
type AbilityFocus = "offense" | "physTank" | "specTank" | "support";
const isTank = (r: Role | AbilityFocus | null): r is "physTank" | "specTank" => r === "physTank" || r === "specTank";

type MoveEntry = readonly [number, MoveInfo];

export interface Candidate {
  owned: OwnedStarter;
  /** 평가 기준이 된 진화 후 형태 */
  form: DexSpecies;
  /** 평가 형태의 타입 fid */
  types: number[];
  /** 메가진화·거다이맥스·폼 변화 형태 (평가 형태와 같은 종) */
  specialForms: DexSpecies[];
  /** 물리·특수 겸용: 물리·특수 기술을 모두 역할·기술 평가에 넣는다 (아니면 주 공격 분류 기술만) */
  hybrid: boolean;
  ability: AbilityPick;
  /** 특성을 고른 이유 */
  abilityWhy: string;
  passive: { fid: number | null; name: string; active: boolean };
  /** 실제로 켜지는 특성 (선택 특성 + 해금된 패시브) */
  activeAbilities: number[];
  /** 레벨업·진화·기억버섯·해금 알기술로 쓸 수 있는 기술 */
  moves: Set<number>;
  offenseStat: "atk" | "spa";
  roles: Record<Role, RoleResult>;
  /** 공격 타입 fid → 받는 배율 (특성 반영) */
  defense: number[];
  /** 방어 계산에 반영되지 않는 특성 효과 메모 */
  defenseNotes: string[];
  /** 공격 타입별로 특성 때문에 배율이 바뀐 이유 (바뀌지 않았으면 빈 문자열) */
  defenseWhy: string[];
  nature: { index: number; name: string; why: string } | null;
  /** 가장 점수가 높은 역할 (없으면 null). 기술·성격·특성 추천의 기준 */
  primaryRole: Role | null;
  /** 주 역할에 맞춘 추천 기술 (최대 4개) */
  moveset: MovePick[];
  /** 역할별 추천 기술·성격. 파티에서 다른 포지션을 맡으면 그 포지션 것을 쓴다 */
  builds: Record<Role, { moveset: MovePick[]; nature: Candidate["nature"] }>;
  /** 개별 평가 점수 */
  value: number;
  /** 해금 상태·성격 등 품질 관련 설명 */
  notes: string[];
  /** 시작 형태와 평가 형태의 타입이 다를 때 설명 */
  typeChange: string | null;
}

const STAT_INDEX = { hp: 0, atk: 1, def: 2, spa: 3, spd: 4, spe: 5 } as const;
/** 효과 번호: 사용자 공격·특공·스피드, 전 능력치 */
const SELF_ATK = 0;
const SELF_DEF = 1;
const SELF_SPA = 2;
const SELF_SPD = 3;
const SELF_SPE = 4;
const SELF_ALL = 22;
/** 효과 번호 0~6 은 사용자 능력치 (공격·방어·특공·특방·스피드·명중·회피) */
const SELF_STAT_MAX = 6;
/** 반동 태그 범위 (반동 HP 50% ~ 반동 피해의 25%) */
const RECOIL_TAGS = [10, 13] as const;
const OHKO_TAG = 68;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export interface HybridRule {
  minOffense: number;
  closeRatio: number;
  highMin: number;
  highRatio: number;
}

/**
 * Whether attack and sp. attack are close enough to use either category (stats: [HP, Atk, Def, SpA, SpD, Spe]).
 * Low-offense Pokemon (higher stat below minOffense) are never hybrid.
 */
export function isHybridStats(stats: readonly number[], rule: HybridRule): boolean {
  const lo = Math.min(stats[1], stats[3]);
  const hi = Math.max(stats[1], stats[3]);
  if (hi < rule.minOffense) return false;
  return lo >= hi * rule.closeRatio || (lo >= rule.highMin && lo >= hi * rule.highRatio);
}

/** Result of the physical / special decision for one form */
export interface OffenseKind {
  /** Main attacking stat */
  offenseStat: "atk" | "spa";
  /** Either category is a real option (the player picks one with the nature): evaluate both */
  hybrid: boolean;
  /** Why the main category is not simply the higher stat */
  note: string | null;
}

/**
 * Strength of the best attacking set in one category: the strongest STAB move (counted twice) plus the two
 * strongest moves of other types, each power × accuracy (×1.5 STAB, ×0.9 recoil), times the attacking stat,
 * ×1.15 with a sure setup move for that stat (Swords Dance, Nasty Plot, Dragon Dance, Shell Smash...).
 * `pool` is every move the form can learn (level-up, evolution, relearn, egg moves, TMs).
 */
export function attackSetStrength(
  form: DexSpecies,
  cat: 0 | 1,
  pool: readonly MoveEntry[],
  exclude: Set<number>,
): number {
  const best = new Map<number, number>();
  for (const [fid, m] of pool) {
    if (m.cat !== cat || m.power <= 0 || exclude.has(fid) || m.tags.includes(OHKO_TAG)) continue;
    const recoil = m.tags.some((t) => t >= RECOIL_TAGS[0] && t <= RECOIL_TAGS[1]);
    const v = m.power * (m.acc > 0 ? m.acc / 100 : 1) * (form.types.includes(m.type) ? 1.5 : 1) * (recoil ? 0.9 : 1);
    if (v > (best.get(m.type) ?? 0)) best.set(m.type, v);
  }
  const stab = Math.max(0, ...form.types.map((t) => best.get(t) ?? 0));
  const rest = [...best.values()].sort((a, b) => b - a);
  if (stab > 0) rest.splice(rest.indexOf(stab), 1);
  const sure = (c: number) => c === -1 || c >= 100;
  const off = cat === 0 ? SELF_ATK : SELF_SPA;
  const setup = pool.some(
    ([, m]) =>
      m.cat === 2 &&
      (m.procs.some(([c, e, s]) => sure(c) && s > 0 && ((e === off && s >= 2) || e === SELF_ALL)) ||
        m.procs.filter(([c, e, s]) => sure(c) && s > 0 && (e === off || e === SELF_SPE)).length >= 2),
  );
  const stat = cat === 0 ? form.stats[1] : form.stats[3];
  return stat * (stab * 2 + (rest[0] ?? 0) + (rest[1] ?? 0)) * (setup ? 1.15 : 1);
}

/**
 * Physical / special split, shared by the recommender and the species detail. In PokeRogue the nature is
 * picked before the run, so a Pokemon is played as one or the other; "hybrid" means either is a real option.
 *   - Config exception list (hybrid.species, e.g. Dragonite: physical or special sets) → hybrid.
 *   - A mega / form change whose own main category differs (e.g. Garchomp → Mega Z) → hybrid.
 *   - Attack ≠ sp. attack → the higher one, unless the other category's best set is flipRatio times stronger
 *     (Blastoise 83/85 stays special even with Wave Crash).
 *   - Attack = sp. attack → the category with the stronger best set (Mew, Jirachi → special).
 */
export function offenseKind(
  form: DexSpecies,
  specialForms: DexSpecies[],
  pool: readonly MoveEntry[],
  cfg: Pick<ResolvedConfig, "hybridSpecies" | "movesetExclude"> & { raw: { hybrid: HybridRule & { flipRatio: number } } },
): OffenseKind {
  const rule = cfg.raw.hybrid;
  const name = (k: "atk" | "spa") => (k === "atk" ? "물리" : "특수");
  /** Main category of one form by its stats and best attacking sets */
  const decide = (f: DexSpecies): { stat: "atk" | "spa"; note: string | null } => {
    const [, atk, , spa] = f.stats;
    const phys = attackSetStrength(f, 0, pool, cfg.movesetExclude);
    const spec = attackSetStrength(f, 1, pool, cfg.movesetExclude);
    if (atk === spa) {
      const stat = phys >= spec ? "atk" : "spa";
      return { stat, note: `공격·특공이 같아 기술 구성이 더 강한 ${name(stat)}형으로 평가` };
    }
    const high: "atk" | "spa" = atk > spa ? "atk" : "spa";
    const [mine, other] = high === "atk" ? [phys, spec] : [spec, phys];
    if (other < mine * rule.flipRatio) return { stat: high, note: null };
    const stat = high === "atk" ? "spa" : "atk";
    return { stat, note: `${name(high)} 능력치가 높지만 ${name(stat)} 기술 구성이 ${rule.flipRatio}배 이상 강해 ${name(stat)}형으로 평가` };
  };
  const own = decide(form);
  // A mega / form change played the other way (Garchomp → Mega Z) makes both categories real options.
  // Only forms with real offense (higher stat >= minOffense) count, so 60/60 → Mega 60/80 does not.
  const byForm =
    specialForms.filter((f) => Math.max(f.stats[1], f.stats[3]) >= rule.minOffense).some((f) => decide(f).stat !== own.stat) &&
    Math.max(form.stats[1], form.stats[3]) >= rule.minOffense;
  return { offenseStat: own.stat, hybrid: cfg.hybridSpecies.has(form.name) || byForm, note: own.note };
}

/** TMs a form can learn (learn codes 201-203, 205-207 and 209-211 carry a TM tier) */
function tmMovesOf(form: DexSpecies, dex: Dex): MoveEntry[] {
  return Object.entries(form.moves)
    .filter(([, c]) => (c >= 201 && c <= 203) || (c >= 205 && c <= 207) || (c >= 209 && c <= 211))
    .map(([k]) => [Number(k), dex.move(Number(k))] as const)
    .filter((x): x is readonly [number, MoveInfo] => !!x[1] && !x[1].tags.includes(TAG.NOT_IMPLEMENTED));
}

/**
 * Every move a form can learn: level-up, evolution and relearn of the form and its earlier stages, all four
 * egg moves of the line and its TMs. Used to judge physical / special (not the start moveset).
 */
export function learnablePool(form: DexSpecies, family: DexSpecies[], dex: Dex): MoveEntry[] {
  const base = family.find((f) => f.id === form.id && f.form === 0) ?? form;
  const lineage = family.filter((f) => f.form === 0 && (f === base || f.starter || (!f.starter && !f.final)));
  const fids = new Set<number>();
  for (const f of [form, ...lineage]) for (const [k, code] of Object.entries(f.moves)) if (code <= 200) fids.add(Number(k));
  for (const fid of form.eggMoves) fids.add(fid);
  for (const [fid] of tmMovesOf(form, dex)) fids.add(fid);
  return [...fids]
    .map((fid) => [fid, dex.move(fid)] as const)
    .filter((x): x is readonly [number, MoveInfo] => !!x[1] && !x[1].tags.includes(TAG.NOT_IMPLEMENTED));
}

/** offenseKind for one form in the species detail: only the form's own stats (megas have their own detail) */
export function speciesOffenseKind(
  form: DexSpecies,
  family: DexSpecies[],
  dex: Dex,
  cfg: Parameters<typeof offenseKind>[3],
): OffenseKind {
  return offenseKind(form, [], learnablePool(form, family, dex), cfg);
}

export class CandidateBuilder {
  constructor(
    private readonly dex: Dex,
    private readonly cfg: ResolvedConfig,
    private readonly chart: TypeMatrix,
    /** 챌린지에서 쓸 수 있는 형태인가 (단일 타입·세대 챌린지는 그 타입·세대인 형태로만 싸울 수 있다) */
    private readonly allow: (f: DexSpecies) => boolean = () => true,
    /** 스타터에서 진화해 닿는 종 (공식 진화 데이터, 리전폼 진화 포함). 없으면 같은 계열에서 추정한다 */
    private readonly evolutionLine?: (id: number) => number[],
  ) {}

  /** 진화 갈래가 여러 개면(이브이 등) 가장 점수가 높은 갈래를 고른다. only 를 주면 그 형태로만 평가한다 */
  build(owned: OwnedStarter, only?: DexSpecies): Candidate {
    let best: Candidate | null = null;
    for (const form of only ? [only] : this.targetForms(owned)) {
      let c = this.evaluate(owned, form, "offense");
      // 막이·서포터가 주 역할이면 그 역할에 맞는 특성으로 다시 평가해 본다
      if (isTank(c.primaryRole) || c.primaryRole === "support") {
        const again = this.evaluate(owned, form, c.primaryRole);
        if (again.ability.fid !== c.ability.fid && again.primaryRole === c.primaryRole) c = again;
      }
      if (!best || c.value > best.value) best = c;
    }
    return best!;
  }

  /** 사용자가 고를 수 있는 최종 형태: 진화 갈래별 최종형과 그 메가진화·거다이맥스·폼 변화 */
  pickableForms(owned: OwnedStarter): DexSpecies[] {
    // 지가르데처럼 최종형 여러 개가 같은 폼 변화를 공유하면 한 번만 넣는다
    return [
      ...new Set(
        this.targetForms(owned).flatMap((f) => [
          f,
          ...owned.family.filter((s) => s.id === f.id && s.form >= 1 && s.form <= 4 && this.allow(s)),
        ]),
      ),
    ];
  }

  private targetForms(owned: OwnedStarter): DexSpecies[] {
    const regional = owned.speciesId >= 2000;
    const line = this.evolutionLine ? new Set(this.evolutionLine(owned.speciesId)) : null;
    // 기본 이미지 키(= SpeciesId)인 형태만 진화 결과로 본다. 스타모빌 같은 별도 폼은 제외.
    // 진화 데이터가 있으면 실제로 진화해 닿는 종만 (브케인 → 히스이 블레이범 같은 리전폼 진화 포함)
    const evo = (f: DexSpecies) =>
      f.form === 0 && f.img === String(f.id) && (line ? line.has(f.id) : regional || f.id < 2000);
    const finals = owned.family.filter((f) => f.final && evo(f) && this.allow(f));
    if (finals.length) return finals;
    // 챌린지에 맞는 최종형이 없으면 맞는 진화 단계 중 종족값이 가장 높은 것
    const byBst = (a: DexSpecies, b: DexSpecies) => b.bst - a.bst;
    const stages = owned.family.filter((f) => evo(f) && this.allow(f)).sort(byBst);
    if (stages.length) return [stages[0]];
    // 폼 변화로만 챌린지에 맞는 경우 (원시회귀 그란돈, 태양의 모습 캐스퐁 등)이나 잡아 둔 다른 스타팅 형태.
    // 스타모빌처럼 플레이어가 쓸 수 없는 별도 폼은 넣지 않는다
    const usable = (f: DexSpecies) =>
      (f.form >= 1 && f.form <= 4) || (f.starter && owned.formStatus[f.idx] === "caught");
    const forms = owned.family.filter((f) => this.allow(f) && usable(f)).sort(byBst);
    return forms.length ? [forms[0]] : [owned.dex];
  }

  private evaluate(owned: OwnedStarter, form: DexSpecies, focus: AbilityFocus): Candidate {
    const { dex, cfg } = this;
    const raw = cfg.raw;
    const [, atk, , spa, , spe] = form.stats;
    const types = form.types;

    // ── 기술: 레벨업(진화 전 형태 포함)·진화·기억버섯 + 해금 알기술
    const moves = new Set<number>();
    // 메가진화 등 폼 변화 형태로 평가할 때는 그 기본 형태의 기술도 쓴다
    const lineage = owned.family.filter(
      (f) =>
        f.form === 0 &&
        (f === owned.dex || f === form || (f.id === form.id && f.img === String(f.id)) || (!f.starter && !f.final)),
    );
    for (const f of lineage) {
      for (const [k, code] of Object.entries(f.moves)) if (code <= 200) moves.add(Number(k));
    }
    owned.eggMoves.forEach((m) => m.unlocked && moves.add(m.fid));
    const moveList = [...moves]
      .map((fid) => [fid, dex.move(fid)] as const)
      .filter((x): x is readonly [number, MoveInfo] => !!x[1] && !x[1].tags.includes(TAG.NOT_IMPLEMENTED));

    // ── Physical / special split (see offenseKind)
    const specialForms = owned.family.filter((f) => f.id === form.id && f.form >= 1 && f.form <= 4 && this.allow(f));
    const { offenseStat, hybrid, note: hybridNote } = offenseKind(form, specialForms, learnablePool(form, owned.family, dex), cfg);
    const mainCat = offenseStat === "atk" ? 0 : 1;
    /** 역할·기술 평가에 쓰는 기술: 변화기 + 쓸 분류의 공격기 */
    const usableList = moveList.filter(([, m]) => m.cat === 2 || hybrid || m.cat === mainCat);

    // ── 특성: 해금된 칸 중 가장 쓸모 있는 것 + 패시브
    const passiveFid = form.abilities.passive ?? owned.dex.abilities.passive;
    const passiveActive = owned.passive.unlocked && passiveFid != null;
    const slots: [AbilityPick["slot"], number | null, boolean][] = [
      ["특성1", form.abilities.a1, owned.abilities.a1.unlocked],
      ["특성2", form.abilities.a2, !!owned.abilities.a2?.unlocked],
      ["숨겨진 특성", form.abilities.ha, !!owned.abilities.hidden?.unlocked],
    ];
    let ability: AbilityPick | null = null;
    let abilityScore = -Infinity;
    for (const [slot, fid, unlocked] of slots) {
      if (fid == null || !unlocked) continue;
      const s = this.abilityValue(fid, passiveActive ? passiveFid : null, focus);
      if (s > abilityScore) {
        abilityScore = s;
        ability = { fid, name: dex.name(fid), slot };
      }
    }
    if (!ability) ability = { fid: form.abilities.a1, name: dex.name(form.abilities.a1), slot: "특성1" };
    const activeAbilities = passiveActive ? [ability.fid, passiveFid!] : [ability.fid];

    // ── 역할 판정
    const roles = {} as Record<Role, RoleResult>;
    const healAbs = activeAbilities.filter((a) => cfg.healAbilities.has(a));
    // 역할 판정에서 찾은 기술 목록 (기술 추천에 다시 쓴다)
    // 물리·특수 공격 역할별로 찾은 기술 (기술 추천에 다시 쓴다)
    const prioMoves: Record<"atk" | "spa", MoveEntry[]> = { atk: [], spa: [] };
    const setupMoves: Record<"atk" | "spa", MoveEntry[]> = { atk: [], spa: [] };
    let spreadMoves: MoveEntry[] = [];
    let multiHitMoves: MoveEntry[] = [];
    const recMoves = moveList.filter(([f]) => cfg.recoveryMoves.has(f));
    const supMoves = moveList.filter(([f]) => cfg.supportMoves.has(f));

    // 물리·특수 공격 역할: 겸용이면 둘 다, 아니면 능력치가 높은 쪽만 판정한다 (다른 쪽은 점수 0)
    const cats: ("atk" | "spa")[] = hybrid ? ["atk", "spa"] : [offenseStat];
    const syn = this.synergy(activeAbilities);
    for (const k of ["atk", "spa"] as const) {
      const fastRole: Role = k === "atk" ? "fastPhys" : "fastSpec";
      const sweepRole: Role = k === "atk" ? "sweeperPhys" : "sweeperSpec";
      if (!cats.includes(k)) {
        roles[fastRole] = { score: 0, reasons: [] };
        roles[sweepRole] = { score: 0, reasons: [] };
        continue;
      }
      const catNo = k === "atk" ? 0 : 1;
      const offK = k === "atk" ? atk : spa;
      const statName = k === "atk" ? "공격" : "특공";

      // 선공형: 자속 선공기, 또는 높은 스피드 + 높은 화력
      {
        const reasons: Reason[] = [];
        let score = 0;
        if (spe >= raw.fast.minSpeed && offK >= raw.fast.minOffense) {
          score = 0.6 + clamp01((spe - raw.fast.minSpeed) / 60) * 0.3;
          reasons.push({ text: `스피드 ${spe} · ${statName} ${offK}` });
        }
        const prio = moveList.filter(
          ([fid, m]) =>
            m.cat === catNo && m.priority > 0 && m.power >= raw.fast.priorityMinPower &&
            types.includes(m.type) && !cfg.excludePriority.has(fid),
        );
        prioMoves[k] = prio;
        if (prio.length) {
          score = Math.max(score, 0.5) + 0.25;
          reasons.push({ text: "자속 선공기", refs: prio.map(([f]) => f) });
        }
        roles[fastRole] = { score: clamp01(score), reasons };
      }

      // 스위퍼: 고종족값, 랭크업 기술, 특성/패시브 시너지
      {
        const reasons: Reason[] = [];
        let score = 0;
        if (form.bst >= raw.sweeper.legendBst && offK >= raw.sweeper.legendMinOffense && spe >= raw.sweeper.legendMinSpeed) {
          score = 0.7;
          reasons.push({ text: `종족값 ${form.bst}` });
        }
        const offProc = k === "atk" ? SELF_ATK : SELF_SPA;
        const setup = moveList.filter(([, m]) =>
          m.procs.some(
            ([chance, eff, stages]) =>
              stages > 0 && (chance === -1 || chance >= 100) &&
              (eff === offProc || eff === SELF_ALL || (eff === SELF_SPE && m.cat === 2)),
          ) && (m.cat === 2 || (m.power > 0 && m.cat === catNo)),
        );
        const strongSetup = setup.filter(([, m]) =>
          m.cat === 2 && m.procs.some(([, eff, st]) => (eff === offProc && st >= 2) || eff === SELF_ALL) ||
          m.procs.filter(([, eff, st]) => st > 0 && (eff === offProc || eff === SELF_SPE)).length >= 2,
        );
        // 강한 랭크업기(칼춤·나쁜음모·껍질깨기 등)를 앞에 둔다
        setupMoves[k] = [...strongSetup, ...setup.filter((x) => !strongSetup.includes(x))];
        if (offK >= raw.sweeper.setupMinOffense && setup.length) {
          score = Math.max(score, strongSetup.length ? 0.7 : 0.5);
          const shown = (strongSetup.length ? strongSetup : setup).slice(0, 3);
          reasons.push({ text: "랭크업", refs: shown.map(([f]) => f) });
        }
        if (syn.bonus > 0) {
          score += Math.min(0.4, syn.bonus * 0.08);
          reasons.push(...syn.labels);
        }
        roles[sweepRole] = { score: clamp01(score), reasons };
      }
    }

    // 광역기: 상대 둘(더블배틀)을 한 번에 치는 기술
    {
      const reasons: Reason[] = [];
      let score = 0;
      const spread = usableList.filter(
        ([fid, m]) =>
          m.cat !== 2 && m.power >= raw.multi.spreadMinPower && !cfg.excludeMultiMoves.has(fid) &&
          (m.tags.includes(TAG.TARGET_ALL_ENEMIES) || m.tags.includes(TAG.TARGET_ALL_FIELD)),
      );
      const stabSpread = spread.filter(([, m]) => types.includes(m.type));
      spreadMoves = [...stabSpread, ...spread.filter((x) => !stabSpread.includes(x))];
      if (stabSpread.length) {
        score = 0.7;
        reasons.push({ text: "자속 광역기", refs: stabSpread.slice(0, 3).map(([f]) => f) });
      } else if (spread.length) {
        score = 0.4;
        reasons.push({ text: "광역기", refs: spread.slice(0, 2).map(([f]) => f) });
      }
      roles.spread = { score: clamp01(score), reasons };
    }

    // 보스 대응: 보스 실드를 여러 번 깎는 연속기 (자속, 또는 스킬링크·테크니션 같은 특성)
    {
      const reasons: Reason[] = [];
      let score = 0;
      const boostAbs = activeAbilities.filter((a) => cfg.multiHitAbilities.has(a));
      const boosted = boostAbs.length > 0;
      multiHitMoves = usableList.filter(([, m]) => {
        if (m.cat === 2 || m.power <= 0) return false;
        const hits = m.tags.includes(TAG.HIT_10) ? 10 : m.tags.includes(TAG.HIT_3) ? 3
          : m.tags.includes(TAG.HIT_2) ? 2 : m.tags.includes(TAG.HIT_2_5) ? (boosted ? 5 : 2) : 0;
        if (!hits) return false;
        const stab = types.includes(m.type);
        return (stab || boosted) && m.power * hits * (stab ? 1.5 : 1) >= raw.multi.multiHitMinTotalPower;
      });
      if (multiHitMoves.length) {
        score = boosted ? 0.7 : 0.5;
        reasons.push({ text: boosted ? "연속기(+특성)" : "연속기", refs: multiHitMoves.slice(0, 2).map(([f]) => f) });
        if (boosted) reasons.push({ text: "", refs: boostAbs });
      }
      roles.boss = { score: clamp01(score), reasons };
    }

    // 물리막이·특수막이: 내구(HP×방어 / HP×특방), 받는 피해를 줄이는 특성, 방어 랭크업기, 회복기
    const [hp, , def, , spd] = form.stats;
    const sure = (c: number) => c === -1 || c >= 100;
    // 방어(특방)를 2단계 이상, 또는 방어·특방을 함께 올리는 변화기 (철벽·녹기·코튼가드·망각술·코스믹파워 등)
    const bulkUp = (eff: number) =>
      moveList.filter(([, m]) => {
        if (m.cat !== 2) return false;
        const up = (e: number, min: number) => m.procs.some(([c, pe, st]) => pe === e && st >= min && sure(c));
        return up(eff, 2) || (up(eff, 1) && up(SELF_DEF, 1) && up(SELF_SPD, 1));
      });
    const defSetup = bulkUp(SELF_DEF);
    const spdSetup = bulkUp(SELF_SPD);
    const tankRole = (stat: number, statName: string, abilitySet: Set<number>, setup: MoveEntry[]): RoleResult => {
      const reasons: Reason[] = [];
      const min = raw.tank.minBulkProduct;
      const bulk = hp * stat;
      let score = 0;
      if (bulk >= min) {
        score = 0.5 + clamp01((bulk - min) / 10000) * 0.3;
        reasons.push({ text: `HP ${hp} · ${statName} ${stat}` });
      }
      // 특성·랭크업기만 있을 때는 너무 약한 포켓몬을 막이로 보지 않는다
      const bulkyEnough = bulk >= min * raw.tank.minBulkRatio;
      const abs = activeAbilities.filter((x) => abilitySet.has(x));
      if (abs.length && bulkyEnough) {
        score = score ? score + 0.15 : 0.5;
        reasons.push({ text: "", refs: abs });
      }
      if (setup.length && bulkyEnough) {
        score = score ? score + 0.15 : 0.5;
        reasons.push({ text: `${statName} 랭크업`, refs: setup.slice(0, 2).map(([f]) => f) });
      }
      if (score > 0 && recMoves.length) {
        score += 0.15;
        reasons.push({ text: "회복기", refs: recMoves.slice(0, 2).map(([f]) => f) });
      }
      // 재생력·포이즌힐 같은 회복 특성도 회복기처럼 버티는 힘을 늘린다
      if (score > 0 && healAbs.length) {
        score += 0.15;
        reasons.push({ text: "회복 특성", refs: healAbs });
      }
      return { score: clamp01(score), reasons };
    };
    roles.physTank = tankRole(def, "방어", cfg.physTankAbilities, defSetup);
    roles.specTank = tankRole(spd, "특방", cfg.specTankAbilities, spdSetup);

    // 서포터: 방해·강화 기술, 서포트 특성
    {
      const reasons: Reason[] = [];
      const sup = supMoves;
      let score = sup.length >= 3 ? 0.6 : sup.length === 2 ? 0.45 : sup.length === 1 ? 0.3 : 0;
      if (sup.length) reasons.push({ text: "", refs: sup.slice(0, 4).map(([f]) => f) });
      const supAb = activeAbilities.filter((a) => cfg.supportAbilities.has(a));
      if (supAb.length) {
        score += 0.3;
        reasons.push({ text: "", refs: supAb });
      }
      roles.support = { score: clamp01(score), reasons };
    }

    // 단점 특성(게으름·슬로스타트 등)은 모든 역할 점수와 종족값 평가를 깎는다
    const drawback = cfg.drawbackAbilities.get(ability.fid) ?? 1;
    if (drawback < 1) {
      for (const r of ROLES) {
        if (roles[r].score > 0) {
          roles[r].score *= drawback;
          roles[r].reasons.push({ text: "단점 특성", refs: [ability.fid] });
        }
      }
    }

    // ── 주 역할에 맞춘 기술·성격·특성 이유
    const primaryRole = ROLES.reduce<Role | null>(
      (best, r) => (roles[r].score > 0 && (!best || roles[r].score > roles[best].score) ? r : best),
      null,
    );
    // 기술 추천은 스타터 화면에서 고를 수 있는 기술만: 스타터 형태의 레벨 1~5 기술 + 해금 알기술
    // (게임의 getStarterMoves 와 같은 범위. 레벨 0 은 진화 기술이라 빠진다)
    const startSet = new Set(owned.eggMoves.filter((m) => m.unlocked).map((m) => m.fid));
    for (const [k, code] of Object.entries(owned.dex.moves)) if (code >= 1 && code <= 5) startSet.add(Number(k));
    const onlyStart = (l: MoveEntry[]) => l.filter(([f]) => startSet.has(f));
    const startList = onlyStart(usableList);
    const listsFor = (k: "atk" | "spa") => ({
      prio: onlyStart(prioMoves[k]),
      setup: onlyStart(setupMoves[k]),
      defSetup: onlyStart(defSetup),
      spdSetup: onlyStart(spdSetup),
      spread: onlyStart(spreadMoves),
      multiHit: onlyStart(multiHitMoves),
      rec: onlyStart(recMoves),
      sup: onlyStart(supMoves),
    });
    // 물리·특수 공격 역할은 그 분류의 공격 능력치 기준으로 기술·성격을 고른다
    const builds = Object.fromEntries(
      ROLES.map((r) => {
        const st = roleStat(r) ?? offenseStat;
        return [
          r,
          {
            moveset: this.pickMoveset(r, types, st, activeAbilities, startList, listsFor(st), hybrid),
            nature: this.pickNature(owned.natures, st, r),
          },
        ];
      }),
    ) as Candidate["builds"];
    const moveset = primaryRole
      ? builds[primaryRole].moveset
      : this.pickMoveset(null, types, offenseStat, activeAbilities, startList, listsFor(offenseStat), hybrid);
    const abilityWhy =
      isTank(focus)
        ? `${ROLE_NAMES[focus]} 역할: 받는 피해를 줄이는 특성`
        : focus === "support"
          ? "서포터 역할: 보조에 도움이 되는 특성"
          : this.abilityValue(ability.fid, passiveActive ? passiveFid : null, "offense") > 0
            ? "화력·패시브 시너지가 가장 큰 특성"
            : "해금된 특성 중 가장 쓸모 있는 것";

    // ── 방어 상성 (특성·패시브 반영)
    const { defense, notes: defenseNotes, why: defenseWhy } = this.defenseVector(types, activeAbilities);

    // ── 품질: 패시브, 알기술, 개체치, 성격, 럭, 메가
    const w = raw.weights;
    const notes: string[] = [];
    let quality = 0;
    if (passiveActive) quality += w.passiveUnlocked;
    else notes.push(`패시브 ${dex.name(passiveFid)} 미해금`);
    quality += owned.eggMovesUnlocked * w.eggMoveUnlocked;
    const lockedEgg = owned.eggMoves.filter((m) => !m.unlocked);
    if (lockedEgg.length) notes.push(`알기술 미해금: ${lockedEgg.map((m) => m.name).join(", ")}`);
    quality += owned.ivTotal * w.ivPerPoint;
    quality += owned.luck * w.luckPerPoint;
    const nature = primaryRole ? builds[primaryRole].nature : this.pickNature(owned.natures, offenseStat, null);
    if (nature) quality += w.goodNature;
    else notes.push(`추천 성격(${offenseStat === "atk" ? "고집·명랑" : "조심·겁쟁이"}) 미해금`);

    if (hybrid) notes.push("물리·특수 겸용 (두 분류 기술 모두 평가)");
    if (hybridNote) notes.push(hybridNote);
    if (specialForms.length) {
      quality += 1;
      notes.push(`${specialForms.map((f) => f.name).join("·")} 가능`);
    }

    const roleVals = ROLES.map((r) => w.role[r] * roles[r].score).sort((a, b) => b - a);
    const roleScore = roleVals[0] + 0.25 * roleVals.slice(1).reduce((a, b) => a + b, 0);
    if (drawback < 1) notes.push(`단점 특성 ${ability.name} (다른 특성 미해금)`);
    const value = w.bst * form.bst * drawback + roleScore + quality;

    const startTypes = owned.dex.types;
    const typeChange =
      startTypes.join(",") !== types.join(",")
        ? `${dex.typeNames(owned.dex).join("/")} → ${form.name} ${dex.typeNames(form).join("/")}`
        : null;

    return {
      owned,
      form,
      types,
      specialForms,
      hybrid,
      ability,
      abilityWhy,
      passive: { fid: passiveFid, name: dex.name(passiveFid), active: passiveActive },
      activeAbilities,
      moves,
      offenseStat,
      roles,
      defense,
      defenseNotes,
      defenseWhy,
      nature,
      primaryRole,
      moveset,
      builds,
      value,
      notes,
      typeChange,
    };
  }

  /** 특성 선택용 점수: 화력 특성, 패시브와의 시너지, 방어 효과, 서포트 */
  private abilityValue(fid: number, passive: number | null, focus: AbilityFocus): number {
    const { cfg } = this;
    let s = (cfg.offenseAbilities.get(fid) ?? 0) * (focus === "offense" ? 1 : 0.3);
    const drawback = cfg.drawbackAbilities.get(fid);
    if (drawback != null) s -= 10 * (1 - drawback);
    if (cfg.abilityEffects.has(fid)) s += isTank(focus) ? 4 : 1;
    if (focus === "physTank" && cfg.physTankAbilities.has(fid)) s += 4;
    if (focus === "specTank" && cfg.specTankAbilities.has(fid)) s += 4;
    if (isTank(focus) && cfg.healAbilities.has(fid)) s += 4;
    if (cfg.supportAbilities.has(fid)) s += focus === "support" ? 4 : 1;
    if (passive != null) s += this.synergy([fid, passive]).bonus;
    if (passive === fid) s -= 5; // 패시브와 같은 특성은 의미 없음
    return s;
  }

  /** 특성 조합 시너지 (설정 파일의 조합 + Dex 날씨 태그) */
  synergy(abilities: number[]): { bonus: number; labels: Reason[] } {
    const { cfg, dex } = this;
    const set = new Set(abilities);
    let bonus = 0;
    const labels: Reason[] = [];
    for (const a of set) {
      const v = cfg.offenseAbilities.get(a);
      if (v) {
        bonus += v * 0.5;
        labels.push({ text: "", refs: [a] });
      }
    }
    for (const p of cfg.synergyPairs) {
      if (set.has(p.abilities[0]) && set.has(p.abilities[1])) {
        bonus += p.bonus;
        labels.push({ text: p.label });
      }
    }
    const tags = new Set(abilities.flatMap((a) => dex.abilityTags(a)));
    const weather: [number, number, string][] = [
      [TAG.RAIN_SETTER, TAG.RAIN_SYNERGY, "비"],
      [TAG.SAND_SETTER, TAG.SAND_SYNERGY, "모래"],
      [TAG.SUN_SETTER, TAG.SUN_SYNERGY, "햇빛"],
    ];
    for (const [setter, user, label] of weather) {
      if (tags.has(setter) && tags.has(user) && !labels.some((l) => l.text.includes(label))) {
        bonus += 3;
        labels.push({ text: `${label} 날씨 자급` });
      }
    }
    return { bonus, labels };
  }

  /**
   * 공격 타입별로 받는 배율 (특성 반영).
   * why[t] 는 특성 때문에 배율이 바뀐 이유 (예: "필터: 약점 데미지 0.75배"), 바뀌지 않았으면 빈 문자열
   */
  defenseVector(types: number[], abilities: number[]): { defense: number[]; notes: string[]; why: string[] } {
    const { cfg, dex, chart } = this;
    const nTypes = dex.data.ranges.type[1];
    const notes: string[] = [];
    const immuneTag: [number, string][] = [
      [TAG.ELECTRIC_IMMUNE, "전기"],
      [TAG.FIRE_IMMUNE, "불꽃"],
      [TAG.GROUND_IMMUNE, "땅"],
      [TAG.WATER_IMMUNE, "물"],
    ];
    const tagImmune = new Map<number, number>(); // 타입 → 무효로 만드는 특성
    for (const a of abilities) {
      const tags = dex.abilityTags(a);
      for (const [tag, typeName] of immuneTag) if (tags.includes(tag)) tagImmune.set(dex.fid("type", typeName), a);
      const e = cfg.abilityEffects.get(a);
      if (e) notes.push(...e.notes.map((n) => `${dex.name(a)}: ${n}`));
    }
    const defense: number[] = [];
    const why: string[] = [];
    for (let t = 0; t < nTypes; t++) {
      let m = typeMultiplier(chart, t, types);
      const base = m;
      const reasons: string[] = [];
      for (const a of abilities) {
        const e = cfg.abilityEffects.get(a);
        if (!e) continue;
        const mm = e.multiplier.get(t);
        if (mm != null) {
          m *= mm;
          reasons.push(`${dex.name(a)}: ${dex.name(t)} ${mm === 0 ? "무효" : `${mm}배`}`);
        }
        if (e.superEffective && base > 1) {
          m *= e.superEffective;
          reasons.push(`${dex.name(a)}: 약점 데미지 ${e.superEffective}배`);
        }
        if (e.onlySuperEffective && base <= 1) {
          m = 0;
          reasons.push(`${dex.name(a)}: 약점이 아닌 공격 무효`);
        }
      }
      const immuneBy = tagImmune.get(t);
      if (immuneBy != null && m !== 0) {
        m = 0;
        reasons.push(`${dex.name(immuneBy)}: ${dex.name(t)} 무효`);
      }
      defense.push(m);
      why.push(reasons.length ? reasons.join(", ") : "");
    }
    return { defense, notes, why };
  }

  /**
   * 해금된 성격 중 역할에 맞는 것. 안 쓰는 공격 능력치를 깎는 성격만 본다.
   * 선공형·서포터는 스피드, 스위퍼·다대다는 화력, 물리막이는 방어, 특수막이는 특방을 먼저 찾는다.
   */
  private pickNature(
    natures: number[],
    offenseStat: "atk" | "spa",
    role: Role | null,
  ): { index: number; name: string; why: string } | null {
    const bulkSide = role === "specTank" ? "spd" : "def";
    const main = offenseStat === "atk" ? STAT_INDEX.atk : STAT_INDEX.spa;
    const dump = offenseStat === "atk" ? STAT_INDEX.spa : STAT_INDEX.atk;
    const bulk = STAT_INDEX[bulkSide];
    const order =
      isFast(role) || role === "support"
        ? [STAT_INDEX.spe, main]
        : isTank(role)
          ? [bulk, main, STAT_INDEX.spe]
          : [main, STAT_INDEX.spe];
    const label: Record<number, string> = {
      [STAT_INDEX.spe]: "스피드",
      [main]: offenseStat === "atk" ? "공격" : "특공",
      [bulk]: bulkSide === "def" ? "방어" : "특방",
    };
    for (const up of order) {
      const n = natures.find((x) => {
        const e = NATURE_EFFECT[x];
        return e && e[0] === up && e[1] === dump;
      });
      if (n != null) {
        const fallback = up === order[0] ? "" : ` (${label[order[0]]}↑ 성격 미해금)`;
        const why = `${label[up]}↑ ${offenseStat === "atk" ? "특공" : "공격"}↓${fallback}`;
        return { index: n, name: NATURE_NAMES[n], why };
      }
    }
    return null;
  }

  /**
   * 주 역할에 맞춘 기술 4개.
   * 공격기는 위력 × 명중 × 자속(1.5) × 주 공격 분류(아니면 0.6)로 줄 세우고, 반동·자기 능력치 하락은 조금 깎는다.
   */
  private pickMoveset(
    role: Role | null,
    types: number[],
    offenseStat: "atk" | "spa",
    abilities: number[],
    moveList: MoveEntry[],
    lists: {
      prio: MoveEntry[];
      setup: MoveEntry[];
      defSetup: MoveEntry[];
      spdSetup: MoveEntry[];
      spread: MoveEntry[];
      multiHit: MoveEntry[];
      rec: MoveEntry[];
      sup: MoveEntry[];
    },
    /** 물리·특수 겸용이면 다른 분류 공격기도 거의 같게 친다 (아니면 moveList 에 주 분류 공격기만 들어온다) */
    hybrid = false,
  ): MovePick[] {
    const { cfg, dex } = this;
    const mainCat = offenseStat === "atk" ? 0 : 1;
    const noRecoil = abilities.some((a) => cfg.recoilImmuneAbilities.has(a));
    const ok = (fid: number) => !cfg.movesetExclude.has(fid);
    const value = (m: MoveInfo) => {
      if (m.cat === 2 || m.power <= 0 || m.tags.includes(OHKO_TAG)) return 0;
      let v = m.power * (m.acc > 0 ? m.acc / 100 : 1) * (types.includes(m.type) ? 1.5 : 1) * (m.cat === mainCat ? 1 : hybrid ? 0.9 : 0.6);
      if (!noRecoil && m.tags.some((t) => t >= RECOIL_TAGS[0] && t <= RECOIL_TAGS[1])) v *= 0.85;
      if (m.procs.some(([c, e, st]) => st < 0 && e <= SELF_STAT_MAX && (c === -1 || c >= 100))) v *= 0.85;
      return v;
    };
    const attacks = moveList
      .filter(([fid]) => ok(fid))
      .map(([fid, m]) => ({ fid, m, v: value(m) }))
      .filter((x) => x.v > 0)
      .sort((a, b) => b.v - a.v);
    const byValue = (l: MoveEntry[]) => l.filter(([fid]) => ok(fid)).sort((a, b) => value(b[1]) - value(a[1]));

    const picks: MovePick[] = [];
    const used = new Set<number>();
    const covered = new Set<number>();
    // cover=false: 선공기는 타입을 "채운" 것으로 치지 않는다 (주력 자속기를 따로 넣기 위해)
    const add = (fid: number | undefined, why: string, cover = true) => {
      if (fid == null || picks.length >= 4 || used.has(fid)) return;
      used.add(fid);
      const m = dex.move(fid);
      if (cover && m && m.cat !== 2) covered.add(m.type);
      picks.push({ fid, why });
    };
    const first = (l: MoveEntry[]) => l.find(([fid]) => ok(fid) && !used.has(fid))?.[0];
    const stab = () =>
      add(attacks.find((a) => !used.has(a.fid) && types.includes(a.m.type) && !covered.has(a.m.type))?.fid, "자속 주력기");
    // 견제기는 가장 센 공격기의 절반 이상 위력일 때만 (할퀴기 같은 약한 기술로 칸을 채우지 않는다)
    const minCoverage = (attacks[0]?.v ?? 0) * 0.5;
    const coverage = () => {
      const a = attacks.find((x) => !used.has(x.fid) && !covered.has(x.m.type) && x.v >= minCoverage);
      if (a) add(a.fid, `${dex.name(a.m.type)} 타입 견제`);
    };

    switch (role) {
      case "fastPhys":
      case "fastSpec":
        add(first(byValue(lists.prio)), "자속 선공기", false);
        stab();
        coverage();
        break;
      case "sweeperPhys":
      case "sweeperSpec":
        add(first(lists.setup), "랭크업");
        stab();
        coverage();
        add(first(byValue(lists.prio)), "선공기", false);
        break;
      case "spread":
        add(first(byValue(lists.spread)), "광역기 (더블배틀)");
        stab();
        coverage();
        break;
      case "boss":
        add(first(byValue(lists.multiHit)), "연속기 (보스 실드)");
        stab();
        coverage();
        break;
      case "physTank":
      case "specTank":
        add(first(lists.rec), "회복기");
        add(first(role === "physTank" ? lists.defSetup : lists.spdSetup), role === "physTank" ? "방어 랭크업" : "특방 랭크업");
        stab();
        add(first(lists.sup), "보조기");
        break;
      case "support":
        add(first(lists.sup), "보조기");
        add(first(lists.sup), "보조기");
        add(first(lists.rec), "회복기");
        stab();
        break;
    }
    // 남은 칸: 자속기 → 견제기 → 랭크업 → 회복·보조기 → 아무 공격기
    while (picks.length < 4) {
      const before = picks.length;
      stab();
      if (picks.length === before) coverage();
      if (picks.length === before) add(first(lists.setup), "랭크업");
      if (picks.length === before) add(first(lists.rec), "회복기");
      if (picks.length === before) add(first(lists.sup), "보조기");
      if (picks.length === before) add(attacks.find((a) => !used.has(a.fid))?.fid, "공격기");
      if (picks.length === before) add(moveList.find(([f]) => ok(f) && !used.has(f))?.[0], "남은 시작 기술");
      if (picks.length === before) break;
    }
    return picks;
  }
}
