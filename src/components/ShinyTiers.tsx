// 이로치 단계(1·2·3럭) 보유 표시. 게임 아이콘처럼 픽셀 반짝이로 그린다.
// 잡은 단계는 색이 찬 반짝이, 아직인 단계는 속이 빈 테두리. 1럭만 있는 포켓몬은 1럭 하나만 보여 준다.

const TIER_LABEL = ["1럭", "2럭", "3럭"] as const;

/** 16×16 칸 [x, y, 너비, 높이]. 16px 로 그리면 칸 하나가 화면 1픽셀이라 뭉개지지 않는다 */
type Rect = [number, number, number, number];

const ICONS: Rect[][] = [
  // 1럭: 큰 반짝이 하나 (가운데 x7, y7)
  [
    [7, 0, 1, 15],
    [0, 7, 15, 1],
    [6, 4, 3, 1],
    [5, 5, 5, 1],
    [4, 6, 7, 1],
    [4, 8, 7, 1],
    [5, 9, 5, 1],
    [6, 10, 3, 1],
  ],
  // 2럭: 왼쪽 아래 큰 반짝이 + 오른쪽 위 작은 반짝이
  [
    [5, 5, 1, 11],
    [0, 10, 11, 1],
    [4, 8, 3, 1],
    [3, 9, 5, 1],
    [3, 11, 5, 1],
    [4, 12, 3, 1],
    [12, 0, 1, 9],
    [8, 4, 8, 1],
    [11, 3, 3, 3],
  ],
  // 3럭: 큰 반짝이(가운데 왼쪽) + 오른쪽 위 + 아래 작은 반짝이
  [
    [5, 3, 1, 13],
    [4, 7, 3, 1],
    [3, 8, 5, 1],
    [0, 9, 12, 1],
    [3, 10, 5, 1],
    [4, 11, 3, 1],
    [12, 0, 1, 8],
    [11, 3, 3, 3],
    [8, 4, 8, 1],
    [11, 11, 1, 3],
    [9, 12, 5, 1],
  ],
];

/**
 * 채운 모양에서 바깥쪽 칸만 남겨 속이 빈 테두리를 만든다.
 * 대각선까지 8방향이 모두 채워진 칸만 비운다 (상하좌우만 보면 작은 십자의 가운데가 빠져 끊겨 보인다)
 */
function outline(rects: Rect[]): Rect[] {
  const filled = new Set<string>();
  for (const [x, y, w, h] of rects) for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) filled.add(`${x + i},${y + j}`);
  const out: Rect[] = [];
  for (const k of filled) {
    const [x, y] = k.split(",").map(Number);
    const edge = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]].some(
      ([dx, dy]) => !filled.has(`${x + dx},${y + dy}`),
    );
    if (edge) out.push([x, y, 1, 1]);
  }
  return out;
}
const OUTLINES = ICONS.map(outline);

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
  /** 16 의 배수일 때 가장 또렷하다 */
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
      {tiers.map((t) => {
        const has = !!(mask & (1 << t));
        return (
          <svg
            key={t}
            className={`sparkle tier-${t + 1}${has ? " owned" : ""}`}
            viewBox="0 0 16 16"
            width={size}
            height={size}
            shapeRendering="crispEdges"
            aria-hidden="true"
          >
            {(has ? ICONS[t] : OUTLINES[t]).map(([x, y, w, h], i) => (
              <rect key={i} x={x} y={y} width={w} height={h} />
            ))}
          </svg>
        );
      })}
    </span>
  );
}
