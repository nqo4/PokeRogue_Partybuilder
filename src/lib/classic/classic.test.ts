import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Dex, type DexData } from "../dex";
import { decryptSave } from "../save";
import { buildSummary } from "../starters";
import { buildTypeMatrix, typeMultiplier } from "../typeChart";
import { CandidateBuilder } from "./candidate";
import { resolveConfig } from "./config";
import { ClassicRecommender, hasFormChange } from "./recommend";
import { findings } from "./check";

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
  const summary = buildSummary(decryptSave(fs.readFileSync(savePath!, "utf8")), dex);
  const rec = new ClassicRecommender(dex, summary.starters);
  const results = rec.recommend({ onlyUncleared: true });

  it("파티를 여러 개 돌려준다", () => {
    expect(results.length).toBeGreaterThanOrEqual(3);
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
    expect(slaking!.roles.sweeper.score).toBeLessThan(0.5);
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
    const sweeper = all.find((c) => c.primaryRole === "sweeper" && c.moveset.some((m) => m.why === "랭크업"));
    expect(sweeper?.moveset[0].why).toBe("랭크업");
    // 회복기가 있는 막이는 첫 칸이 회복기
    const tank = all.find((c) => c.primaryRole === "tank" && cfg.recoveryMoves.has(c.moveset[0]?.fid));
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
      .filter((c) => Math.max(c.roles.fast.score, c.roles.sweeper.score) < 0.5 && c.owned.cost <= 3)
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
