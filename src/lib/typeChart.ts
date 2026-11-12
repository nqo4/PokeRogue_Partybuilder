// 타입 상성표 (9세대 기준). 타입은 Dex 의 한국어 이름으로 적고, 실행할 때 fid 로 바꾼다.
import type { Dex } from "./dex";

/** 공격 타입 → { 방어 타입: 배율 } (1배는 생략) */
const CHART: Record<string, Record<string, number>> = {
  노말: { 바위: 0.5, 강철: 0.5, 고스트: 0 },
  불꽃: { 불꽃: 0.5, 물: 0.5, 풀: 2, 얼음: 2, 벌레: 2, 바위: 0.5, 드래곤: 0.5, 강철: 2 },
  물: { 불꽃: 2, 물: 0.5, 풀: 0.5, 땅: 2, 바위: 2, 드래곤: 0.5 },
  전기: { 물: 2, 전기: 0.5, 풀: 0.5, 땅: 0, 비행: 2, 드래곤: 0.5 },
  풀: { 불꽃: 0.5, 물: 2, 풀: 0.5, 독: 0.5, 땅: 2, 비행: 0.5, 벌레: 0.5, 바위: 2, 드래곤: 0.5, 강철: 0.5 },
  얼음: { 불꽃: 0.5, 물: 0.5, 풀: 2, 얼음: 0.5, 땅: 2, 비행: 2, 드래곤: 2, 강철: 0.5 },
  격투: { 노말: 2, 얼음: 2, 독: 0.5, 비행: 0.5, 에스퍼: 0.5, 벌레: 0.5, 바위: 2, 고스트: 0, 악: 2, 강철: 2, 페어리: 0.5 },
  독: { 풀: 2, 독: 0.5, 땅: 0.5, 바위: 0.5, 고스트: 0.5, 강철: 0, 페어리: 2 },
  땅: { 불꽃: 2, 전기: 2, 풀: 0.5, 독: 2, 비행: 0, 벌레: 0.5, 바위: 2, 강철: 2 },
  비행: { 전기: 0.5, 풀: 2, 격투: 2, 벌레: 2, 바위: 0.5, 강철: 0.5 },
  에스퍼: { 격투: 2, 독: 2, 에스퍼: 0.5, 악: 0, 강철: 0.5 },
  벌레: { 불꽃: 0.5, 풀: 2, 격투: 0.5, 독: 0.5, 비행: 0.5, 에스퍼: 2, 고스트: 0.5, 악: 2, 강철: 0.5, 페어리: 0.5 },
  바위: { 불꽃: 2, 얼음: 2, 격투: 0.5, 땅: 0.5, 비행: 2, 벌레: 2, 강철: 0.5 },
  고스트: { 노말: 0, 에스퍼: 2, 고스트: 2, 악: 0.5 },
  드래곤: { 드래곤: 2, 강철: 0.5, 페어리: 0 },
  악: { 격투: 0.5, 에스퍼: 2, 고스트: 2, 악: 0.5, 페어리: 0.5 },
  강철: { 불꽃: 0.5, 물: 0.5, 전기: 0.5, 얼음: 2, 바위: 2, 강철: 0.5, 페어리: 2 },
  페어리: { 불꽃: 0.5, 격투: 2, 독: 0.5, 드래곤: 2, 악: 2, 강철: 0.5 },
};

export type TypeMatrix = number[][];

/** [공격 타입 fid][방어 타입 fid] = 배율 */
export function buildTypeMatrix(dex: Dex): TypeMatrix {
  const n = dex.data.ranges.type[1];
  const m: TypeMatrix = Array.from({ length: n }, () => Array(n).fill(1));
  for (const [atk, row] of Object.entries(CHART)) {
    const a = dex.fid("type", atk);
    if (a < 0) throw new Error(`타입 이름을 찾지 못함: ${atk}`);
    for (const [def, mult] of Object.entries(row)) {
      const d = dex.fid("type", def);
      if (d < 0) throw new Error(`타입 이름을 찾지 못함: ${def}`);
      m[a][d] = mult;
    }
  }
  return m;
}

export function typeMultiplier(m: TypeMatrix, attack: number, defense: number[]): number {
  return defense.reduce((acc, d) => acc * m[attack][d], 1);
}
