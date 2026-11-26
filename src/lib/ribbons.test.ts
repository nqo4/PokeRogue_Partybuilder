import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { Dex, typesInGameOrder, type DexData } from "./dex";
import { RIBBONS, cleared, eligible, hasRibbon, parseRibbons, ribbonStates, type ClearCriterion } from "./ribbons";
import { decryptSave } from "./save";
import { buildSummary, type SaveSummary } from "./starters";
import { Official, type OfficialData } from "./official";
import { challengeWarning } from "./challengeForms";

const root = path.resolve(import.meta.dirname, "../..");
const dex = new Dex(JSON.parse(fs.readFileSync(path.join(root, "public/data/dex.json"), "utf8")) as DexData);

describe("리본 정의", () => {
  it("게임의 리본 39종, 비트가 겹치지 않는다", () => {
    expect(RIBBONS.length).toBe(39);
    expect(new Set(RIBBONS.map((r) => r.bit)).size).toBe(39);
    expect(new Set(RIBBONS.map((r) => r.key)).size).toBe(39);
  });

  it("16진수 문자열을 읽는다", () => {
    const r = parseRibbons("28000001"); // 클래식 + 친밀 맥스 + 단일 노말
    expect(hasRibbon(r, 27)).toBe(true);
    expect(hasRibbon(r, 29)).toBe(true);
    expect(hasRibbon(r, 0)).toBe(true);
    expect(hasRibbon(r, 1)).toBe(false);
    expect(parseRibbons(undefined)).toBe(0n);
    expect(parseRibbons("zz")).toBe(0n);
  });
});

describe("ribbonStates", () => {
  const keysOf = (id: number, ribbons?: bigint, wins?: number) =>
    ribbonStates(dex.family(dex.starter(id)!.family), dex, ribbons, wins).map((r) => (r.earned ? `${r.def.key}*` : r.def.key));

  it("every ribbon has an icon file", () => {
    for (const r of RIBBONS) expect(fs.existsSync(path.join(root, "public/images/ribbons", `${r.icon}.png`)), r.icon).toBe(true);
  });

  it("mono gen / type ribbons follow the family's forms (Charmander: Mega X is Dragon)", () => {
    const keys = keysOf(4);
    expect(keys).toEqual(expect.arrayContaining(["classic", "monoGen1", "monoFire", "monoFlying", "monoDragon"]));
    expect(keys).not.toContain("monoWater");
    expect(keys).not.toContain("monoGen2");
  });

  it("marks earned ribbons, and counts pre-ribbon classic wins", () => {
    expect(keysOf(4, parseRibbons("200")).filter((k) => k.endsWith("*"))).toEqual(["monoFire*"]);
    expect(keysOf(4, 0n, 2)).toContain("classic*");
    // a ribbon in the save is listed even when the family rule would leave it out
    expect(keysOf(4, 1n << 10n)).toContain("monoWater*");
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
describe.skipIf(!savePath)("실제 세이브 리본", () => {
  let summary: SaveSummary;
  beforeAll(() => {
    summary = buildSummary(decryptSave(fs.readFileSync(savePath!, "utf8")), dex);
  });

  it("리본으로 클리어한 스타터는 그 챌린지에 도전할 수 있는 스타터다 (세대·타입 판정이 게임과 맞다)", () => {
    const criteria: ClearCriterion[] = [
      ...Array.from({ length: 9 }, (_, i) => ({ mode: "gen" as const, gen: i + 1 })),
      ...typesInGameOrder(dex).map((type) => ({ mode: "type" as const, type })),
    ];
    for (const c of criteria) {
      for (const s of summary.starters) {
        if (cleared(s, c, dex)) expect(eligible(s, c), `${s.name} ${JSON.stringify(c)}`).toBe(true);
      }
    }
  });

  it("챌린지에서 못 쓰는 형태 경고 (진화 단계·리전폼 진화·폼 변화)", () => {
    const official = new Official(JSON.parse(fs.readFileSync(path.join(root, "public/data/official.json"), "utf8")) as OfficialData);
    const get = (id: number) => summary.starters.find((s) => s.speciesId === id)!;
    const fire: ClearCriterion = { mode: "type", type: dex.fid("type", "불꽃") };
    const w = (id: number, c: ClearCriterion) => challengeWarning(get(id), c, dex, official);
    expect(w(4, fire)).toBeNull(); // 파이리 계열은 전부 불꽃
    expect(w(4, { mode: "classic" })).toBeNull();
    expect(w(133, fire)).toBe("주의: 해당 챌린지에서는 부스터 폼만 사용 가능합니다!");
    // 브케인: 블레이범(2세대)과 히스이 블레이범(8세대)
    expect(w(155, { mode: "gen", gen: 8 })).toBe("주의: 해당 챌린지에서는 히스이 블레이범 폼만 사용 가능합니다!");
    expect(w(155, { mode: "gen", gen: 2 })).toContain("블레이범 폼만");
    expect(w(155, { mode: "gen", gen: 2 })).not.toContain("히스이");
    // 피츄의 1세대: 피카츄·라이츄(메가·거다이 포함)만, 피카츄 코스튬 같은 다른 스타터의 형태는 넣지 않는다
    const pichu = w(172, { mode: "gen", gen: 1 })!;
    expect(pichu).toContain("피카츄 폼");
    expect(pichu).toContain("라이츄 폼");
    expect(pichu).not.toContain("파트너");
    expect(pichu).not.toContain("알로라");
  });

  it("클래식 리본이 있으면 클래식 클리어 횟수도 있다", () => {
    for (const s of summary.starters) if (hasRibbon(s.ribbons, 27)) expect(s.classicWins, s.name).toBeGreaterThan(0);
  });
});
