// 왼쪽 사이드바 메뉴. 좁은 화면에서는 위쪽 가로 메뉴로 바뀐다.
import type { ReactNode } from "react";

export type Page = "recommend" | "dex" | "trainers" | "biomes" | "owned" | "guide";

const svg = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);

const ICONS: Record<Page, ReactNode> = {
  // 별(추천)
  recommend: svg(<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />),
  // 몬스터볼
  dex: svg(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h6m6 0h6" />
      <circle cx="12" cy="12" r="3" />
    </>,
  ),
  // 사람
  trainers: svg(
    <>
      <circle cx="12" cy="7" r="4" />
      <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
    </>,
  ),
  // 지도
  biomes: svg(
    <>
      <path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z" />
      <path d="M9 4v14M15 6v14" />
    </>,
  ),
  // 상자
  owned: svg(
    <>
      <path d="M3 7l9-4 9 4v10l-9 4-9-4z" />
      <path d="M3 7l9 4 9-4M12 11v10" />
    </>,
  ),
  // 책
  guide: svg(
    <>
      <path d="M4 4h6a3 3 0 013 3v13a2 2 0 00-2-2H4z" />
      <path d="M20 4h-6a3 3 0 00-3 3v13a2 2 0 012-2h7z" />
    </>,
  ),
};

interface Item {
  page: Page;
  label: string;
  soon?: boolean;
}
const GROUPS: { title?: string; items: Item[] }[] = [
  { items: [{ page: "recommend", label: "파티 추천" }] },
  {
    title: "도감",
    items: [
      { page: "dex", label: "포켓몬" },
      { page: "trainers", label: "트레이너" },
      { page: "biomes", label: "바이옴" },
    ],
  },
  { items: [{ page: "owned", label: "보유 현황" }] },
  { items: [{ page: "guide", label: "가이드북" }] },
];

export const PAGES: Page[] = GROUPS.flatMap((g) => g.items.map((i) => i.page));

interface Props {
  page: Page;
  onSelect: (p: Page) => void;
  footer?: ReactNode;
}

export function Sidebar({ page, onSelect, footer }: Props) {
  return (
    <aside className="sidebar">
      <div className="brand">포켓로그 파티 빌더</div>
      <nav>
        {GROUPS.map((g, gi) => (
          <div key={gi} className="side-group">
            {g.title && <div className="side-title">{g.title}</div>}
            {g.items.map((it) => (
              <button
                key={it.page}
                className={`side-item${page === it.page ? " active" : ""}${g.title ? " sub" : ""}`}
                onClick={() => onSelect(it.page)}
                aria-current={page === it.page ? "page" : undefined}
              >
                {ICONS[it.page]}
                <span>{it.label}</span>
                {it.soon && <span className="soon">준비 중</span>}
              </button>
            ))}
          </div>
        ))}
      </nav>
      {footer && <div className="side-footer">{footer}</div>}
    </aside>
  );
}
