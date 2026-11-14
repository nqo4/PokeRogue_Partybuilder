// 스타터 사탕 그림: 게임처럼 바탕(candy)과 덧그림(candy_overlay)을 포켓몬별 두 색으로 물들여 겹친다.
// 그림의 명암은 남기고 색만 입히려고 배경색과 그림을 곱하기로 섞고, 같은 그림을 마스크로 써서 모양 밖은 자른다.
import type { CSSProperties } from "react";
import { useOfficial } from "./OfficialContext";

export function CandyIcon({ speciesId, size = 20 }: { speciesId: number; size?: number }) {
  const official = useOfficial();
  const d = official?.data;
  const colors = d?.starterColors?.[String(speciesId)];
  const atlas = d?.itemAtlas;
  if (!d?.itemSprites || !atlas || !colors) return null;
  const layer = (key: string, color: string): CSSProperties | null => {
    const sp = d.itemSprites![key];
    if (!sp) return null;
    const k = size / sp.sw;
    const url = `url(${import.meta.env.BASE_URL}images/items.png)`;
    const size2 = `${atlas.w * k}px ${atlas.h * k}px`;
    const pos = `${-sp.x * k}px ${-sp.y * k}px`;
    return {
      left: sp.ox * k,
      top: sp.oy * k,
      width: sp.w * k,
      height: sp.h * k,
      backgroundColor: `#${color}`,
      backgroundImage: url,
      backgroundSize: size2,
      backgroundPosition: pos,
      backgroundBlendMode: "multiply",
      maskImage: url,
      maskSize: size2,
      maskPosition: pos,
      WebkitMaskImage: url,
      WebkitMaskSize: size2,
      WebkitMaskPosition: pos,
    };
  };
  const base = layer("candy", colors[0]);
  const over = layer("candy_overlay", colors[1]);
  return (
    <span className="item-icon candy-icon" style={{ width: size, height: size }} aria-hidden="true">
      {base && <span style={base} />}
      {over && <span style={over} />}
    </span>
  );
}
