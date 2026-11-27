// 게임 아이템 그림 (스프라이트 시트 public/images/items.png 의 한 칸). 그림이 없으면 아무것도 그리지 않는다
import { imageUrl } from "../lib/assets";
import { Fragment } from "react";
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
          backgroundImage: `url(${imageUrl("items.png")})`,
          backgroundSize: `${atlas.w * k}px ${atlas.h * k}px`,
          backgroundPosition: `${-sp.x * k}px ${-sp.y * k}px`,
        }}
      />
    </span>
  );
}

/**
 * 문장 속 아이템 이름을 게임 상점 등급 색(노말 흰색·슈퍼 파랑·하이퍼 노랑·로그 빨강·마스터 보라)으로 칠한다.
 * items 는 아이템 그림 키. 이름을 문장에서 못 찾으면 문장을 그대로 보여 준다.
 */
export function ItemText({ text, items }: { text: string; items: string[] }) {
  const official = useOfficial();
  const named = items
    .map((k) => official?.data.itemSprites?.[k])
    .filter((sp): sp is NonNullable<typeof sp> => !!sp && text.includes(sp.name));
  if (!named.length) return <>{text}</>;
  // 긴 이름부터 찾아야 "큰금강옥" 안의 "금강옥" 같은 겹침을 피한다
  const byName = new Map(named.map((sp) => [sp.name, sp.tier ?? "common"]));
  const re = new RegExp(`(${[...byName.keys()].sort((a, b) => b.length - a.length).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`);
  return (
    <>
      {text.split(re).map((part, i) =>
        byName.has(part) ? (
          <span key={i} className={`item-name tier-${byName.get(part)}`}>
            {part}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}
