import { useMemo, useState } from "react";
import { typeStyle } from "../lib/color";
import type { Dex } from "../lib/dex";
import type { OwnedStarter } from "../lib/starters";
import { ROLES, ROLE_NAMES, type Candidate, type Reason } from "../lib/classic/candidate";
import { ClassicRecommender, hasFormChange, type PartyRecommendation } from "../lib/classic/recommend";
import type { PartyAnalysis } from "../lib/classic/party";
import { Sprite } from "./Sprite";
import { RouteSection } from "./RouteSection";
import type { FormStatus } from "../lib/starters";
import { InfoLink } from "./InfoPopup";

interface Props {
  starters: OwnedStarter[];
  /** 형태별 도감 상태 (경로 추천에서 못 잡은 포켓몬 계산용) */
  status?: Record<number, FormStatus>;
  dex: Dex;
}

const SIZES = [1, 2, 3, 4, 5, 6];
/** 요약 줄에 쓰는 짧은 역할 이름 */
const ROLE_SHORT: Record<(typeof ROLES)[number], string> = {
  fast: "선공",
  sweeper: "스위퍼",
  multi: "광역·쉴드",
  tank: "막이",
  support: "서포터",
};
const FORM_LIMITS = [0, 1, 2, 3, 4, 5, 6];

export function ClassicRecommenderView({ starters, dex, status }: Props) {
  const [onlyUncleared, setOnlyUncleared] = useState(true);
  const [partySize, setPartySize] = useState(6);
  const [maxFormChange, setMaxFormChange] = useState(6);
  const [results, setResults] = useState<PartyRecommendation[] | null>(null);
  /** 지금까지 보여준 파티 (다시 누르면 이것들을 빼고 찾는다) */
  const [shown, setShown] = useState<string[]>([]);
  const [round, setRound] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recommender = useMemo(() => {
    try {
      return new ClassicRecommender(dex, starters);
    } catch (e) {
      setError((e as Error).message);
      return null;
    }
  }, [dex, starters]);

  const poolSize = starters.filter((s) => !onlyUncleared || s.classicWins === 0).length;

  // 조건이 바뀌면 재검색 기록을 지운다
  const reset = () => {
    setResults(null);
    setShown([]);
    setRound(0);
  };

  function run(fresh: boolean) {
    if (!recommender) return;
    setBusy(true);
    const exclude = fresh ? [] : shown;
    // 계산 전에 "계산 중" 표시가 먼저 그려지도록 한 틱 미룬다
    setTimeout(() => {
      try {
        const rs = recommender.recommend({ onlyUncleared, partySize, maxFormChange, exclude });
        setResults(rs);
        setShown([...exclude, ...rs.map((r) => r.key)]);
        setRound(fresh ? 1 : round + 1);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    }, 10);
  }

  const typeBadge = (fid: number) => (
    <span key={fid} className="type" style={typeStyle(dex.data.typeColors[fid])}>
      {dex.name(fid)}
    </span>
  );

  return (
    <section>
      <div className="filters">
        <label>
          <input
            type="checkbox"
            checked={onlyUncleared}
            onChange={(e) => {
              setOnlyUncleared(e.target.checked);
              reset();
            }}
          />
          클래식 미클리어 포켓몬만
        </label>
        <label>
          파티 수{" "}
          <select
            value={partySize}
            onChange={(e) => {
              setPartySize(Number(e.target.value));
              reset();
            }}
          >
            {SIZES.map((n) => (
              <option key={n} value={n}>
                {n}마리
              </option>
            ))}
          </select>
        </label>
        <label title="메가진화·거다이맥스·폼 변화가 가능한 포켓몬의 최대 수">
          폼 변화 포켓몬{" "}
          <select
            value={maxFormChange}
            onChange={(e) => {
              setMaxFormChange(Number(e.target.value));
              reset();
            }}
          >
            {FORM_LIMITS.map((n) => (
              <option key={n} value={n}>
                최대 {n}마리
              </option>
            ))}
          </select>
        </label>
        <span className="muted">후보 {poolSize}종 · 코스트 10 이하</span>
        <button className="primary" onClick={() => run(!results)} disabled={busy || !recommender}>
          {busy ? "계산 중…" : results ? "다른 파티 추천" : "추천 파티 만들기"}
        </button>
        {results && (
          <button className="link-button" onClick={() => run(true)} disabled={busy}>
            처음 추천으로
          </button>
        )}
      </div>
      {error && <p className="error">{error}</p>}
      {results && round > 1 && results.length > 0 && (
        <p className="muted small">{round}번째 추천 — 앞에서 보여준 파티와 2마리 이상 다른 조합입니다.</p>
      )}
      {results && results.length === 0 && (
        <p className="muted">
          {round > 1 ? "더 이상 다른 조합을 찾지 못했습니다. ‘처음 추천으로’를 눌러 주세요." : "조건에 맞는 파티를 찾지 못했습니다."}
        </p>
      )}
      {results?.map((r, i) => (
        <PartyCard key={r.key} index={i} rec={r} dex={dex} status={status} typeBadge={typeBadge} />
      ))}
    </section>
  );
}

function PartyCard({
  index,
  rec,
  dex,
  status,
  typeBadge,
}: {
  index: number;
  rec: PartyRecommendation;
  dex: Dex;
  status?: Record<number, FormStatus>;
  typeBadge: (fid: number) => JSX.Element;
}) {
  const a = rec.analysis;
  const forms = a.members.filter(hasFormChange).length;
  // 근거는 기본으로 접어 두고, 요약 줄에서 누른 포켓몬(또는 전부)만 펼친다
  const [open, setOpen] = useState<Set<number>>(() => new Set());
  const allOpen = open.size === a.members.length;
  const toggle = (i: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  const detailId = `party-${rec.key}-details`;

  return (
    <article className="party" aria-labelledby={`party-${rec.key}-title`}>
      <header className="party-head">
        <h2 id={`party-${rec.key}-title`}>추천 {index + 1}</h2>
        <span className="party-meta">
          코스트 <b>{a.cost}</b>/10 · {a.members.length}마리 · 럭 합계 {a.luck}
          {forms > 0 && ` · 폼 변화 ${forms}마리`}
        </span>
      </header>

      <ol className="party-strip">
        {a.members.map((m, i) => (
          <li key={m.owned.speciesId}>
            <button
              type="button"
              className={`strip-slot${open.has(i) ? " open" : ""}`}
              aria-expanded={open.has(i)}
              aria-controls={detailId}
              onClick={() => toggle(i)}
            >
              <Sprite species={m.form} size={64} />
              <span className="strip-name">{m.form.name}</span>
              <span className="strip-types">{m.types.map(typeBadge)}</span>
              <span className="strip-meta">
                코스트 {m.owned.cost}
                {m.owned.luck > 0 && <span className={`luck luck-${m.owned.luck}`}>럭 {m.owned.luck}</span>}
              </span>
              <span className="strip-roles">
                {a.memberRoles[i].length ? a.memberRoles[i].map((r) => ROLE_SHORT[r]).join(" · ") : "보조"}
              </span>
            </button>
          </li>
        ))}
      </ol>

      <div className="party-risk">
        {a.dangerTypes.length > 0 ? (
          <p>
            <span className="label">조심할 공격</span> {a.dangerTypes.slice(0, 5).map(typeBadge)}
          </p>
        ) : (
          <p className="muted">파티가 함께 약한 타입이 없습니다.</p>
        )}
        {a.offenseGaps.length > 0 && (
          <p>
            <span className="label">자속기로 약점을 못 찌름</span> {a.offenseGaps.map(typeBadge)}
          </p>
        )}
        <button
          type="button"
          className="link-button"
          aria-expanded={allOpen}
          aria-controls={detailId}
          onClick={() => setOpen(allOpen ? new Set() : new Set(a.members.map((_, i) => i)))}
        >
          {allOpen ? "근거 모두 접기" : `${a.members.length}마리 근거 모두 펼치기`}
        </button>
      </div>

      <div id={detailId} className="members" hidden={open.size === 0}>
        {a.members.map((m, i) =>
          open.has(i) ? <MemberCard key={m.owned.speciesId} m={m} roles={a.memberRoles[i]} typeBadge={typeBadge} /> : null,
        )}
      </div>

      <p className="party-roles small muted">
        역할 분포: {ROLES.filter((r) => a.roleCoverage[r]).map((r) => `${ROLE_NAMES[r]} ${a.roleCoverage[r]}`).join(" · ")}
      </p>

      <TypeTable a={a} dex={dex} typeBadge={typeBadge} />
      <RouteSection dex={dex} party={a} status={status} />

      <div className="party-notes">
        <div>
          <h3>주의할 점</h3>
          {a.issues.length ? (
            <ul>
              {a.issues.map((x, i) => (
                <li key={i} className={x.severity === "high" ? "error" : ""}>
                  {x.text}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted small">공통 약점 없음</p>
          )}
        </div>
        <div>
          <h3>보완 후보</h3>
          {rec.suggestions.length ? (
            <ul>
              {rec.suggestions.map((s) => (
                <li key={s.candidate.owned.speciesId} className="suggest-row">
                  <Sprite species={s.candidate.form} size={36} />
                  <span>
                    <b>{s.candidate.form.name}</b> (코스트 {s.candidate.owned.cost})
                    {s.replace ? ` ↔ ${s.replace.form.name} 대신` : " 추가"} — {s.covers.map(typeBadge)} 반감·무효
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted small">점수를 올리는 교체 후보 없음</p>
          )}
        </div>
      </div>
    </article>
  );
}

/** 판정 이유: 글자 + 누를 수 있는 특성·기술 이름 */
export function ReasonView({ r }: { r: Reason }) {
  return (
    <>
      {r.text}
      {r.refs?.map((fid, i) => (
        <span key={fid}>
          {i === 0 ? (r.text ? " " : "") : "·"}
          <InfoLink fid={fid} />
        </span>
      ))}
    </>
  );
}

function MemberCard({
  m,
  roles,
  typeBadge,
}: {
  m: Candidate;
  roles: (typeof ROLES)[number][];
  typeBadge: (fid: number) => JSX.Element;
}) {
  const o = m.owned;
  const evolves = m.form.idx !== o.dex.idx;
  return (
    <div className="member">
      <div className="member-head">
        <Sprite species={m.form} size={64} />
        <div className="member-title">
          <div>
            <b>{m.form.name}</b>
            <span className="cost">코스트 {o.cost}</span>
          </div>
          {evolves && (
            <div className="muted small evolves-from">
              <Sprite species={o.dex} size={28} /> {o.name}에서 진화
            </div>
          )}
          <div>
            {m.types.map(typeBadge)}
            <span className={`atk-kind ${m.offenseStat === "atk" ? "phys" : "spec"}`}>
              {m.offenseStat === "atk" ? "물리형" : "특수형"}
            </span>
            {o.luck > 0 && <span className={`luck luck-${o.luck}`}>럭 {o.luck}</span>}
            {hasFormChange(m) && <span className="form-badge">폼 변화</span>}
          </div>
        </div>
      </div>
      <div className="roles">
        {roles.length ? roles.map((r) => <span key={r} className={`role role-${r}`}>{ROLE_NAMES[r]}</span>) : <span className="muted small">보조</span>}
      </div>
      <p className="small">
        <span className="label">특성</span> <InfoLink fid={m.ability.fid} />
        {m.passive.active && (
          <>
            {" + "}
            <InfoLink fid={m.passive.fid} />
            (패시브)
          </>
        )}
      </p>
      <ul className="small reasons">
        {ROLES.filter((r) => m.roles[r].reasons.length && m.roles[r].score > 0).map((r) => (
          <li key={r}>
            <span className="label">{ROLE_NAMES[r]}</span>{" "}
            {m.roles[r].reasons.map((x, i) => (
              <span key={i}>
                {i > 0 && ", "}
                <ReasonView r={x} />
              </span>
            ))}
          </li>
        ))}
      </ul>
      <p className="small">
        <span className="label">성격</span> {m.nature ? m.nature.name : "추천 성격 미해금"} ·{" "}
        <span className="label">개체치</span> {o.ivTotal === 186 ? "6V" : o.ivs.join("/")}
      </p>
      {m.typeChange && <p className="small accent">타입 변화: {m.typeChange}</p>}
      {m.notes.length > 0 && (
        <ul className="small muted reasons">
          {m.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}
      {m.defenseNotes.length > 0 && <p className="small muted">{m.defenseNotes.join(" · ")}</p>}
    </div>
  );
}

const MULT_LABEL = (x: number) => (x === 0 ? "0" : x === 0.25 ? "¼" : x === 0.5 ? "½" : x === 1 ? "" : String(x));
const MULT_CLASS = (x: number) =>
  x === 0 ? "m-immune" : x < 1 ? "m-resist" : x >= 4 ? "m-quad" : x > 1 ? "m-weak" : "";

function TypeTable({ a, dex, typeBadge }: { a: PartyAnalysis; dex: Dex; typeBadge: (fid: number) => JSX.Element }) {
  return (
    <details className="type-table">
      <summary>받는 데미지 상성표 (특성·패시브 반영)</summary>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>공격 타입</th>
              {a.members.map((m) => (
                <th key={m.owned.speciesId}>
                  <Sprite species={m.form} size={40} />
                </th>
              ))}
              <th>약점</th>
              <th>반감·무효</th>
            </tr>
          </thead>
          <tbody>
            {a.typeTable.map((row) => (
              <tr key={row.type} className={row.weak >= 2 && row.weak > row.resist ? "danger" : ""}>
                <td>{typeBadge(row.type)}</td>
                {row.multipliers.map((x, i) => (
                  <td key={i} className={`mult ${MULT_CLASS(x)}`}>
                    {MULT_LABEL(Math.round(x * 100) / 100)}
                  </td>
                ))}
                <td className="num">{row.weak || ""}</td>
                <td className="num">{row.resist || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted">{dex.data.source.name} 데이터와 9세대 상성표 기준. 날씨·필드·테라스탈은 반영하지 않습니다.</p>
    </details>
  );
}
