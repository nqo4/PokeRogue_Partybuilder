// 실제 세이브로 파서를 검증한다.
// 세이브는 커밋하지 않는다: testdata/ 에 .prsv 를 두거나 SAVE_PATH 환경변수로 경로를 준다.
// 세이브가 없으면 이 테스트는 건너뛴다.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Dex, type DexData } from "./dex";
import { decryptSave } from "./save";
import { buildSummary } from "./starters";

const root = path.resolve(import.meta.dirname, "../..");
const dex = new Dex(JSON.parse(fs.readFileSync(path.join(root, "public/data/dex.json"), "utf8")) as DexData);

function findSave(): string | undefined {
  if (process.env.SAVE_PATH) return process.env.SAVE_PATH;
  const dir = path.join(root, "testdata");
  if (!fs.existsSync(dir)) return undefined;
  const f = fs.readdirSync(dir).find((n) => n.endsWith(".prsv"));
  return f && path.join(dir, f);
}

describe("Dex 데이터", () => {
  it("진화·메가로 바뀌는 타입을 계열 단위로 찾는다", () => {
    const fam = (name: string) => {
      const s = dex.species.find((x) => x.name === name)!;
      return Object.fromEntries(dex.family(s.family).map((f) => [f.name, dex.typeNames(f).join("/")]));
    };
    expect(fam("파이리")["리자몽"]).toBe("불꽃/비행");
    expect(fam("루리리")["마릴"]).toBe("물/페어리");
    expect(fam("꼬시레")["메가 갑주무사"]).toBe("벌레/강철");
    expect(fam("가보리")["메가 보스로라"]).toBe("강철");
  });
});

const savePath = findSave();
describe.skipIf(!savePath)("실제 세이브", () => {
  const save = decryptSave(fs.readFileSync(savePath!, "utf8"));
  const summary = buildSummary(save, dex);
  const get = (id: number) => summary.starters.find((s) => s.speciesId === id)!;

  it("모든 스타터가 Dex 와 매칭된다", () => {
    expect(summary.unmatched).toEqual([]);
    expect(summary.starters.length).toBe(Object.keys(save.starterData).length);
  });

  it("가이오가: 코스트 9→7, 패시브 켜짐, 알기술 4/4, 럭 2", () => {
    const k = get(382);
    expect(k.name).toBe("가이오가");
    expect(k.baseCost).toBe(9);
    expect(k.cost).toBe(7);
    expect(k.passive).toMatchObject({ name: "틀깨기", unlocked: true, enabled: true });
    expect(k.eggMovesUnlocked).toBe(4);
    expect(k.luck).toBe(2);
  });

  it("PDF 가이드의 미해금 상태와 일치한다", () => {
    expect(get(481).passive.unlocked).toBe(false); // 위유이
    expect(get(483).passive.unlocked).toBe(false); // 디아루가
    expect(get(483).eggMovesUnlocked).toBe(1);
    const reshiram = get(643);
    expect(reshiram.eggMovesUnlocked).toBe(3);
    expect(reshiram.eggMoves[3]).toMatchObject({ rare: true, unlocked: false });
    expect(get(235).luck).toBe(0); // 루브도
  });

  it("1코스트 감소는 절반 규칙을 따른다 (꼬리선 1 → 0.25)", () => {
    const sentret = get(161);
    expect(sentret.baseCost).toBe(1);
    expect(sentret.costReductions).toBe(2);
    expect(sentret.cost).toBe(0.25);
  });

  it("큰 caughtAttr(안농)도 BigInt 로 읽는다", () => {
    expect(get(201)).toBeDefined();
  });
});
