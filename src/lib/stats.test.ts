import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Dex, type DexData } from "./dex";
import { decryptSave } from "./save";
import { buildSummary } from "./starters";
import { computeStats, formatPlayTime } from "./stats";

describe("formatPlayTime", () => {
  it("시간·분으로 바꾼다", () => {
    expect(formatPlayTime(1353711)).toBe("376시간 1분");
    expect(formatPlayTime(59 * 60)).toBe("59분");
  });
});

const root = path.resolve(import.meta.dirname, "../..");
const dir = path.join(root, "testdata");
const file = fs.existsSync(dir) ? fs.readdirSync(dir).find((n) => n.endsWith(".prsv")) : undefined;

describe.skipIf(!file)("실제 세이브 통계", () => {
  it("수집 현황이 범위 안에 있고 앞뒤가 맞는다", () => {
    const dex = new Dex(JSON.parse(fs.readFileSync(path.join(root, "public/data/dex.json"), "utf8")) as DexData);
    const summary = buildSummary(decryptSave(fs.readFileSync(path.join(dir, file!), "utf8")), dex);
    const s = computeStats(summary, dex);
    for (const x of [s.shiny.t1, s.shiny.t2, s.shiny.t3, s.shiny.complete, s.starters]) {
      expect(x.have).toBeGreaterThanOrEqual(0);
      expect(x.have).toBeLessThanOrEqual(x.total);
    }
    // 2·3럭이 있는 종은 전체 종보다 적다
    expect(s.shiny.t2.total).toBeLessThan(s.shiny.t1.total);
    // 세대별 합 = 전체
    expect(s.startersByGen.reduce((a, g) => a + g.total, 0)).toBe(s.starters.total);
    expect(s.startersByGen.reduce((a, g) => a + g.have, 0)).toBe(s.starters.have);
    expect(s.starters.have).toBe(summary.starters.length);
    expect(s.forms.caught + s.forms.seen + s.forms.unseen).toBe(s.forms.total);
    expect(s.playTimeSec).toBeGreaterThan(0);
  });
});
