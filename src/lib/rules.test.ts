import { describe, expect, it } from "vitest";
import { NATURE_EFFECT, bestShinyTier, shinyTiersOf, starterCost, unlockedNatures } from "./rules";

describe("starterCost", () => {
  it("1보다 크면 감소 1회당 1씩 줄어든다", () => {
    expect(starterCost(9, 2)).toBe(7);
    expect(starterCost(3, 1)).toBe(2);
  });
  it("1 이하가 되면 절반씩 줄어든다", () => {
    expect(starterCost(1, 1)).toBe(0.5);
    expect(starterCost(1, 2)).toBe(0.25);
    expect(starterCost(2, 2)).toBe(0.5);
  });
  it("감소가 없으면 기본 코스트", () => {
    expect(starterCost(5, 0)).toBe(5);
  });
});

describe("bestShinyTier", () => {
  it("이로치가 없으면 0", () => expect(bestShinyTier(157n)).toBe(0));
  it("2티어", () => expect(bestShinyTier(439n)).toBe(2));
  it("3티어", () => expect(bestShinyTier(2n | 16n | 32n | 64n)).toBe(3));
  it("1티어", () => expect(bestShinyTier(2n | 16n)).toBe(1));
});

describe("natures", () => {
  it("성격 n 은 n+1 번째 비트", () => {
    expect(unlockedNatures((1 << 1) | (1 << 16))).toEqual([0, 15]);
  });
  it("조심(15)은 특공↑ 공격↓, 명랑(13)은 스피드↑ 특공↓", () => {
    expect(NATURE_EFFECT[15]).toEqual([3, 1]);
    expect(NATURE_EFFECT[13]).toEqual([5, 3]);
    expect(NATURE_EFFECT[0]).toBeNull();
  });
});

describe("shinyTiersOf", () => {
  // 비트: 1 NON_SHINY, 2 SHINY, 16 1럭, 32 2럭, 64 3럭
  it("이로치가 없으면 0", () => expect(shinyTiersOf(1n | 16n)).toBe(0));
  it("1럭만", () => expect(shinyTiersOf(2n | 16n)).toBe(1));
  it("3럭을 잡으면 1럭도 등록되지만 2럭은 아니다", () => expect(shinyTiersOf(2n | 64n)).toBe(1 | 4));
  it("2럭은 따로 잡아야 한다", () => expect(shinyTiersOf(2n | 32n)).toBe(2));
  it("모두", () => expect(shinyTiersOf(2n | 16n | 32n | 64n)).toBe(7));
});
