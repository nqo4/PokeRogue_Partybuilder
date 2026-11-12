// 바이옴 지도: 공식 데이터의 연결(links)로 화살표를 그린다. 칸을 누르면 그 바이옴을 고른다.
import type { Official } from "../lib/official";

/** 칸 위치 (가운데 좌표). 커뮤니티에서 흔히 쓰는 지도 배치를 따랐다 */
const POS: Record<string, [number, number]> = {
  DOJO: [275, 105], JUNGLE: [623, 105], TEMPLE: [797, 105],
  CONSTRUCTION_SITE: [449, 228], DESERT: [797, 228], RUINS: [971, 228], SPACE: [1145, 228],
  POWER_PLANT: [275, 351], LABORATORY: [449, 351], FAIRY_CAVE: [1493, 351], ICE_CAVE: [1667, 351],
  SLUM: [101, 474], FACTORY: [449, 474], FOREST: [623, 474], MEADOW: [971, 474], SNOWY_FOREST: [1493, 474],
  MOUNTAIN: [1899, 474],
  METROPOLIS: [101, 597], PLAINS: [275, 597], LAKE: [1319, 597], BEACH: [1493, 597], VOLCANO: [1783, 597],
  TOWN: [101, 720], GRASS: [275, 720], TALL_GRASS: [623, 720], SWAMP: [971, 655], CAVE: [1319, 720],
  ISLAND: [1493, 720], SEA: [1667, 720],
  GRAVEYARD: [971, 843], ABYSS: [1145, 843], SEABED: [1493, 843], WASTELAND: [1667, 908],
  BADLANDS: [1319, 966],
};
const W = 124;
const H = 58;

/** (x1,y1)→(x2,y2) 선이 가운데 (cx,cy) 칸의 테두리와 만나는 점 */
function edgePoint(cx: number, cy: number, dx: number, dy: number, pad = 4): [number, number] {
  const hw = W / 2 + pad;
  const hh = H / 2 + pad;
  const t = Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity);
  return [cx + dx * t, cy + dy * t];
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
        const [x1, y1] = POS[b.key];
        const [x2, y2] = POS[keyOf.get(l.to)!];
        const dx = x2 - x1;
        const dy = y2 - y1;
        const [sx, sy] = edgePoint(x1, y1, dx, dy);
        const [ex, ey] = edgePoint(x2, y2, -dx, -dy, 6);
        const kind = l.chance >= 1 ? "always" : l.chance >= 0.5 ? "half" : "third";
        const active = b.id === selected;
        return { key: `${b.id}-${l.to}`, sx, sy, ex, ey, chance: l.chance, kind, active };
      }),
  );
  // 고른 바이옴에서 나가는 화살표를 맨 위에 그린다
  edges.sort((a, b) => Number(a.active) - Number(b.active));

  return (
    <div className="biome-map">
      <svg viewBox="0 0 2000 1020" role="img" aria-label="바이옴 지도">
        <defs>
          {["always", "half", "third", "active"].map((k) => (
            <marker key={k} id={`arrow-${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" className={`map-arrow ${k}`} />
            </marker>
          ))}
        </defs>
        {edges.map((e) => (
          <g key={e.key} className={`map-edge ${e.kind}${e.active ? " active" : ""}`}>
            <line x1={e.sx} y1={e.sy} x2={e.ex} y2={e.ey} markerEnd={`url(#arrow-${e.active ? "active" : e.kind})`} />
            {e.chance < 1 && (
              <text x={(e.sx + e.ex) / 2} y={(e.sy + e.ey) / 2 - 6} textAnchor="middle">
                {Math.round(e.chance * 100)}%
              </text>
            )}
          </g>
        ))}
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
              <rect width={W} height={H} rx="10" />
              <text x={W / 2} y={H / 2 + 8} textAnchor="middle">
                {b.name}
              </text>
              {b.key === "TOWN" && (
                <text className="map-start" x={W / 2} y={H + 30} textAnchor="middle">
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
