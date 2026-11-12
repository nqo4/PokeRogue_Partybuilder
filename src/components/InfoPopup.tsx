// 특성·기술 이름을 누르면 설명 창을 띄운다.
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Dex } from "../lib/dex";

interface Open {
  fid: number;
  x: number;
  y: number;
}

const Ctx = createContext<{ dex: Dex; open: (fid: number, el: HTMLElement) => void } | null>(null);

const CATEGORY = ["물리", "특수", "변화"];

export function InfoProvider({ dex, children }: { dex: Dex; children: ReactNode }) {
  const [state, setState] = useState<Open | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!state) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      if (e instanceof MouseEvent && box.current?.contains(e.target as Node)) return;
      setState(null);
    };
    const onScroll = () => setState(null);
    // 여는 클릭이 바로 닫지 않도록 다음 틱에 등록한다
    const t = setTimeout(() => {
      document.addEventListener("mousedown", close);
      document.addEventListener("keydown", close);
      window.addEventListener("scroll", onScroll, true);
    });
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [state]);

  const open = (fid: number, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setState({ fid, x: r.left, y: r.bottom + 6 });
  };

  return (
    <Ctx.Provider value={{ dex, open }}>
      {children}
      {state && (
        <div
          ref={box}
          className="info-popup"
          style={{ left: Math.min(state.x, window.innerWidth - 336), top: Math.min(state.y, window.innerHeight - 40) }}
          role="dialog"
        >
          <InfoBody dex={dex} fid={state.fid} />
        </div>
      )}
    </Ctx.Provider>
  );
}

function InfoBody({ dex, fid }: { dex: Dex; fid: number }) {
  const d = dex.data;
  const move = dex.isMove(fid) ? dex.move(fid) : undefined;
  const desc = dex.description(fid);
  if (!move) {
    const tags = dex.abilityTags(fid).map((t) => d.tagNames[t]).filter(Boolean);
    return (
      <>
        <div className="info-title">
          <b>{dex.name(fid)}</b> <span className="muted small">특성</span>
        </div>
        <p>{desc || "설명이 없습니다."}</p>
        {tags.length > 0 && <p className="small muted">{tags.join(" · ")}</p>}
      </>
    );
  }
  const val = (x: number) => (x < 0 ? "-" : x);
  const procs = move.procs.map(([chance, eff, stages]) => {
    const pre = chance > 0 ? `${chance}% ` : "";
    const amount =
      stages === 0 ? "" : ` ${chance === -2 ? "× " : stages > 0 ? "+" : ""}${stages}${chance === -3 ? "%" : ""}`;
    return `${pre}${d.procNames[eff] ?? `효과 ${eff}`}${amount}`;
  });
  const tags = move.tags.map((t) => d.tagNames[t]).filter(Boolean);
  return (
    <>
      <div className="info-title">
        <b>{dex.name(fid)}</b>
        <span className="type" style={{ background: d.typeColors[move.type] }}>
          {dex.name(move.type)}
        </span>
        <span className={`cat cat-${move.cat}`}>{CATEGORY[move.cat]}</span>
      </div>
      <dl className="move-stats">
        <div>
          <dt>위력</dt>
          <dd>{val(move.power)}</dd>
        </div>
        <div>
          <dt>명중률</dt>
          <dd>{val(move.acc)}</dd>
        </div>
        <div>
          <dt>PP</dt>
          <dd>{move.pp}</dd>
        </div>
        <div>
          <dt>우선도</dt>
          <dd>{move.priority > 0 ? `+${move.priority}` : move.priority}</dd>
        </div>
      </dl>
      {desc && <p>{desc}</p>}
      {(procs.length > 0 || tags.length > 0) && (
        <ul className="small muted info-tags">
          {procs.map((p, i) => (
            <li key={`p${i}`}>{p}</li>
          ))}
          {tags.map((t, i) => (
            <li key={`t${i}`}>{t}</li>
          ))}
        </ul>
      )}
    </>
  );
}

/** 누르면 설명 창이 뜨는 특성·기술 이름 */
export function InfoLink({ fid, children }: { fid: number | null | undefined; children?: ReactNode }) {
  const ctx = useContext(Ctx);
  if (fid == null || !ctx) return <>{children}</>;
  return (
    <button
      type="button"
      className="info-link"
      onClick={(e) => {
        e.stopPropagation();
        ctx.open(fid, e.currentTarget);
      }}
    >
      {children ?? ctx.dex.name(fid)}
    </button>
  );
}

/** 기술 이름 앞에 기술 타입 배지를 붙인다 */
export function MoveLabel({ fid }: { fid: number }) {
  const ctx = useContext(Ctx);
  const m = ctx?.dex.move(fid);
  return (
    <span className="move-label">
      {m && ctx && (
        <span className="type type-sm" style={{ background: ctx.dex.data.typeColors[m.type] }}>
          {ctx.dex.name(m.type)}
        </span>
      )}
      <InfoLink fid={fid} />
    </span>
  );
}
