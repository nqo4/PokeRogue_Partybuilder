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

  it("지정한 포켓몬을 반드시 포함한다", () => {
    const [r] = rec.recommend({ onlyUncleared: true, required: [287], count: 1 });
    expect(r.analysis.members.some((m) => m.owned.speciesId === 287)).toBe(true);
  });
});
