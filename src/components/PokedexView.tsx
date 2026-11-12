// 포켓몬 도감: 진화형·메가·거다이맥스·폼까지 모든 형태. 세이브가 있으면 못 잡은 형태를 어둡게 흐리게 보여준다.
import { useMemo, useState } from "react";
import type { Dex } from "../lib/dex";
import type { FormStatus } from "../lib/starters";
import { Sprite, nationalDex } from "./Sprite";
import { STATUS_LABEL } from "./StarterModal";

type FormFilter = "all" | "base" | "mega" | "gmax" | "other";
const FORM_FILTERS: [FormFilter, string][] = [
  ["all", "모든 형태"],
  ["base", "기본 형태"],
  ["mega", "메가진화"],
  ["gmax", "거다이맥스"],
  ["other", "기타 폼"],
];
type StatusFilter = "all" | FormStatus;

interface Props {
  dex: Dex;
  status?: Record<number, FormStatus>;
  onOpen: (idx: number) => void;
}

export function PokedexView({ dex, status, onOpen }: Props) {
  const [gen, setGen] = useState(0);
  const [type, setType] = useState(-1);
  const [form, setForm] = useState<FormFilter>("all");
  const [st, setSt] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim();
    const num = /^\d+$/.test(q) ? Number(q) : null;
    return dex.species
      .filter(
        (s) =>
          (!gen || s.gen === gen) &&
          (type < 0 || s.types.includes(type)) &&
          (form === "all" ||
            (form === "base" && s.form === 0) ||
            (form === "mega" && (s.form === 1 || s.form === 2)) ||
            (form === "gmax" && s.form === 3) ||
            (form === "other" && s.form === 4)) &&
          (st === "all" || !status || status[s.idx] === st) &&
          (!q || (num != null ? nationalDex(s.id) === num : s.name.includes(q))),
      )
      .sort((a, b) => nationalDex(a.id) - nationalDex(b.id) || a.idx - b.idx);
  }, [dex, status, gen, type, form, st, query]);

  const counts = useMemo(() => {
    if (!status) return null;
    const c = { caught: 0, seen: 0, unseen: 0 };
    for (const s of dex.species) c[status[s.idx] ?? "unseen"]++;
    return c;
  }, [dex, status]);

  return (
    <section>
      <div className="filters">
        <select value={gen} onChange={(e) => setGen(Number(e.target.value))}>
          <option value={0}>전체 세대</option>
          {Array.from({ length: 9 }, (_, i) => (
            <option key={i} value={i + 1}>
              {i + 1}세대
            </option>
          ))}
        </select>
        <select value={type} onChange={(e) => setType(Number(e.target.value))}>
          <option value={-1}>전체 타입</option>
          {Array.from({ length: dex.data.ranges.type[1] }, (_, t) => (
            <option key={t} value={t}>
              {dex.name(t)}
            </option>
          ))}
        </select>
        <select value={form} onChange={(e) => setForm(e.target.value as FormFilter)}>
          {FORM_FILTERS.map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
        {status && (
          <select value={st} onChange={(e) => setSt(e.target.value as StatusFilter)}>
            <option value="all">도감 상태: 전체</option>
            <option value="caught">잡음</option>
            <option value="seen">발견만</option>
            <option value="unseen">미발견</option>
          </select>
        )}
        <input placeholder="이름 또는 도감 번호" value={query} onChange={(e) => setQuery(e.target.value)} />
        <span className="muted">{rows.length}개</span>
        {counts && (
          <span className="muted small">
            · 잡음 {counts.caught} / 발견만 {counts.seen} / 미발견 {counts.unseen}
          </span>
        )}
      </div>
      {!status && <p className="muted small">세이브를 올리면 잡지 못한 형태가 어둡게 표시됩니다.</p>}
      <div className="grid-view">
        {rows.map((s) => {
          const ss = status?.[s.idx];
          return (
            <button key={s.idx} className={`tile${ss && ss !== "caught" ? ` dim-${ss}` : ""}`} onClick={() => onOpen(s.idx)}>
              <span className="small muted">No.{String(nationalDex(s.id)).padStart(4, "0")}</span>
              <Sprite species={s} size={56} />
              <span className="tile-name">{s.name}</span>
              <span>
                {s.types.map((t) => (
                  <span key={t} className="type" style={{ background: dex.data.typeColors[t] }}>
                    {dex.name(t)}
                  </span>
                ))}
              </span>
              {ss && ss !== "caught" && <span className="small muted">{STATUS_LABEL[ss]}</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}
