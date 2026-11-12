// 보유 스타터 하나를 "클래식에서 어떻게 쓸 수 있는가"로 평가한다.
// 진화 후 형태(최종형)를 기준으로 타입·특성·기술·종족값을 보고, 역할 점수와 이유를 만든다.
import { TAG, type Dex, type DexSpecies, type MoveInfo } from "../dex";
import { NATURE_EFFECT, NATURE_NAMES } from "../rules";
import type { OwnedStarter } from "../starters";
import type { TypeMatrix } from "../typeChart";
import { typeMultiplier } from "../typeChart";
import type { ResolvedConfig } from "./config";

export type Role = "fast" | "sweeper" | "multi" | "tank" | "support";
export const ROLES: Role[] = ["fast", "sweeper", "multi", "tank", "support"];
export const ROLE_NAMES: Record<Role, string> = {
  fast: "선공형",
  sweeper: "스위퍼",
  multi: "다대다·쉴드",
  tank: "막이",
  support: "서포터",
};

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

export interface Candidate {
  owned: OwnedStarter;
  /** 평가 기준이 된 진화 후 형태 */
  form: DexSpecies;
  /** 평가 형태의 타입 fid */
  types: number[];
  /** 메가진화·거다이맥스·폼 변화 형태 (평가 형태와 같은 종) */
  specialForms: DexSpecies[];
  ability: AbilityPick;
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
  nature: { index: number; name: string } | null;
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
const SELF_SPA = 2;
const SELF_SPE = 4;
const SELF_ALL = 22;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export class CandidateBuilder {
  constructor(
    private readonly dex: Dex,
    private readonly cfg: ResolvedConfig,
    private readonly chart: TypeMatrix,
  ) {}

  /** 진화 갈래가 여러 개면(이브이 등) 가장 점수가 높은 갈래를 고른다 */
  build(owned: OwnedStarter): Candidate {
    let best: Candidate | null = null;
    for (const form of this.targetForms(owned)) {
      const c = this.evaluate(owned, form);
      if (!best || c.value > best.value) best = c;
    }
    return best!;
  }

  private targetForms(owned: OwnedStarter): DexSpecies[] {
    const regional = owned.speciesId >= 2000;
    // 기본 이미지 키(= SpeciesId)인 형태만 진화 결과로 본다. 스타모빌 같은 별도 폼은 제외
    const finals = owned.family.filter(
      (f) => f.final && f.form === 0 && f.img === String(f.id) && (regional || f.id < 2000),
    );
    return finals.length ? finals : [owned.dex];
  }

  private evaluate(owned: OwnedStarter, form: DexSpecies): Candidate {
    const { dex, cfg } = this;
    const raw = cfg.raw;
    const [, atk, , spa, , spe] = form.stats;
    const offenseStat = atk >= spa ? "atk" : "spa";
    const off = Math.max(atk, spa);
    const types = form.types;

    // ── 기술: 레벨업(진화 전 형태 포함)·진화·기억버섯 + 해금 알기술
    const moves = new Set<number>();
    const lineage = owned.family.filter(
      (f) => f.form === 0 && (f === owned.dex || f === form || (!f.starter && !f.final)),
    );
    for (const f of lineage) {
      for (const [k, code] of Object.entries(f.moves)) if (code <= 200) moves.add(Number(k));
    }
    owned.eggMoves.forEach((m) => m.unlocked && moves.add(m.fid));
    const moveList = [...moves]
      .map((fid) => [fid, dex.move(fid)] as const)
      .filter((x): x is readonly [number, MoveInfo] => !!x[1] && !x[1].tags.includes(TAG.NOT_IMPLEMENTED));

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
      const s = this.abilityValue(fid, passiveActive ? passiveFid : null);
      if (s > abilityScore) {
        abilityScore = s;
        ability = { fid, name: dex.name(fid), slot };
      }
    }
    if (!ability) ability = { fid: form.abilities.a1, name: dex.name(form.abilities.a1), slot: "특성1" };
    const activeAbilities = passiveActive ? [ability.fid, passiveFid!] : [ability.fid];

    // ── 역할 판정
    const roles = {} as Record<Role, RoleResult>;

    // 선공형: 자속 선공기, 또는 높은 스피드 + 높은 화력
    {
      const reasons: Reason[] = [];
      let score = 0;
      if (spe >= raw.fast.minSpeed && off >= raw.fast.minOffense) {
        score = 0.6 + clamp01((spe - raw.fast.minSpeed) / 60) * 0.3;
        reasons.push({ text: `스피드 ${spe} · ${offenseStat === "atk" ? "공격" : "특공"} ${off}` });
      }
      const prio = moveList.filter(
        ([fid, m]) =>
          m.cat !== 2 && m.priority > 0 && m.power >= raw.fast.priorityMinPower &&
          types.includes(m.type) && !cfg.excludePriority.has(fid),
      );
      if (prio.length) {
        score = Math.max(score, 0.5) + 0.25;
        reasons.push({ text: "자속 선공기", refs: prio.map(([f]) => f) });
      }
      roles.fast = { score: clamp01(score), reasons };
    }

    // 스위퍼: 고종족값, 랭크업 기술, 특성/패시브 시너지
    {
      const reasons: Reason[] = [];
      let score = 0;
      if (form.bst >= raw.sweeper.legendBst && off >= raw.sweeper.legendMinOffense && spe >= raw.sweeper.legendMinSpeed) {
        score = 0.7;
        reasons.push({ text: `종족값 ${form.bst}` });
      }
      const offProc = offenseStat === "atk" ? SELF_ATK : SELF_SPA;
      const setup = moveList.filter(([, m]) =>
        m.procs.some(
          ([chance, eff, stages]) =>
            stages > 0 && (chance === -1 || chance >= 100) &&
            (eff === offProc || eff === SELF_ALL || (eff === SELF_SPE && m.cat === 2)),
        ) && (m.cat === 2 || m.power > 0),
      );
      const strongSetup = setup.filter(([, m]) =>
        m.cat === 2 && m.procs.some(([, eff, st]) => (eff === offProc && st >= 2) || eff === SELF_ALL) ||
        m.procs.filter(([, eff, st]) => st > 0 && (eff === offProc || eff === SELF_SPE)).length >= 2,
      );
      if (off >= raw.sweeper.setupMinOffense && setup.length) {
        score = Math.max(score, strongSetup.length ? 0.7 : 0.5);
        const shown = (strongSetup.length ? strongSetup : setup).slice(0, 3);
        reasons.push({ text: "랭크업", refs: shown.map(([f]) => f) });
      }
      const syn = this.synergy(activeAbilities);
      if (syn.bonus > 0) {
        score += Math.min(0.4, syn.bonus * 0.08);
        reasons.push(...syn.labels);
      }
      roles.sweeper = { score: clamp01(score), reasons };
    }

    // 다대다·보스 쉴드: 광역기, 연속기
    {
      const reasons: Reason[] = [];
      let score = 0;
      const spread = moveList.filter(
        ([fid, m]) =>
          m.cat !== 2 && m.power >= raw.multi.spreadMinPower && !cfg.excludeMultiMoves.has(fid) &&
          (m.tags.includes(TAG.TARGET_ALL_ENEMIES) || m.tags.includes(TAG.TARGET_ALL_FIELD)),
      );
      const stabSpread = spread.filter(([, m]) => types.includes(m.type));
      if (stabSpread.length) {
        score = 0.7;
        reasons.push({ text: "자속 광역기", refs: stabSpread.slice(0, 3).map(([f]) => f) });
      } else if (spread.length) {
        score = 0.4;
        reasons.push({ text: "광역기", refs: spread.slice(0, 2).map(([f]) => f) });
      }
      const boosted = activeAbilities.some((a) => cfg.multiHitAbilities.has(a));
      const multiHit = moveList.filter(([, m]) => {
        if (m.cat === 2 || m.power <= 0) return false;
        const hits = m.tags.includes(TAG.HIT_10) ? 10 : m.tags.includes(TAG.HIT_3) ? 3
          : m.tags.includes(TAG.HIT_2) ? 2 : m.tags.includes(TAG.HIT_2_5) ? (boosted ? 5 : 2) : 0;
        if (!hits) return false;
        const stab = types.includes(m.type);
        return (stab || boosted) && m.power * hits * (stab ? 1.5 : 1) >= raw.multi.multiHitMinTotalPower;
      });
      if (multiHit.length) {
        score = Math.max(score, 0.4) + (boosted ? 0.3 : 0.1);
        reasons.push({ text: boosted ? "연속기(+특성)" : "연속기", refs: multiHit.slice(0, 2).map(([f]) => f) });
      }
      roles.multi = { score: clamp01(score), reasons };
    }

    // 막이: HP×방어 / HP×특방, 회복기
    {
      const reasons: Reason[] = [];
      let score = 0;
      const [hp, , def, , spd] = form.stats;
      const bulk = Math.max(hp * def, hp * spd);
      if (bulk >= raw.tank.minBulkProduct) {
        score = 0.5 + clamp01((bulk - raw.tank.minBulkProduct) / 10000) * 0.3;
        reasons.push({ text: hp * def >= hp * spd ? `물리 내구 (HP ${hp} · 방어 ${def})` : `특수 내구 (HP ${hp} · 특방 ${spd})` });
        const rec = moveList.filter(([f]) => cfg.recoveryMoves.has(f));
        if (rec.length) {
          score += 0.2;
          reasons.push({ text: "회복기", refs: rec.slice(0, 2).map(([f]) => f) });
        }
      }
      roles.tank = { score: clamp01(score), reasons };
    }

    // 서포터: 방해·강화 기술, 서포트 특성
    {
      const reasons: Reason[] = [];
      const sup = moveList.filter(([f]) => cfg.supportMoves.has(f));
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

    // ── 방어 상성 (특성·패시브 반영)
    const { defense, notes: defenseNotes } = this.defenseVector(types, activeAbilities);

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
    const nature = this.pickNature(owned.natures, offenseStat);
    if (nature) quality += w.goodNature;
    else notes.push(`추천 성격(${offenseStat === "atk" ? "고집·명랑" : "조심·겁쟁이"}) 미해금`);

    const specialForms = owned.family.filter((f) => f.id === form.id && f.form >= 1 && f.form <= 4);
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
      ability,
      passive: { fid: passiveFid, name: dex.name(passiveFid), active: passiveActive },
      activeAbilities,
      moves,
      offenseStat,
      roles,
      defense,
      defenseNotes,
      nature,
      value,
      notes,
      typeChange,
    };
  }

  /** 특성 선택용 점수: 화력 특성, 패시브와의 시너지, 방어 효과, 서포트 */
  private abilityValue(fid: number, passive: number | null): number {
    const { cfg } = this;
    let s = cfg.offenseAbilities.get(fid) ?? 0;
    const drawback = cfg.drawbackAbilities.get(fid);
    if (drawback != null) s -= 10 * (1 - drawback);
    if (cfg.abilityEffects.has(fid)) s += 1;
    if (cfg.supportAbilities.has(fid)) s += 1;
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

  defenseVector(types: number[], abilities: number[]): { defense: number[]; notes: string[] } {
    const { cfg, dex, chart } = this;
    const nTypes = dex.data.ranges.type[1];
    const notes: string[] = [];
    const immuneTag: [number, string][] = [
      [TAG.ELECTRIC_IMMUNE, "전기"],
      [TAG.FIRE_IMMUNE, "불꽃"],
      [TAG.GROUND_IMMUNE, "땅"],
      [TAG.WATER_IMMUNE, "물"],
    ];
    const tagImmune = new Set<number>();
    for (const a of abilities) {
      const tags = dex.abilityTags(a);
      for (const [tag, typeName] of immuneTag) if (tags.includes(tag)) tagImmune.add(dex.fid("type", typeName));
      const e = cfg.abilityEffects.get(a);
      if (e) notes.push(...e.notes.map((n) => `${dex.name(a)}: ${n}`));
    }
    const defense: number[] = [];
    for (let t = 0; t < nTypes; t++) {
      let m = typeMultiplier(chart, t, types);
      const base = m;
      for (const a of abilities) {
        const e = cfg.abilityEffects.get(a);
        if (!e) continue;
        const mm = e.multiplier.get(t);
        if (mm != null) m *= mm;
        if (e.superEffective && base > 1) m *= e.superEffective;
        if (e.onlySuperEffective && base <= 1) m = 0;
      }
      if (tagImmune.has(t)) m = 0;
      defense.push(m);
    }
    return { defense, notes };
  }

  private pickNature(natures: number[], offenseStat: "atk" | "spa"): { index: number; name: string } | null {
    const main = offenseStat === "atk" ? STAT_INDEX.atk : STAT_INDEX.spa;
    const dump = offenseStat === "atk" ? STAT_INDEX.spa : STAT_INDEX.atk;
    // 화력 우선(고집/조심), 그다음 스피드(명랑/겁쟁이)
    for (const up of [main, STAT_INDEX.spe]) {
      const n = natures.find((x) => {
        const e = NATURE_EFFECT[x];
        return e && e[0] === up && e[1] === dump;
      });
      if (n != null) return { index: n, name: NATURE_NAMES[n] };
    }
    return null;
  }
}
