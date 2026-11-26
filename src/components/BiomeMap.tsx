// 바이옴 지도: 공식 데이터의 연결(links)로 화살표를 그린다. 칸을 누르면 그 바이옴을 고른다.
// 선은 칸을 가로지르지 않도록 꺾인 길(ROUTES)로 그린다. 길이 정해지지 않은 연결은 곧은 선으로 그린다.
import type { Official } from "../lib/official";

const biomeImage = (key: string) => `${import.meta.env.BASE_URL}images/biomes/${key.toLowerCase()}.png`;

/** 칸 가운데 좌표. 커뮤니티 지도와 같은 배치 */
const POS: Record<string, [number, number]> = {
  DOJO: [255, 71], JUNGLE: [562, 71], TEMPLE: [715, 71],
  CONSTRUCTION_SITE: [408, 180], DESERT: [715, 180], RUINS: [868, 180], SPACE: [1022, 180],
  POWER_PLANT: [255, 289], LABORATORY: [408, 289], FAIRY_CAVE: [1329, 289], ICE_CAVE: [1483, 289],
  SLUM: [101, 397], FACTORY: [408, 397], FOREST: [562, 397], MEADOW: [868, 397], SNOWY_FOREST: [1329, 397],
  MOUNTAIN: [1688, 397],
  METROPOLIS: [101, 506], PLAINS: [255, 506], LAKE: [1176, 506], BEACH: [1329, 506], VOLCANO: [1585, 506],
  SWAMP: [868, 557],
  TOWN: [101, 615], GRASS: [255, 615], TALL_GRASS: [562, 615], CAVE: [1176, 615], ISLAND: [1329, 615], SEA: [1483, 615],
  GRAVEYARD: [868, 723], ABYSS: [1022, 723], SEABED: [1329, 723],
  WASTELAND: [1483, 780],
  BADLANDS: [1176, 832],
};
const W = 104;
const H = 58;

type Pt = [number, number];
/** "출발>도착" → 꺾이는 점 목록 (첫 점은 출발 칸 테두리, 끝 점은 도착 칸 테두리) */
const ROUTES: Record<string, Pt[]> = {
  "TOWN>PLAINS": [[141, 586], [215, 535]],
  "PLAINS>GRASS": [[255, 535], [255, 586]],
  "PLAINS>METROPOLIS": [[203, 506], [153, 506]],
  "PLAINS>LAKE": [[307, 506], [1124, 506]],
  "GRASS>TALL_GRASS": [[307, 615], [510, 615]],
  "TALL_GRASS>FOREST": [[562, 586], [562, 426]],
  "TALL_GRASS>CAVE": [[614, 615], [1124, 615]],
  "METROPOLIS>SLUM": [[101, 477], [101, 426]],
  "SLUM>CONSTRUCTION_SITE": [[101, 368], [101, 180], [356, 180]],
  "SLUM>SWAMP": [[153, 397], [331, 397], [331, 557], [816, 557]],
  "FOREST>JUNGLE": [[562, 368], [562, 100]],
  "FOREST>MEADOW": [[614, 397], [816, 397]],
  "MEADOW>PLAINS": [[868, 426], [868, 492], [307, 492]],
  "MEADOW>FAIRY_CAVE": [[920, 397], [1099, 397], [1099, 289], [1277, 289]],
  "SEA>SEABED": [[1452, 644], [1381, 694]],
  "SEA>ICE_CAVE": [[1483, 586], [1483, 318]],
  "SWAMP>GRAVEYARD": [[868, 586], [868, 694]],
  "SWAMP>TALL_GRASS": [[816, 572], [767, 572], [767, 600], [614, 600]],
  "BEACH>SEA": [[1371, 535], [1440, 586]],
  "BEACH>ISLAND": [[1329, 535], [1329, 586]],
  "LAKE>BEACH": [[1228, 506], [1277, 506]],
  "LAKE>SWAMP": [[1124, 520], [1010, 520], [1010, 557], [920, 557]],
  "LAKE>CONSTRUCTION_SITE": [[1176, 477], [1176, 235], [433, 235], [433, 209]],
  "SEABED>CAVE": [[1290, 694], [1215, 644]],
  "SEABED>VOLCANO": [[1381, 723], [1585, 723], [1585, 535]],
  "MOUNTAIN>VOLCANO": [[1663, 426], [1663, 506], [1637, 506]],
  "MOUNTAIN>WASTELAND": [[1688, 426], [1688, 780], [1535, 780]],
  "MOUNTAIN>SPACE": [[1663, 368], [1663, 127], [1022, 127], [1022, 151]],
  "BADLANDS>DESERT": [[1124, 832], [715, 832], [715, 209]],
  "BADLANDS>MOUNTAIN": [[1228, 845], [1712, 845], [1712, 426]],
  "CAVE>BADLANDS": [[1176, 644], [1176, 803]],
  "CAVE>LAKE": [[1176, 586], [1176, 535]],
  "CAVE>LABORATORY": [[1124, 600], [1060, 600], [1060, 289], [460, 289]],
  "DESERT>RUINS": [[767, 180], [816, 180]],
  "DESERT>CONSTRUCTION_SITE": [[663, 180], [460, 180]],
  "ICE_CAVE>SNOWY_FOREST": [[1452, 318], [1371, 368]],
  "POWER_PLANT>FACTORY": [[290, 318], [370, 368]],
  "VOLCANO>BEACH": [[1533, 506], [1381, 506]],
  "VOLCANO>ICE_CAVE": [[1585, 477], [1585, 289], [1535, 289]],
  "GRAVEYARD>ABYSS": [[920, 723], [970, 723]],
  "DOJO>PLAINS": [[215, 100], [180, 140], [180, 460], [215, 477]],
  "DOJO>JUNGLE": [[307, 71], [510, 71]],
  "DOJO>TEMPLE": [[280, 42], [280, 18], [690, 18], [690, 42]],
  "FACTORY>PLAINS": [[370, 426], [290, 477]],
  "FACTORY>LABORATORY": [[408, 368], [408, 318]],
  "RUINS>MOUNTAIN": [[893, 151], [893, 100], [1712, 100], [1712, 368]],
  "RUINS>FOREST": [[868, 209], [868, 343], [587, 343], [587, 368]],
  "WASTELAND>BADLANDS": [[1483, 809], [1483, 832], [1228, 832]],
  "ABYSS>CAVE": [[1060, 694], [1140, 644]],
  "ABYSS>SPACE": [[1022, 694], [1022, 209]],
  "ABYSS>WASTELAND": [[1022, 752], [1022, 780], [1431, 780]],
  "SPACE>RUINS": [[970, 180], [920, 180]],
  "CONSTRUCTION_SITE>POWER_PLANT": [[370, 209], [290, 260]],
  "CONSTRUCTION_SITE>DOJO": [[370, 151], [290, 100]],
  "JUNGLE>TEMPLE": [[614, 71], [663, 71]],
  "FAIRY_CAVE>ICE_CAVE": [[1381, 289], [1431, 289]],
  "FAIRY_CAVE>SPACE": [[1329, 260], [1329, 180], [1074, 180]],
  "TEMPLE>DESERT": [[715, 100], [715, 151]],
  "TEMPLE>SWAMP": [[767, 86], [792, 86], [792, 543], [816, 543]],
  "TEMPLE>RUINS": [[767, 60], [868, 60], [868, 151]],
  "SNOWY_FOREST>FOREST": [[1304, 426], [1304, 450], [587, 450], [587, 426]],
  "SNOWY_FOREST>MOUNTAIN": [[1381, 397], [1637, 397]],
  "SNOWY_FOREST>LAKE": [[1277, 397], [1201, 397], [1201, 477]],
  "ISLAND>SEA": [[1381, 615], [1431, 615]],
  "LABORATORY>CONSTRUCTION_SITE": [[408, 260], [408, 209]],
  // 커뮤니티 지도에는 없지만 현재 게임 데이터에 있는 연결: 빈 통로로 돌아간다
  "LABORATORY>ISLAND": [[440, 318], [440, 355], [1040, 355], [1040, 660], [1300, 660], [1300, 644]],
};

/** 길이 없는 연결: 두 칸 가운데를 잇는 선이 칸 테두리와 만나는 점끼리 잇는다 */
function straight(a: Pt, b: Pt): Pt[] {
  const edge = ([cx, cy]: Pt, dx: number, dy: number): Pt => {
    const t = Math.min(dx ? W / 2 / Math.abs(dx) : Infinity, dy ? H / 2 / Math.abs(dy) : Infinity);
    return [cx + dx * t, cy + dy * t];
  };
  return [edge(a, b[0] - a[0], b[1] - a[1]), edge(b, a[0] - b[0], a[1] - b[1])];
}

/** 확률 글자 위치: 처음 두 구간 중 긴 쪽의 가운데 */
function labelAt(pts: Pt[]): Pt {
  const seg = (i: number) => [pts[i], pts[i + 1]] as const;
  const len = ([p, q]: readonly [Pt, Pt]) => Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]);
  const s = pts.length > 2 && len(seg(1)) > len(seg(0)) ? seg(1) : seg(0);
  return [(s[0][0] + s[1][0]) / 2, (s[0][1] + s[1][1]) / 2];
}

export function BiomeMap({
  official,
  selected,
  onSelect,
}: {
  official: Official;
  selected: number;
  onSelect: (id: number) => void;
}) {
  const biomes = official.data.biomes.filter((b) => POS[b.key]);
  const keyOf = new Map(official.data.biomes.map((b) => [b.id, b.key]));

  const edges = biomes.flatMap((b) =>
    b.links
      .filter((l) => POS[keyOf.get(l.to) ?? ""])
      .map((l) => {
        const to = keyOf.get(l.to)!;
        const pts = ROUTES[`${b.key}>${to}`] ?? straight(POS[b.key], POS[to]);
        const kind = l.chance >= 1 ? "always" : l.chance >= 0.5 ? "half" : "third";
        return { key: `${b.id}-${l.to}`, pts, chance: l.chance, kind, active: b.id === selected };
      }),
  );
  // 고른 바이옴에서 나가는 화살표를 맨 위에 그린다
  edges.sort((a, b) => Number(a.active) - Number(b.active));

  return (
    <div className="biome-map">
      <svg viewBox="0 0 1771 870" role="img" aria-label="바이옴 지도">
        <defs>
          {["always", "half", "third", "active"].map((k) => (
            <marker key={k} id={`arrow-${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" className={`map-arrow ${k}`} />
            </marker>
          ))}
        </defs>
        {edges.map((e) => {
          const [lx, ly] = labelAt(e.pts);
          return (
            <g key={e.key} className={`map-edge ${e.kind}${e.active ? " active" : ""}`}>
              <polyline points={e.pts.map((p) => p.join(",")).join(" ")} markerEnd={`url(#arrow-${e.active ? "active" : e.kind})`} />
              {e.chance < 1 && (
                <text x={lx} y={ly - 6} textAnchor="middle">
                  {Math.round(e.chance * 100)}%
                </text>
              )}
            </g>
          );
        })}
        {biomes.map((b) => {
          const [x, y] = POS[b.key];
          return (
            <g
              key={b.id}
              className={`map-node${b.id === selected ? " active" : ""}`}
              transform={`translate(${x - W / 2},${y - H / 2})`}
              onClick={() => onSelect(b.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(ev) => (ev.key === "Enter" || ev.key === " ") && onSelect(b.id)}
            >
              <title>{b.name} 정보 보기</title>
              <clipPath id={`map-clip-${b.id}`}>
                <rect width={W} height={H} rx="8" />
              </clipPath>
              <image
                href={biomeImage(b.key)}
                width={W}
                height={H}
                preserveAspectRatio="xMidYMid slice"
                clipPath={`url(#map-clip-${b.id})`}
                className="map-bg"
              />
              <rect width={W} height={H} rx="8" className="map-shade" />
              <rect width={W} height={H} rx="8" className="map-frame" />
              <text x={W / 2} y={H / 2 + 7} textAnchor="middle">
                {b.name}
              </text>
              {b.key === "TOWN" && (
                <text className="map-start" x={W / 2} y={H + 22} textAnchor="middle">
                  시작
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <p className="small muted">
        실선은 항상 고를 수 있는 다음 바이옴, 점선은 그 확률로만 선택지에 뜨는 바이옴입니다. 칸을 누르면 그 바이옴 정보로
        이동합니다.
      </p>
    </div>
  );
}
