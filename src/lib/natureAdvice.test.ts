import { describe, expect, it } from "vitest";
import { adviseNature, natureCaption } from "./natureAdvice";
import { NATURE_NAMES } from "./rules";

const idx = (name: string) => NATURE_NAMES.indexOf(name as (typeof NATURE_NAMES)[number]);
const names = (ns: number[]) => ns.map((n) => NATURE_NAMES[n]);
const ALL = NATURE_NAMES.map((_, i) => i);
const best = (stats: number[]) => names(adviseNature(stats, ALL).best);

describe("추천 성격", () => {
  it("빠른 물리 공격형: 고집·명랑", () => {
    expect(best([65, 90, 40, 45, 80, 75])).toEqual(["고집", "명랑"]); // 독침붕
  });
  it("빠른 특수 공격형: 조심·겁쟁이", () => {
    expect(best([55, 50, 45, 135, 95, 120])).toEqual(["조심", "겁쟁이"]); // 후딘
  });
  it("내구가 높아도 공격 성격을 함께 추천한다 (거북왕: 껍질깨기 딜러)", () => {
    // 거북왕 79/83/100/85/105/78 → 조심·겁쟁이 + 차분(특방이 더 높음)·대담
    expect(best([79, 83, 100, 85, 105, 78])).toEqual(["조심", "겁쟁이", "차분", "대담"]);
    // 해피너스 255/10/10/75/135/55 → 조심(특공) + 차분(특방)
    expect(best([255, 10, 10, 75, 135, 55])).toEqual(["조심", "차분"]);
    // 잠만보 160/110/65/65/110/30 → 고집 + 신중
    expect(best([160, 110, 65, 65, 110, 30])).toEqual(["고집", "신중"]);
  });
  it("추천 성격을 하나라도 가지면 차선책은 없다", () => {
    expect(adviseNature([65, 90, 40, 45, 80, 75], [idx("고집"), idx("노력")]).fallback).toBeNull();
  });
  it("추천 성격이 없으면 가진 것 중 차선책, 그것도 없으면 무보정", () => {
    const stats = [65, 90, 40, 45, 80, 75];
    // 외로움(공격↑ 방어↓) 3 − 1 = 2 > 용감(공격↑ 스피드↓) 3 − 2 = 1
    expect(NATURE_NAMES[adviseNature(stats, [idx("용감"), idx("외로움"), idx("노력")]).fallback!]).toBe("외로움");
    expect(NATURE_NAMES[adviseNature(stats, [idx("조심"), idx("수줍음"), idx("겁쟁이")]).fallback!]).toBe("수줍음");
  });
  it("성격별 쓰임새 캡션", () => {
    expect(natureCaption(idx("고집"))).toBe("딜러(스위퍼 등)로 사용할 경우");
    expect(natureCaption(idx("조심"))).toBe("딜러(스위퍼 등)로 사용할 경우");
    expect(natureCaption(idx("겁쟁이"))).toBe("선공형(빠른 딜러)으로 사용할 경우");
    expect(natureCaption(idx("대담"))).toBe("물리막이로 사용할 경우");
    expect(natureCaption(idx("차분"))).toBe("특수막이로 사용할 경우");
    expect(natureCaption(idx("노력"))).toContain("무보정");
  });
});
