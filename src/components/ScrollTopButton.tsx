import { useEffect, useState } from "react";

/** 화면 오른쪽 아래의 "맨 위로" 버튼. 조금 내려갔을 때만 보인다 */
export function ScrollTopButton() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  if (!show) return null;
  return (
    <button className="scroll-top" onClick={() => window.scrollTo({ top: 0 })} aria-label="맨 위로 이동" title="맨 위로">
      ↑
    </button>
  );
}
