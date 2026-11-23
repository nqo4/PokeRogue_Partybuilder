// 포켓몬별 추천 성격: 종족값으로 주 공격(물리·특수)을 정하고, 안 쓰는 공격 능력치를 깎는 공격·스피드·내구 성격을 고른다.
// 추천 성격을 하나도 해금하지 않았으면, 해금한 성격 중 쓸 만한 차선책(없으면 무보정 하나)을 고른다.
import { NATURE_EFFECT, NATURE_NAMES } from "./rules";

/** species.stats 의 위치: [HP, 공격, 방어, 특공, 특방, 스피드] */
const ATK = 1, DEF = 2, SPA = 3, SPD = 4, SPE = 5;

/** 올리는 능력치·내리는 능력치로 성격 번호 */
const natureOf = (up: number, down: number) => NATURE_EFFECT.findIndex((e) => !!e && e[0] === up && e[1] === down);

export interface NatureAdvice {
  /** 추천 성격 (자주 쓰이는 성격) */
  best: number[];
  /** 추천 성격을 하나도 해금하지 않았을 때, 해금한 성격 중 차선책 (없으면 null) */
  fallback: number | null;
  /** 판단 근거 한 줄 */
  why: string;
}

/** 올리는 능력치별 쓰임새 캡션 */
const ROLE_CAPTION: Record<number, string> = {
  [ATK]: "딜러(스위퍼 등)로 사용할 경우",
  [SPA]: "딜러(스위퍼 등)로 사용할 경우",
  [SPE]: "선공형(빠른 딜러)으로 사용할 경우",
  [DEF]: "물리막이로 사용할 경우",
  [SPD]: "특수막이로 사용할 경우",
};

/** 성격의 쓰임새 캡션 (무보정이면 그 설명) */
export function natureCaption(n: number): string {
  const e = NATURE_EFFECT[n];
  return e ? ROLE_CAPTION[e[0]] : "능력치를 올리거나 내리지 않는 무보정 성격";
}

export function adviseNature(stats: readonly number[], unlocked: number[]): NatureAdvice {
  const [, atk, def, spa, spd, spe] = stats;
  const main = atk >= spa ? ATK : SPA;
  const dump = main === ATK ? SPA : ATK;
  const off = Math.max(atk, spa);
  const bulkMain = def >= spd ? DEF : SPD;
  const bulkOther = bulkMain === DEF ? SPD : DEF;
  const bulk = stats[bulkMain];
  // 방어·특방이 높아도 껍질깨기 등으로 딜러로 쓰는 경우가 많으니 공격 성격은 늘 추천하고,
  // 내구가 공격만큼(90% 이상) 높거나 100 이상이면 내구 성격도 함께 추천한다
  const fast = spe >= 70;
  const tanky = bulk >= off * 0.9 || bulk >= 100;
  const bothBulk = tanky && stats[bulkOther] >= bulk - 20;

  // 능력치별 중요도. 성격 점수 = 올리는 능력치 중요도 − 내리는 능력치 중요도
  const w: Record<number, number> = { [ATK]: 1, [DEF]: 1, [SPA]: 1, [SPD]: 1, [SPE]: 1 };
  w[main] = 3;
  w[SPE] = spe >= 90 ? 3 : fast ? 2 : 1;
  if (tanky) {
    w[bulkMain] = 2.5;
    w[bulkOther] = bothBulk ? 2.5 : 1.5;
  }
  w[dump] = 0;

  const best = [
    natureOf(main, dump),
    ...(fast ? [natureOf(SPE, dump)] : []),
    ...(tanky ? [natureOf(bulkMain, dump)] : []),
    ...(bothBulk ? [natureOf(bulkOther, dump)] : []),
  ];
  const why = [
    `${main === ATK ? "물리" : "특수"} 공격`,
    ...(fast ? [`스피드 ${spe}`] : []),
    ...(tanky ? [`${bothBulk ? "방어·특방" : bulkMain === DEF ? "방어" : "특방"} 내구`] : []),
  ].join(" · ");

  const has = new Set(unlocked);
  let fallback: number | null = null;
  if (!best.some((n) => has.has(n))) {
    const score = (n: number) => {
      const e = NATURE_EFFECT[n];
      return e ? w[e[0]] - w[e[1]] : 0;
    };
    // 점수가 양수인 것 중 가장 높은 것, 없으면 무보정 하나
    const ranked = unlocked.filter((n) => score(n) > 0).sort((a, b) => score(b) - score(a) || a - b);
    fallback = ranked[0] ?? unlocked.find((n) => NATURE_EFFECT[n] === null) ?? null;
  }
  return { best, fallback, why };
}

export const natureName = (n: number) => NATURE_NAMES[n];
