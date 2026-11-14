import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { legendaryPickup, pokerusStarters, utcDay } from "./pokerus";

const official = JSON.parse(
  fs.readFileSync(path.resolve(import.meta.dirname, "../../public/data/official.json"), "utf8"),
) as {
  starterIds: number[];
  pokerusSamples: { date: string; ids: number[] }[];
  legendaryGachaIds: number[];
  legendarySamples: { date: string; id: number }[];
};

describe("포켓러스", () => {
  it("게임 코드로 뽑은 날짜별 결과와 같다", () => {
    expect(official.pokerusSamples.length).toBeGreaterThan(0);
    for (const s of official.pokerusSamples) {
      // 그날 아무 시각이어도 UTC 날짜가 같으면 결과가 같다
      expect(pokerusStarters(new Date(`${s.date}T23:30:00Z`), official.starterIds)).toEqual(s.ids);
    }
  });
  it("UTC 자정 기준으로 날이 바뀐다", () => {
    expect(utcDay(new Date("2026-11-15T23:59:59Z"))).toBe(Date.UTC(2026, 10, 15));
    expect(utcDay(new Date("2026-11-16T00:00:00Z"))).toBe(Date.UTC(2026, 10, 16));
  });
});

describe("알 뽑기 전설 픽업", () => {
  it("게임 코드로 뽑은 날짜별 결과와 같다", () => {
    expect(official.legendarySamples.length).toBeGreaterThan(0);
    for (const s of official.legendarySamples) {
      expect(legendaryPickup(new Date(`${s.date}T00:00:00Z`), official.legendaryGachaIds)).toBe(s.id);
      expect(legendaryPickup(new Date(`${s.date}T23:59:00Z`), official.legendaryGachaIds)).toBe(s.id);
    }
  });
});
