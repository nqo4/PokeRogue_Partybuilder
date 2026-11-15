// 왼쪽 사이드바 메뉴. 좁은 화면에서는 위쪽 가로 메뉴로 바뀐다.
import { useEffect, useState, type ReactNode } from "react";

export type Page = "recommend" | "check" | "rotation" | "dex" | "trainers" | "biomes" | "owned" | "stats" | "guide";

const svg = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);

const ICONS: Record<Page, ReactNode> = {
  // 별(추천)
  recommend: svg(<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />),
  // 체크 표시가 있는 클립보드(점검)
  check: svg(
    <>
      <path d="M9 4h6v3H9z" />
      <path d="M9 5H6v16h12V5h-3" />
      <path d="M9 14l2 2 4-4" />
    </>,
  ),
  // 달력
  rotation: svg(
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>,
  ),
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
  // 막대그래프
  stats: svg(
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
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
  {
    items: [
      { page: "recommend", label: "파티 추천" },
      { page: "check", label: "파티 만들기" },
    ],
  },
  {
    title: "도감",
    items: [
      { page: "dex", label: "포켓몬" },
      { page: "trainers", label: "트레이너" },
      { page: "biomes", label: "바이옴" },
    ],
  },
  {
    items: [
      { page: "owned", label: "보유 현황" },
      { page: "stats", label: "통계" },
      { page: "rotation", label: "로테이션" },
    ],
  },
  { items: [{ page: "guide", label: "가이드북" }] },
];

export const PAGES: Page[] = GROUPS.flatMap((g) => g.items.map((i) => i.page));

interface Props {
  page: Page;
  onSelect: (p: Page) => void;
  footer?: ReactNode;
}

export function Sidebar({ page, onSelect, footer }: Props) {
  /** 좁은 화면에서 왼쪽 서랍 메뉴가 열려 있는가 (넓은 화면에서는 쓰지 않는다) */
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    // 메뉴가 열린 동안 뒤 화면이 스크롤되지 않게 한다
    document.body.classList.add("menu-open");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("menu-open");
    };
  }, [open]);

  return (
    <>
      <button
        className="menu-button"
        aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
        aria-expanded={open}
        aria-controls="side-menu"
        onClick={() => setOpen(!open)}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <div className={`menu-backdrop${open ? " open" : ""}`} onClick={() => setOpen(false)} aria-hidden="true" />
      <aside id="side-menu" className={`sidebar${open ? " open" : ""}`}>
        <div className="brand">포켓로그 파티 빌더</div>
        <nav>
          {GROUPS.map((g, gi) => (
            <div key={gi} className="side-group">
              {g.title && <div className="side-title">{g.title}</div>}
              {g.items.map((it) => (
                <button
                  key={it.page}
                  className={`side-item${page === it.page ? " active" : ""}${g.title ? " sub" : ""}`}
                  onClick={() => {
                    onSelect(it.page);
                    setOpen(false);
                  }}
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
    </>
  );
}
