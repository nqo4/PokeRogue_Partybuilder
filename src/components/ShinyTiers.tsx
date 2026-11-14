// 이로치 단계(1·2·3럭) 보유 표시. 잡은 단계는 색이 찬 반짝이, 아직인 단계는 빈 테두리.
// 1럭만 있는 포켓몬은 1럭 하나만 보여 준다.

const TIER_LABEL = ["1럭", "2럭", "3럭"] as const;

/** 네 갈래 반짝이 (직접 그린 아이콘) */
const SPARKLE = "M8 0.6 C8.7 5 11 7.3 15.4 8 C11 8.7 8.7 11 8 15.4 C7.3 11 5 8.7 0.6 8 C5 7.3 7.3 5 8 0.6 Z";

/** 단계별 반짝이 배치 [x, y, 크기 배율]: 1럭 1개, 2럭 2개(큰 것 왼쪽 아래·작은 것 오른쪽 위), 3럭 3개 */
const LAYOUT: [number, number, number][][] = [
  [[0, 0, 1]],
  [
    [0, 4, 0.75],
    [8.5, 0, 0.47],
  ],
  [
    [3.2, 3.2, 0.6],
    [0, 0, 0.42],
    [9.3, 9.3, 0.42],
  ],
];

export function ShinyTiers({
  mask,
  variants,
  size = 14,
  hideEmpty = false,
}: {
  /** 보유 단계 비트 (1럭 1, 2럭 2, 3럭 4) */
  mask: number;
  /** 이 형태에 있는 단계 수 (1 또는 3) */
  variants: 1 | 3;
  size?: number;
  /** 하나도 없으면 아무것도 그리지 않는다 */
  hideEmpty?: boolean;
}) {
  if (hideEmpty && !mask) return null;
  const tiers = variants === 3 ? [0, 1, 2] : [0];
  const owned = tiers.filter((t) => mask & (1 << t));
  const label =
    variants === 1
      ? `이로치(1럭만 있음): ${owned.length ? "보유" : "미보유"}`
      : `이로치 ${tiers.map((t) => `${TIER_LABEL[t]} ${mask & (1 << t) ? "보유" : "미보유"}`).join(", ")}`;
  return (
    <span className="shiny-tiers" role="img" aria-label={label} title={label}>
      {tiers.map((t) => (
        <svg
          key={t}
          className={`sparkle tier-${t + 1}${mask & (1 << t) ? " owned" : ""}`}
          viewBox="0 0 16 16"
          width={size}
          height={size}
          aria-hidden="true"
        >
          {LAYOUT[t].map(([x, y, s], i) => (
            <path key={i} d={SPARKLE} transform={`translate(${x} ${y}) scale(${s})`} />
          ))}
        </svg>
      ))}
    </span>
  );
}
