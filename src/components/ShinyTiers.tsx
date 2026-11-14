// 이로치 단계(1·2·3럭) 보유 표시. 잡은 단계는 색이 찬 반짝이, 아직인 단계는 빈 테두리.
// 1럭만 있는 포켓몬은 1럭 하나만 보여 준다.

const TIER_LABEL = ["1럭", "2럭", "3럭"] as const;

/** 네 갈래 반짝이 (직접 그린 아이콘) */
const SPARKLE = "M8 0.6 C8.7 5 11 7.3 15.4 8 C11 8.7 8.7 11 8 15.4 C7.3 11 5 8.7 0.6 8 C5 7.3 7.3 5 8 0.6 Z";

/** 단계별 반짝이 배치 [x, y, 크기 배율]: 1럭 1개, 2럭 2개(큰 것 왼쪽 아래·작은 것 오른쪽 위) */
const LAYOUT: [number, number, number][][] = [
  [[0, 0, 1]],
  [
    [0, 4, 0.75],
    [8.5, 0, 0.47],
  ],
  [], // 3럭은 TIER3_PIXELS 로 그린다
];

/**
 * 3럭 아이콘: 게임 아이콘과 같은 배치의 픽셀 반짝이 3개 [x, y, 너비, 높이].
 * 왼쪽 가운데 큰 십자(계단 마름모), 오른쪽 위 중간 십자, 아래 작은 십자. 31×31 칸 기준
 */
const TIER3_PIXELS: [number, number, number, number][] = [
  // 큰 반짝이
  [10, 5, 2, 25],
  [7, 12, 7, 2],
  [5, 14, 11, 2],
  [0, 16, 23, 3],
  [5, 19, 11, 2],
  [7, 21, 7, 2],
  // 오른쪽 위 반짝이
  [23, 1, 2, 15],
  [21, 5, 6, 3],
  [16, 8, 15, 2],
  [21, 10, 6, 2],
  // 아래 작은 반짝이
  [21, 21, 2, 6],
  [18, 23, 7, 2],
];

/**
 * 작게(16px) 그릴 때 쓰는 같은 배치의 16×16 칸 버전. 칸 하나가 화면 1픽셀이라 뭉개지지 않는다.
 * (31칸 버전을 14~16px 로 줄이면 칸이 1픽셀보다 작아져 줄이 빠진다)
 */
const TIER3_PIXELS_SMALL: [number, number, number, number][] = [
  // 큰 반짝이 (가운데 x5, y9)
  [5, 3, 1, 13],
  [4, 7, 3, 1],
  [3, 8, 5, 1],
  [0, 9, 12, 1],
  [3, 10, 5, 1],
  [4, 11, 3, 1],
  // 오른쪽 위 반짝이 (가운데 x12, y4)
  [12, 0, 1, 8],
  [11, 3, 3, 3],
  [8, 4, 8, 1],
  // 아래 작은 반짝이 (가운데 x11, y12)
  [11, 11, 1, 3],
  [9, 12, 5, 1],
];

export function ShinyTiers({
  mask,
  variants,
  size = 16,
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
      {tiers.map((t) =>
        t === 2 ? (
          <svg
            key={t}
            className={`sparkle pixel tier-3${mask & 4 ? " owned" : ""}`}
            viewBox={size >= 28 ? "0 0 31 31" : "0 0 16 16"}
            width={size}
            height={size}
            shapeRendering="crispEdges"
            aria-hidden="true"
          >
            {(size >= 28 ? TIER3_PIXELS : TIER3_PIXELS_SMALL).map(([x, y, w, h], i) => (
              <rect key={i} x={x} y={y} width={w} height={h} />
            ))}
          </svg>
        ) : (
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
        ),
      )}
    </span>
  );
}
