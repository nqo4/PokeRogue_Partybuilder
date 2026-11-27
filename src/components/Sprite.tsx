import { imageUrl } from "../lib/assets";
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
  /** 이로치 단계 (1·2·3럭). 주면 그 단계의 이로치 이미지를 보여 준다 */
  shiny?: number | null;
  /** 챌린지 경고 문구. 있으면 오른쪽 위에 빨간 느낌표를 달고, 마우스를 올리면 문구를 보여준다 */
  warning?: string | null;
}

/** 흰 테두리 빨간 느낌표 (4×9 도트) */
function WarnMark() {
  return (
    <svg className="sprite-warn" viewBox="0 0 4 9" width={8} height={18} shapeRendering="crispEdges" aria-hidden="true">
      <rect width="4" height="9" fill="#fff" />
      <rect x="1" y="1" width="2" height="4" fill="#e0242f" />
      <rect x="1" y="6" width="2" height="2" fill="#e0242f" />
    </svg>
  );
}

/** 포켓몬 이미지. 마우스를 올리면 도감 번호와 이름을, 누르면 상세 화면을 보여준다. */
export function Sprite({ species, size = 48, warning, shiny }: Props) {
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
        // 경고 문구가 있으면 툴팁이 넓어서(최대 320px) 더 안쪽으로 당긴다
        const edge = warning ? 172 : 130;
        setTip({ x: Math.min(Math.max(r.left + r.width / 2, edge), window.innerWidth - edge), y: r.top });
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
        key={shiny ?? 0}
        src={imageUrl(shiny ? `shiny/${species.img}_${shiny}.png` : `${species.img}.png`)}
        alt={shiny ? `${species.name} (${shiny}럭 이로치)` : species.name}
        loading="lazy"
        onError={(e) => {
          // 이로치 이미지가 없으면 기본 색으로, 그것도 없으면 숨긴다
          const img = e.currentTarget;
          const base = imageUrl(`${species.img}.png`);
          // compare by path: img.src is absolute while base may be relative ("./images/...")
          if (shiny && !img.src.includes(`/images/${species.img}.png`)) img.src = base;
          else img.style.visibility = "hidden";
        }}
      />
      {warning && (
        <>
          <WarnMark />
          <span className="visually-hidden">{warning}</span>
        </>
      )}
      {tip &&
        // body 에 띄워서, 흐리게 표시한 줄이나 스크롤 영역의 영향을 받지 않게 한다
        createPortal(
          <span className="sprite-tip" style={{ left: tip.x, top: tip.y }}>
            <b>No.{no}</b> {species.name}
            {warning && <span className="sprite-tip-warn">{warning}</span>}
          </span>,
          document.body,
        )}
    </span>
  );
}
