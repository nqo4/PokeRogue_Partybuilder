// 게임 아이템 그림 (스프라이트 시트 public/images/items.png 의 한 칸). 그림이 없으면 아무것도 그리지 않는다
import { useOfficial } from "./OfficialContext";

export function ItemIcon({ item, size = 24 }: { item: string; size?: number }) {
  const official = useOfficial();
  const sp = official?.data.itemSprites?.[item];
  const atlas = official?.data.itemAtlas;
  if (!sp || !atlas) return null;
  const k = size / sp.sw;
  return (
    <span className="item-icon" style={{ width: size, height: size }} title={sp.name} role="img" aria-label={sp.name}>
      <span
        style={{
          left: sp.ox * k,
          top: sp.oy * k,
          width: sp.w * k,
          height: sp.h * k,
          backgroundImage: `url(${import.meta.env.BASE_URL}images/items.png)`,
          backgroundSize: `${atlas.w * k}px ${atlas.h * k}px`,
          backgroundPosition: `${-sp.x * k}px ${-sp.y * k}px`,
        }}
      />
    </span>
  );
}
