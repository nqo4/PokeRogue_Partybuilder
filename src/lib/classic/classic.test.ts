import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { Dex, type DexData } from "../dex";
import { decryptSave } from "../save";
import { buildSummary, type SaveSummary } from "../starters";
import { buildTypeMatrix, typeMultiplier } from "../typeChart";
import { CandidateBuilder, attackScore } from "./candidate";
import { resolveConfig } from "./config";
import { ClassicRecommender, hasFormChange, type PartyRecommendation } from "./recommend";
import { findings } from "./check";
import { cleared, eligible, type ClearCriterion } from "../ribbons";
import { Official, type OfficialData } from "../official";

const root = path.resolve(import.meta.dirname, "../../..");
const dex = new Dex(JSON.parse(fs.readFileSync(path.join(root, "public/data/dex.json"), "utf8")) as DexData);
const T = (n: string) => dex.fid("type", n);

describe("설정·상성", () => {
  it("설정 파일의 모든 이름이 도감에 있다", () => {
    expect(() => resolveConfig(dex)).not.toThrow();
  });

  it("타입 상성: 갸라도스(물/비행)는 전기 4배, 땅 무효", () => {
    const m = buildTypeMatrix(dex);
    expect(typeMultiplier(m, T("전기"), [T("물"), T("비행")])).toBe(4);
    expect(typeMultiplier(m, T("땅"), [T("물"), T("비행")])).toBe(0);
    expect(typeMultiplier(m, T("격투"), [T("고스트")])).toBe(0);
  });

  it("특성 방어 효과: 두꺼운지방 불꽃 반감, 복슬복슬 불꽃 2배, 피뢰침 전기 무효", () => {
    const b = new CandidateBuilder(dex, resolveConfig(dex), buildTypeMatrix(dex));
    const ab = (n: string) => dex.fid("ability", n);
    expect(b.defenseVector([T("노말")], [ab("두꺼운지방")]).defense[T("불꽃")]).toBe(0.5);
    expect(b.defenseVector([T("노말")], [ab("복슬복슬")]).defense[T("불꽃")]).toBe(2);
    expect(b.defenseVector([T("물"), T("비행")], [ab("피뢰침")]).defense[T("전기")]).toBe(0);
    expect(b.defenseVector([T("풀")], [ab("필터")]).defense[T("불꽃")]).toBe(1.5);
    // 바뀐 칸에는 이유가 붙고, 그대로인 칸은 빈 문자열
    expect(b.defenseVector([T("풀")], [ab("필터")]).why[T("불꽃")]).toBe("필터: 약점 데미지 0.75배");
    expect(b.defenseVector([T("풀")], [ab("필터")]).why[T("물")]).toBe("");
    expect(b.defenseVector([T("물"), T("비행")], [ab("피뢰침")]).why[T("전기")]).toBe("피뢰침: 전기 무효");
  });
});

function findSave(): string | undefined {
  if (process.env.SAVE_PATH) return process.env.SAVE_PATH;
  const dir = path.join(root, "testdata");
  if (!fs.existsSync(dir)) return undefined;
  const f = fs.readdirSync(dir).find((n) => n.endsWith(".prsv"));
  return f && path.join(dir, f);
}

const savePath = findSave();
describe.skipIf(!savePath)("실제 세이브로 클래식 추천", () => {
  let summary: SaveSummary;
  let rec: ClassicRecommender;
  let results: PartyRecommendation[];
  beforeAll(() => {
    summary = buildSummary(decryptSave(fs.readFileSync(savePath!, "utf8")), dex);
    rec = new ClassicRecommender(dex, summary.starters);
    results = rec.recommend({ onlyUncleared: true });
  });

  it("파티를 여러 개 돌려준다", () => {
    expect(results.length).toBeGreaterThanOrEqual(3);
  });

  it("캐리몬으로 지정한 포켓몬은 추천 파티마다 들어간다", () => {
    const carry = rec.candidates.find((c) => c.owned.cost <= 3)!;
    const rs = rec.recommend({ onlyUncleared: true, required: [carry.owned.speciesId], count: 3 });
    expect(rs.length).toBeGreaterThan(0);
    for (const r of rs) expect(r.analysis.members).toContain(carry);
  });

  it("고정 포켓몬은 고른 최종 형태(메가진화 포함)로 들어간다", () => {
    const ralts = rec.candidates.find((c) => c.owned.name === "랄토스");
    if (!ralts) return;
    const id = ralts.owned.speciesId;
    const forms = rec.forms(id);
    const mega = forms.find((f) => f.name.includes("메가") && f.name.includes("가디안"));
    expect(forms.some((f) => f.name === "엘레이드")).toBe(true);
    expect(mega).toBeDefined();
    const [r] = rec.recommend({ onlyUncleared: false, required: [id], requiredForms: { [id]: mega!.idx }, count: 1 });
    const m = r.analysis.members.find((x) => x.owned.speciesId === id)!;
    expect(m.form).toBe(mega);
    // 기본 형태(가디안)의 기술도 쓸 수 있다
    expect(m.moves.size).toBeGreaterThan(5);
  });

  it("고정 포켓몬에 정한 포지션(역할 없음 포함)을 그대로 쓴다", () => {
    const carry = rec.candidates.find((c) => c.owned.cost <= 3)!;
    const id = carry.owned.speciesId;
    const [tank] = rec.recommend({ onlyUncleared: true, required: [id], fixedPositions: { [id]: "specTank" }, count: 1 });
    const i = tank.analysis.members.indexOf(carry);
    expect(tank.analysis.positions[i]).toBe("specTank");
    const [free] = rec.recommend({ onlyUncleared: true, required: [id], fixedPositions: { [id]: "free" }, count: 1 });
    const j = free.analysis.members.indexOf(carry);
    expect(free.analysis.positions[j]).toBeNull();
    expect(free.analysis.free[j]).toBe(true);
    // 역할 없는 포켓몬을 빼고도 공격 역할이 있어야 한다
    expect(free.analysis.hasAttacker).toBe(true);
  });

  it("보완 후보는 캐리몬을 바꾸지 않는다 (다른 후보가 없을 때만 표시와 함께 바꾼다)", () => {
    const meditite = rec.candidates.find((c) => c.owned.name === "요가랑");
    if (!meditite) return;
    const rs = rec.recommend({ onlyUncleared: false, required: [meditite.owned.speciesId], count: 3 });
    for (const r of rs) {
      const fixed = r.suggestions.filter((s) => s.replace === meditite);
      for (const s of fixed) expect(s.replacesFixed).toBe(true);
      // 고정을 바꾸는 후보는 다른 후보와 섞이지 않는다
      if (fixed.length) expect(r.suggestions.every((s) => s.replacesFixed)).toBe(true);
    }
  });

  it("모든 파티가 코스트 10 이하, 미클리어 포켓몬만, 공격 역할 1마리 이상", () => {
    for (const r of results) {
      const a = r.analysis;
      expect(a.cost).toBeLessThanOrEqual(10);
      expect(a.members.length).toBeGreaterThan(0);
      expect(a.members.length).toBeLessThanOrEqual(6);
      expect(a.hasAttacker).toBe(true);
      for (const m of a.members) expect(m.owned.classicWins).toBe(0);
    }
  });

  it("단점 특성(게을킹 게으름)은 공격 역할로 보지 않는다", () => {
    const slaking = rec.candidate(287);
    expect(slaking?.ability.name).toBe("게으름");
    expect(slaking!.roles.sweeperPhys.score).toBeLessThan(0.5);
  });

  it("파티 수를 정확히 맞춘다 (3마리)", () => {
    const rs = rec.recommend({ onlyUncleared: true, partySize: 3, count: 3 });
    expect(rs.length).toBeGreaterThan(0);
    for (const r of rs) expect(r.analysis.members.length).toBe(3);
  });

  it("폼 변화 포켓몬 수 제한 (0마리)", () => {
    const rs = rec.recommend({ onlyUncleared: true, maxFormChange: 0, count: 3 });
    for (const r of rs) expect(r.analysis.members.filter(hasFormChange).length).toBe(0);
  });

  it("다시 추천하면 이전에 보여준 파티와 다른 파티를 준다", () => {
    const first = rec.recommend({ onlyUncleared: true, count: 5 });
    const second = rec.recommend({ onlyUncleared: true, count: 5, exclude: first.map((r) => r.key) });
    expect(second.length).toBeGreaterThan(0);
    const firstKeys = new Set(first.map((r) => r.key));
    for (const r of second) expect(firstKeys.has(r.key)).toBe(false);
  });

  it("역할별 추천 기술: 시작 기술(레벨 1~5 + 해금 알기술)에서만, 4개 이하, 중복·제외 기술 없음", () => {
    const cfg = resolveConfig(dex);
    const all = summary.starters.map((s) => rec.candidate(s.speciesId)).filter((c) => !!c);
    for (const c of all) {
      const start = new Set(c.owned.eggMoves.filter((e) => e.unlocked).map((e) => e.fid));
      for (const [k, code] of Object.entries(c.owned.dex.moves)) if (code >= 1 && code <= 5) start.add(Number(k));
      for (const b of [c.moveset, ...Object.values(c.builds).map((x) => x.moveset)]) {
        const fids = b.map((m) => m.fid);
        expect(fids.length).toBeLessThanOrEqual(4);
        expect(new Set(fids).size).toBe(fids.length);
        for (const f of fids) {
          expect(cfg.movesetExclude.has(f)).toBe(false);
          expect(start.has(f)).toBe(true);
        }
      }
    }
    // 시작 기술에 랭크업기가 있는 스위퍼는 첫 칸이 랭크업기
    const sweeper = all.find((c) => c.primaryRole?.startsWith("sweeper") && c.moveset.some((m) => m.why === "랭크업"));
    expect(sweeper?.moveset[0].why).toBe("랭크업");
    // 회복기가 있는 막이는 첫 칸이 회복기
    const tank = all.find((c) => (c.primaryRole === "physTank" || c.primaryRole === "specTank") && cfg.recoveryMoves.has(c.moveset[0]?.fid));
    if (tank) expect(tank.moveset[0].why).toBe("회복기");
  });

  it("포지션: 한 마리에 하나, 포지션별 정원을 넘지 않고, 6마리 파티는 3가지 이상으로 나뉜다", () => {
    const max = resolveConfig(dex).raw.positions.max;
    for (const r of results) {
      const a = r.analysis;
      expect(a.positions.length).toBe(a.members.length);
      for (const role of Object.keys(max) as (keyof typeof max)[]) {
        expect(a.positions.filter((p) => p === role).length).toBeLessThanOrEqual(max[role]);
      }
      if (a.members.length === 6) expect(new Set(a.positions.filter(Boolean)).size).toBeGreaterThanOrEqual(3);
    }
  });

  it("내 파티 점검: 공격 역할이 없으면 보완 필요, 빈 자리와 남은 코스트를 알려 준다", () => {
    // 막이·서포터만 맡을 수 있는 포켓몬 2마리 (공격 역할 점수가 낮은 것)
    const nonAttackers = rec.candidates
      .filter((c) => attackScore(c) < 0.5 && c.owned.cost <= 3)
      .slice(0, 2);
    const a = rec.analyze(nonAttackers);
    const f = findings(a, 10, dex);
    expect(a.hasAttacker).toBe(false);
    expect(f.some((x) => x.level === "warn" && x.text.includes("선공형이나 스위퍼가 없음"))).toBe(true);
    expect(f.some((x) => x.text.includes(`빈 자리 4칸, 코스트 ${10 - a.cost} 남음`))).toBe(true);
    expect(f.some((x) => x.level === "ok")).toBe(false);
  });

  it("지정한 포켓몬을 반드시 포함한다", () => {
    const [r] = rec.recommend({ onlyUncleared: true, required: [287], count: 1 });
    expect(r.analysis.members.some((m) => m.owned.speciesId === 287)).toBe(true);
  });
});

describe.skipIf(!savePath)("물리·특수 역할", () => {
  let rec: ClassicRecommender;
  beforeAll(() => {
    rec = new ClassicRecommender(dex, buildSummary(decryptSave(fs.readFileSync(savePath!, "utf8")), dex).starters);
  });

  it("겸용 판정: 공격·특공이 비슷하거나(망나뇽) 메가로 주 공격이 바뀌면(루카리오) 겸용, 대짱이는 물리만", () => {
    const dragonite = rec.candidates.find((c) => c.form.name === "망나뇽");
    if (dragonite) expect(dragonite.hybrid).toBe(true);
    const lucario = rec.candidates.find((c) => c.form.name === "루카리오");
    if (lucario) expect(lucario.hybrid).toBe(true);
    const swampert = rec.candidates.find((c) => c.form.name === "대짱이");
    if (swampert) {
      expect(swampert.hybrid).toBe(false);
      // 특수 역할은 판정하지 않는다
      expect(swampert.roles.fastSpec.score).toBe(0);
      expect(swampert.roles.sweeperSpec.score).toBe(0);
      // 추천 기술에 특수기(탁류 등)가 없다
      for (const b of [swampert.moveset, ...Object.values(swampert.builds).map((x) => x.moveset)])
        for (const m of b) expect(dex.move(m.fid)?.cat, dex.name(m.fid)).not.toBe(1);
    }
  });

  it("겸용이 아니면 주 공격 분류의 공격 역할만 점수가 있다", () => {
    for (const c of rec.candidates) {
      if (c.hybrid) continue;
      const other = c.form.stats[1] >= c.form.stats[3] ? ["fastSpec", "sweeperSpec"] : ["fastPhys", "sweeperPhys"];
      for (const r of other) expect(c.roles[r as keyof typeof c.roles].score, `${c.form.name} ${r}`).toBe(0);
    }
  });
});

describe.skipIf(!savePath)("챌린지 파티 추천", () => {
  let summary: SaveSummary;
  beforeAll(() => {
    summary = buildSummary(decryptSave(fs.readFileSync(savePath!, "utf8")), dex);
  });

  it("단일 타입: 모든 멤버의 형태(메가·거다이 포함)가 그 타입이고, 미클리어만이면 그 리본이 없다", () => {
    const fire = dex.fid("type", "불꽃");
    const c: ClearCriterion = { mode: "type", type: fire };
    const rec = new ClassicRecommender(dex, summary.starters, undefined, c);
    expect(rec.candidates.every((x) => eligible(x.owned, c))).toBe(true);
    const rs = rec.recommend({ onlyUncleared: true, count: 3 });
    expect(rs.length).toBeGreaterThan(0);
    for (const r of rs) {
      expect(r.analysis.cost).toBeLessThanOrEqual(10);
      for (const m of r.analysis.members) {
        expect(m.form.types, m.form.name).toContain(fire);
        for (const f of m.specialForms) expect(f.types, f.name).toContain(fire);
        expect(cleared(m.owned, c, dex), m.form.name).toBe(false);
      }
    }
    // 이브이는 불꽃 챌린지에서 부스터로만 나간다
    const eevee = rec.candidate(133);
    if (eevee) {
      expect(eevee.form.name).toBe("부스터");
      expect(rec.forms(133).every((f) => f.types.includes(fire))).toBe(true);
    }
  });

  it("공식 진화 데이터가 있으면 리전폼 진화도 쓴다 (단일 8세대 브케인 → 히스이 블레이범)", () => {
    const official = new Official(JSON.parse(fs.readFileSync(path.join(root, "public/data/official.json"), "utf8")) as OfficialData);
    const rec = new ClassicRecommender(dex, summary.starters, undefined, { mode: "gen", gen: 8 }, official);
    expect(rec.candidate(155)?.form.name).toBe("히스이 블레이범");
    // 클래식에서는 블레이범·히스이 블레이범 둘 다 고를 수 있다
    const classic = new ClassicRecommender(dex, summary.starters, undefined, undefined, official);
    const names = classic.forms(155).map((f) => f.name);
    expect(names).toContain("블레이범");
    expect(names).toContain("히스이 블레이범");
  });

  it("단일 세대: 모든 멤버의 형태가 그 세대다", () => {
    const c: ClearCriterion = { mode: "gen", gen: 3 };
    const rec = new ClassicRecommender(dex, summary.starters, undefined, c);
    const rs = rec.recommend({ onlyUncleared: true, count: 3 });
    expect(rs.length).toBeGreaterThan(0);
    for (const r of rs) for (const m of r.analysis.members) expect(m.form.gen, m.form.name).toBe(3);
  });
});

describe.skipIf(!savePath)("물리막이·특수막이", () => {
  let rec: ClassicRecommender;
  beforeAll(() => {
    rec = new ClassicRecommender(dex, buildSummary(decryptSave(fs.readFileSync(savePath!, "utf8")), dex).starters);
  });
  const byName = (n: string) => rec.candidates.find((c) => c.form.name === n);

  it("방어가 높은 포켓몬은 물리막이, 특방이 높은 포켓몬은 특수막이", () => {
    for (const n of ["보스로라", "강철톤"]) {
      const c = byName(n);
      if (c) expect(c.roles.physTank.score, n).toBeGreaterThanOrEqual(0.5);
    }
    for (const n of ["크레세리아", "해피너스"]) {
      const c = byName(n);
      if (c) expect(c.roles.specTank.score, n).toBeGreaterThanOrEqual(0.5);
    }
  });

  it("재생력·포이즌힐 같은 회복 특성은 막이 점수를 올린다", () => {
    const cfg = resolveConfig(dex);
    const healers = rec.candidates.filter(
      (c) => c.activeAbilities.some((x) => cfg.healAbilities.has(x)) && c.roles.physTank.score > 0,
    );
    expect(healers.length).toBeGreaterThan(0);
    for (const c of healers) expect(c.roles.physTank.reasons.some((r) => r.text === "회복 특성"), c.form.name).toBe(true);
  });
});
