import { useMemo, useState } from "react";
import type { Dex, DexSpecies } from "../lib/dex";
import type { OwnedStarter } from "../lib/starters";
import { Sprite, nationalDex } from "./Sprite";
import { STAT_NAMES } from "./StarterModal";

type SortKey = "id" | "cost" | "maxBst" | "luck" | "ivTotal" | "classicWins";
const SORTS: [SortKey, string][] = [
  ["id", "도감 번호"],
  ["cost", "코스트"],
  ["maxBst", "최종 종족값"],
  ["luck", "럭"],
  ["ivTotal", "개체치 합"],
  ["classicWins", "클래식 클리어"],
];

/** 폼 변화 필터: Dex 의 form 값 (1 메가, 2 신규 메가, 3 거다이맥스, 4 변형) */
type FormFilter = "all" | "any" | "mega" | "gmax" | "other";
const FORM_FILTERS: [FormFilter, string][] = [
  ["all", "폼 변화: 전체"],
  ["any", "폼 변화 가능 전부"],
  ["mega", "메가진화 가능"],
  ["gmax", "거다이맥스 가능"],
  ["other", "기타 폼 변화 가능"],
];
const formMatch = (family: DexSpecies[], f: FormFilter) => {
  if (f === "all") return true;
  return family.some((s) =>
    f === "any" ? s.form >= 1 && s.form <= 4 : f === "mega" ? s.form === 1 || s.form === 2 : f === "gmax" ? s.form === 3 : s.form === 4,
  );
};

interface Props {
  starters: OwnedStarter[];
  dex: Dex;
  /** 포켓몬을 누르면 상세 화면을 연다 */
  /** 포켓몬을 누르면 상세 화면을 연다 (Dex idx) */
  onOpen: (idx: number) => void;
}

type View = "list" | "grid";

type ClearFilter = "all" | "cleared" | "uncleared" | "missingForm";
const CLEAR_FILTERS: [ClearFilter, string][] = [
  ["all", "전체"],
  ["cleared", "클래식 클리어"],
  ["uncleared", "클래식 미클리어"],
  ["missingForm", "못 잡은 형태 있음"],
];

export function StarterTable({ starters, dex, onOpen }: Props) {
  const [clear, setClear] = useState<ClearFilter>("uncleared");
  const [gen, setGen] = useState(0);
  const [type, setType] = useState(-1);
  const [form, setForm] = useState<FormFilter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("id");
  const [desc, setDesc] = useState(false);
  const [view, setView] = useState<View>(() => {
    try {
      return localStorage.getItem("ownedView") === "grid" ? "grid" : "list";
    } catch {
      return "list";
    }
  });
  const changeView = (v: View) => {
    setView(v);
    try {
      localStorage.setItem("ownedView", v);
    } catch {
      /* 저장 못 해도 동작에는 문제 없음 */
    }
  };

  const typeCount = dex.data.ranges.type[1];
  const rows = useMemo(() => {
    const q = query.trim();
    const list = starters.filter(
      (s) =>
        (clear === "all" ||
          (clear === "cleared" && s.classicWins > 0) ||
          (clear === "uncleared" && s.classicWins === 0) ||
          (clear === "missingForm" && s.family.some((f) => s.formStatus[f.idx] !== "caught"))) &&
        (!gen || s.gen === gen) &&
        // 단일 타입 챌린지처럼, 진화·폼 변화로 얻는 타입까지 포함해서 거른다
        (type < 0 || s.family.some((f) => f.types.includes(type))) &&
        formMatch(s.family, form) &&
        (!q || s.name.includes(q) || s.family.some((f) => f.name.includes(q))),
    );
    const value = (s: OwnedStarter) => (sort === "id" ? s.speciesId : s[sort]);
    const dir = desc ? -1 : 1;
    return list.sort((a, b) => (value(a) - value(b)) * dir || a.speciesId - b.speciesId);
  }, [starters, clear, gen, type, form, query, sort, desc]);

  const typeBadge = (fid: number) => (
    <span key={fid} className="type" style={{ background: dex.data.typeColors[fid] }}>
      {dex.name(fid)}
    </span>
  );

  return (
    <section>
      <div className="filters">
        <select value={clear} onChange={(e) => setClear(e.target.value as ClearFilter)}>
          {CLEAR_FILTERS.map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
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
          {Array.from({ length: typeCount }, (_, t) => (
            <option key={t} value={t}>
              {dex.name(t)} (진화·폼 포함)
            </option>
          ))}
        </select>
        <select value={form} onChange={(e) => setForm(e.target.value as FormFilter)}>
          {FORM_FILTERS.map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <input placeholder="이름 검색" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
          {SORTS.map(([k, label]) => (
            <option key={k} value={k}>
              정렬: {label}
            </option>
          ))}
        </select>
        <select value={desc ? "desc" : "asc"} onChange={(e) => setDesc(e.target.value === "desc")}>
          <option value="asc">오름차순</option>
          <option value="desc">내림차순</option>
        </select>
        <span className="muted">{rows.length}종</span>
        <span className="view-toggle" role="group" aria-label="보기 방식">
          <button className={view === "list" ? "active" : ""} onClick={() => changeView("list")}>
            자세히
          </button>
          <button className={view === "grid" ? "active" : ""} onClick={() => changeView("grid")}>
            바둑판
          </button>
        </span>
      </div>

      {view === "grid" && (
        <div className="grid-view">
          {rows.map((s) => (
            <button key={s.speciesId} className="tile" onClick={() => onOpen(s.dex.idx)}>
              <Sprite species={s.dex} size={56} />
              <span className="tile-name">{s.name}</span>
              <span>{s.dex.types.map(typeBadge)}</span>
              <span className="small muted">
                코스트 {s.cost}
                {s.luck > 0 && <b className={`luck-${s.luck}`}> · 럭 {s.luck}</b>}
              </span>
            </button>
          ))}
        </div>
      )}

      {view === "list" && (
      <div className="table-wrap">
        <table className="starters">
          <thead>
            <tr>
              <th>번호</th>
              <th>이름</th>
              <th>타입</th>
              <th>코스트</th>
              <th>최종 종족값</th>
              {STAT_NAMES.map((n) => (
                <th key={n} className="iv-head">
                  {n}
                </th>
              ))}
              <th>알기술</th>
              <th>럭</th>
              <th>클리어</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
                <tr key={s.speciesId} className="row" onClick={() => onOpen(s.dex.idx)}>
                  <td className="num">{nationalDex(s.speciesId)}</td>
                  <td>
                    <span className="name-cell">
                      <Sprite species={s.dex} size={36} />
                      {s.name}
                      {!s.passive.unlocked && <span className="locked small" title="패시브 미해금">패시브✕</span>}
                    </span>
                  </td>
                  <td>{s.dex.types.map(typeBadge)}</td>
                  <td className="num">
                    {s.cost}
                    {s.costReductions > 0 && <span className="muted"> ({s.baseCost}−{s.costReductions}회)</span>}
                  </td>
                  <td className="num">{s.maxBst}</td>
                  {s.ivs.map((v, i) => (
                    <td key={i} className={`num iv${v === 31 ? " iv-max" : ""}`}>
                      {v}
                    </td>
                  ))}
                  <td className={s.eggMovesUnlocked < 4 ? "locked num" : "num"}>{s.eggMovesUnlocked}/4</td>
                  <td className={`num luck-${s.luck}`}>{s.luck || ""}</td>
                  <td className="num">{s.classicWins}</td>
                </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </section>
  );
}

