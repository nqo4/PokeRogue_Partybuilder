import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Dex, type DexData } from "./dex";
import { Official, type OfficialData } from "./official";
import { bestRoute, evaluateBiome } from "./route";

const root = path.resolve(import.meta.dirname, "../..");
const file = path.join(root, "public/data/official.json");
const dex = new Dex(JSON.parse(fs.readFileSync(path.join(root, "public/data/dex.json"), "utf8")) as DexData);

describe.skipIf(!fs.existsSync(file))("공식 게임 데이터", () => {
  const official = new Official(JSON.parse(fs.readFileSync(file, "utf8")) as OfficialData);

  it("진화 조건이 한국어로 들어 있다 (파이리 → 리자드 레벨 16, 이브이 → 샤미드 물의돌)", () => {
    expect(official.evolutionsTo(5).find((e) => e.from === 4)?.text).toEqual(["레벨 16"]);
    expect(official.evolutionsTo(134)[0].text.join()).toContain("물의돌");
  });

  it("모든 바이옴 연결과 출현 포켓몬이 도감과 맞는다", () => {
    for (const b of official.data.biomes) {
      for (const l of b.links) expect(official.biomeById.has(l.to)).toBe(true);
      for (const p of b.pokemon) for (const s of p.species) expect(dex.byId(s.id), `${b.name} ${s.id}`).toBeDefined();
    }
  });

  it("사천왕·챔피언 후보가 있다", () => {
    const champ = official.data.fixedWaves.find((w) => w.key === "CHAMPION")!;
    expect(champ.wave).toBe(190);
    expect(champ.trainers.flat()).toContain("LANCE_CHAMPION");
    expect(official.trainerName("LANCE_CHAMPION")).toBe("목호");
  });

  it("경로 추천: 마을에서 출발해 연결된 바이옴으로만 이동한다", () => {
    const town = official.data.biomes.find((b) => b.key === "TOWN")!;
    const route = bestRoute(town.id, 5, dex, official, undefined, null);
    expect(route.length).toBe(5);
    let at = town;
    for (const step of route) {
      expect(at.links.some((l) => l.to === step.eval.biome.id)).toBe(true);
      at = step.eval.biome;
    }
    expect(evaluateBiome(town, dex, official, undefined, null).newChance).toBe(0);
  });
});
