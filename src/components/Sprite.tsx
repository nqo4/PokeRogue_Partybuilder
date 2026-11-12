import { createContext, useContext, useState } from "react";
import { createPortal } from "react-dom";
import type { DexSpecies } from "../lib/dex";

/** 전국도감 번호. 포켓로그 리전폼 ID 는 (지역 × 1000 + 도감번호) 형식이다 (예: 2026 알로라 라이츄 → 26) */
export function nationalDex(id: number): number {
  return id >= 2000 ? id % 1000 : id;
}

/** 사진을 눌렀을 때 실행할 동작 (App 이 "이 포켓몬 상세 보기"를 넣어 준다) */
export const SpriteSelectContext = createContext<((s: DexSpecies) => void) | null>(null);

interface Props {
  species: DexSpecies;
  /** 칸 크기(px) */
  size?: number;
}

/** 포켓몬 이미지. 마우스를 올리면 도감 번호와 이름을, 누르면 상세 화면을 보여준다. */
export function Sprite({ species, size = 48 }: Props) {
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);
  const select = useContext(SpriteSelectContext);
  const no = String(nationalDex(species.id)).padStart(4, "0");

  return (
    <span
      className={`sprite${select ? " clickable" : ""}`}
      style={{ width: size, height: size }}
      onMouseEnter={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        // 화면 왼쪽·오른쪽 끝에서 툴팁이 잘리지 않도록 가운데 위치를 안쪽으로 당긴다
        setTip({ x: Math.min(Math.max(r.left + r.width / 2, 130), window.innerWidth - 130), y: r.top });
      }}
      onMouseLeave={() => setTip(null)}
      onClick={(e) => {
        if (!select) return;
        e.stopPropagation();
        setTip(null);
        select(species);
      }}
    >
      <img
        src={`${import.meta.env.BASE_URL}images/${species.img}.png`}
        alt={species.name}
        loading="lazy"
        onError={(e) => (e.currentTarget.style.visibility = "hidden")}
      />
      {tip &&
        // body 에 띄워서, 흐리게 표시한 줄이나 스크롤 영역의 영향을 받지 않게 한다
        createPortal(
          <span className="sprite-tip" style={{ left: tip.x, top: tip.y }}>
            <b>No.{no}</b> {species.name}
            {select && <span className="muted"> · 눌러서 상세 보기</span>}
          </span>,
          document.body,
        )}
    </span>
  );
}
