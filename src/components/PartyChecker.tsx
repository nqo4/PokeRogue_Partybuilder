// 내 파티 점검: 새 게임 스타터 고르기처럼 보유 스타터로 파티를 짜고(코스트 10 이하),
// 추천과 같은 기준으로 역할·약점을 점검한다. 결과 카드는 추천 결과(PartyCard)를 그대로 쓴다.
import { useMemo, useState } from "react";
import { typesInGameOrder, type Dex } from "../lib/dex";
import { pokerusStarters } from "../lib/pokerus";
import { useOfficial } from "./OfficialContext";
import type { FormStatus } from "../lib/starters";
import type { Candidate } from "../lib/classic/candidate";
import { findings } from "../lib/classic/check";
import { partyKey, type ClassicRecommender, type PartyRecommendation } from "../lib/classic/recommend";
import { Sprite } from "./Sprite";
import { CostValue } from "./CostValue";
import { SearchInput } from "./SearchInput";
import { PartyCard } from "./ClassicRecommender";
import { FORM_FILTERS, formMatch, type FormFilter } from "./StarterTable";

const PARTY_MAX = 6;

/** 파티에 넣은 포켓몬: 스타터(SpeciesId)와 고른 최종 형태(Dex idx) */
export interface PartyPick {
  id: number;
  form: number;
}

/** 게임 스타터 화면의 필터와 같은 묶음. 알 구매·사탕 수·개체값·포획/부화 횟수는 뺐다 */
type ShinyFilter = "all" | "t3" | "t2" | "t1" | "none";
/** 해금 조건 하나: 상관없음 / 해금함 / 안 함 */
type Tri = "all" | "yes" | "no";
const triOk = (t: Tri, v: boolean) => t === "all" || (t === "yes") === v;
type UnlockKey = "passive" | "reduced" | "hidden";
const UNLOCKS: [UnlockKey, string][] = [
  ["passive", "패시브"],
  ["reduced", "코스트 감소"],
  ["hidden", "숨겨진 특성"],
];
/** 진화·폼까지 포함한 가족 중 아직 못 잡은 형태 */
type DexFilter = "all" | "complete" | "seen" | "unseen";
type EtcFilter = "all" | "cleared" | "uncleared" | "pokerus";
type SortKey = "id" | "cost" | "name";

/** 오늘(UTC) 날짜 "YYYY-MM-DD". 게임의 포켓러스는 UTC 자정에 바뀐다 */
const todayUtc = () => new Date().toISOString().slice(0, 10);

export function PartyChecker({
  recommender,
  dex,
  status,
  typeBadge,
  onBuildFrom,
}: {
  recommender: ClassicRecommender;
  dex: Dex;
  status?: Record<number, FormStatus>;
  typeBadge: (fid: number) => JSX.Element;
  onBuildFrom: (picks: PartyPick[]) => void;
}) {
  const costLimit = recommender.cfg.raw.costLimit;
  const [picks, setPicks] = useState<PartyPick[]>([]);
  const [query, setQuery] = useState("");
  const [gen, setGen] = useState(0);
  const [type, setType] = useState(-1);
  const [shiny, setShiny] = useState<ShinyFilter>("all");
  const [unlock, setUnlock] = useState<Record<UnlockKey, Tri>>({ passive: "all", reduced: "all", hidden: "all" });
  const [form, setForm] = useState<FormFilter>("all");
  const [dexState, setDexState] = useState<DexFilter>("all");
  const [etc, setEtc] = useState<EtcFilter>("all");
  const [sort, setSort] = useState<SortKey>("id");
  const [desc, setDesc] = useState(false);
  const [pokerusDate, setPokerusDate] = useState(todayUtc);
  const official = useOfficial();
  /** 고른 날짜의 포켓러스 스타터 (게임과 같은 계산) */
  const pokerus = useMemo(() => {
    const ids = official?.data.starterIds;
    return ids?.length ? pokerusStarters(new Date(`${pokerusDate}T00:00:00Z`), ids) : [];
  }, [official, pokerusDate]);
  const [result, setResult] = useState<PartyRecommendation | null>(null);

  const members = picks.map((p) => recommender.candidate(p.id, p.form)).filter((c): c is Candidate => !!c);
  const cost = members.reduce((a, m) => a + m.owned.cost, 0);
  const luck = members.reduce((a, m) => a + m.owned.luck, 0);

  const list = useMemo(() => {
    const q = query.trim();
    const shinyOk = (m: number) =>
      shiny === "all" || (shiny === "none" ? m === 0 : !!(m & (shiny === "t3" ? 4 : shiny === "t2" ? 2 : 1)));
    const unlockOk = (c: Candidate) =>
      triOk(unlock.passive, c.owned.passive.unlocked) &&
      triOk(unlock.reduced, c.owned.costReductions > 0) &&
      // 숨겨진 특성이 없는 포켓몬은 "미해금"으로 치지 않는다
      (unlock.hidden === "all" || (!!c.owned.abilities.hidden && triOk(unlock.hidden, c.owned.abilities.hidden.unlocked)));
    const dexOk = (c: Candidate) => {
      if (dexState === "all") return true;
      const st = c.owned.family.map((f) => c.owned.formStatus[f.idx]);
      return dexState === "complete" ? st.every((s) => s === "caught") : st.includes(dexState);
    };
    const etcOk = (c: Candidate) =>
      etc === "all" ||
      (etc === "cleared" && c.owned.classicWins > 0) ||
      (etc === "uncleared" && c.owned.classicWins === 0) ||
      (etc === "pokerus" && pokerus.includes(c.owned.speciesId));
    const dir = desc ? -1 : 1;
    const value = (c: Candidate) => (sort === "cost" ? c.owned.cost : c.owned.speciesId);
    return [...recommender.candidates]
      .filter(
        (c) =>
          (!gen || c.owned.gen === gen) &&
          shinyOk(c.owned.shinyTiers) &&
          unlockOk(c) &&
          formMatch(c.owned.family, form) &&
          dexOk(c) &&
          etcOk(c) &&
          (!q || c.owned.name.includes(q) || c.owned.family.some((f) => f.name.includes(q))),
      )
      .sort((a, b) =>
        sort === "name"
          ? a.owned.name.localeCompare(b.owned.name, "ko") * dir
          : (value(a) - value(b)) * dir || a.owned.speciesId - b.owned.speciesId,
      );
  }, [recommender, query, gen, shiny, unlock, form, dexState, etc, sort, desc, pokerus]);

  /** 카드는 최종 형태 기준 (진화 갈래·메가진화·거다이맥스 등 형태마다 한 장). 타입은 그 형태의 타입으로 거른다 */
  const tiles = useMemo(
    () =>
      list.flatMap((c) =>
        recommender
          .forms(c.owned.speciesId)
          .filter((f) => type < 0 || f.types.includes(type))
          .map((f) => ({ c, f })),
      ),
    [list, recommender, type],
  );

  /** 넣을 수 없는 이유 (넣을 수 있으면 null) */
  const blocked = (c: Candidate): string | null =>
    picks.some((p) => p.id === c.owned.speciesId)
      ? "같은 포켓몬(다른 형태)이 이미 파티에 있음"
      : picks.length >= PARTY_MAX
        ? "6마리가 꽉 참"
        : cost + c.owned.cost > costLimit
          ? `코스트 초과 (${cost} + ${c.owned.cost} > ${costLimit})`
          : null;

  const change = (next: PartyPick[]) => {
    setPicks(next);
    setResult(null); // 파티가 바뀌면 이전 점검 결과는 지운다
  };

  const check = () => {
    const pool = recommender.candidates.filter((c) => c.owned.cost <= costLimit);
    setResult({
      key: `mine-${partyKey(members)}`,
      analysis: recommender.analyze(members),
      suggestions: recommender.suggest(members, pool, PARTY_MAX, PARTY_MAX),
    });
  };

  return (
    <div className="party-checker">
      <p className="small muted">
        새 게임에서 스타터를 고르듯 보유 포켓몬을 눌러 파티에 넣으세요. 코스트 합이 {costLimit}을 넘으면 넣을 수 없습니다.
        파티 칸을 누르면 뺍니다.
      </p>

      <ol className="my-party" aria-label="내 파티">
        {Array.from({ length: PARTY_MAX }, (_, i) => {
          const m = members[i];
          return (
            <li key={i}>
              {m ? (
                <button
                  type="button"
                  className="my-slot filled"
                  onClick={() => change(picks.filter((p) => p.id !== m.owned.speciesId))}
                  title={`${m.form.name} 빼기`}
                >
                  <Sprite species={m.form} size={48} />
                  <span className="my-slot-name">{m.form.name}</span>
                  <span className="small muted">
                    코스트 <CostValue cost={m.owned.cost} reductions={m.owned.costReductions} />
                    {m.owned.luck > 0 && <span className={`luck luck-${m.owned.luck}`}>럭 {m.owned.luck}</span>}
                  </span>
                </button>
              ) : (
                <span className="my-slot empty">빈 자리</span>
              )}
            </li>
          );
        })}
      </ol>

      <div className="my-party-bar">
        <span className={cost > costLimit ? "error" : ""}>
          코스트 <b>{cost}</b>/{costLimit}
        </span>
        <span>럭 합계 <b>{luck}</b></span>
        <span>{members.length}마리</span>
        <button className="primary" onClick={check} disabled={!members.length}>
          파티 점검
        </button>
        <button
          onClick={() => onBuildFrom(picks)}
          disabled={!members.length}
          title="고른 포켓몬을 넣고 나머지 자리를 파티 추천으로 채웁니다"
        >
          이 포켓몬으로 파티 만들기
        </button>
        {members.length > 0 && (
          <button className="link-button" onClick={() => change([])}>
            모두 비우기
          </button>
        )}
      </div>

      {result && (
        <>
          <section className="check-findings" aria-label="점검 결과">
            <h2>점검 결과</h2>
            <ul>
              {findings(result.analysis, costLimit, dex).map((f, i) => (
                <li key={i} className={`finding finding-${f.level}`}>
                  <span className="finding-tag">{f.level === "warn" ? "보완 필요" : f.level === "ok" ? "좋음" : "참고"}</span>
                  {f.text}
                </li>
              ))}
            </ul>
            <p className="small muted">
              아래 카드에서 포켓몬을 누르면 맡을 포지션 기준의 성격·특성·시작 기술을 볼 수 있고, 지도 경로 추천에서 바이옴 이동
              경로를 고를 수 있습니다.
            </p>
          </section>
          <PartyCard index={0} title="내 파티" rec={result} dex={dex} status={status} typeBadge={typeBadge} />
        </>
      )}

      <h2 className="picker-title">보유 포켓몬</h2>
      <div className="filters picker-filters">
        <SearchInput placeholder="이름 검색" value={query} onChange={setQuery} />
        <select value={gen} onChange={(e) => setGen(Number(e.target.value))} aria-label="세대">
          <option value={0}>세대: 전체</option>
          {Array.from({ length: 9 }, (_, i) => (
            <option key={i} value={i + 1}>
              {i + 1}세대
            </option>
          ))}
        </select>
        <select value={type} onChange={(e) => setType(Number(e.target.value))} aria-label="타입">
          <option value={-1}>타입: 전체</option>
          {typesInGameOrder(dex).map((t) => (
            <option key={t} value={t}>
              {dex.name(t)}
            </option>
          ))}
        </select>
        <select value={shiny} onChange={(e) => setShiny(e.target.value as ShinyFilter)} aria-label="포획 (이로치)">
          <option value="all">포획: 전체</option>
          <option value="t3">3럭 보유</option>
          <option value="t2">2럭 보유</option>
          <option value="t1">1럭 보유</option>
          <option value="none">기본 (이로치 없음)</option>
        </select>
        <select value={form} onChange={(e) => setForm(e.target.value as FormFilter)} aria-label="폼 변화">
          {FORM_FILTERS.map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
        <select value={dexState} onChange={(e) => setDexState(e.target.value as DexFilter)} aria-label="도감 상태">
          <option value="all">도감 상태: 전체</option>
          <option value="complete">모든 형태 해금</option>
          <option value="seen">미해금 형태 있음 (발견만)</option>
          <option value="unseen">미발견 형태 있음</option>
        </select>
        <select value={etc} onChange={(e) => setEtc(e.target.value as EtcFilter)} aria-label="기타">
          <option value="all">기타: 전체</option>
          <option value="cleared">클래식 클리어</option>
          <option value="uncleared">클래식 미클리어</option>
          <option value="pokerus">포켓러스 (고른 날짜)</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="정렬">
          <option value="id">정렬: 도감 번호</option>
          <option value="cost">정렬: 코스트</option>
          <option value="name">정렬: 이름</option>
        </select>
        <select value={desc ? "desc" : "asc"} onChange={(e) => setDesc(e.target.value === "desc")} aria-label="정렬 방향">
          <option value="asc">오름차순</option>
          <option value="desc">내림차순</option>
        </select>
        <span className="muted">{list.length}종 · 최종 형태 {tiles.length}개</span>
      </div>
      <div className="filters unlock-filters" role="group" aria-label="해금">
        <span className="label">해금</span>
        {UNLOCKS.map(([k, l]) => (
          <span key={k} className="unlock-item">
            {l}
            <span className="view-toggle" role="group" aria-label={l} style={{ marginLeft: 0 }}>
              {(["all", "yes", "no"] as const).map((t) => (
                <button
                  key={t}
                  className={unlock[k] === t ? "active" : ""}
                  aria-pressed={unlock[k] === t}
                  onClick={() => setUnlock({ ...unlock, [k]: t })}
                >
                  {t === "all" ? "전체" : t === "yes" ? "O" : "X"}
                </button>
              ))}
            </span>
          </span>
        ))}
      </div>

      <div className="pokerus-bar">
        <label>
          포켓러스 날짜{" "}
          <input type="date" value={pokerusDate} onChange={(e) => e.target.value && setPokerusDate(e.target.value)} />
        </label>
        <span className="muted small">UTC 자정(한국 시간 오전 9시)에 바뀝니다</span>
        <span className="pokerus-list">
          {pokerus.map((id) => {
            const c = recommender.candidate(id);
            const sp = dex.byId(id);
            return (
              <span key={id} className={`pokerus-mon${c ? "" : " not-owned"}`} title={c ? "보유" : "미보유"}>
                {sp && <Sprite species={sp} size={32} />}
                <span className="small">{sp?.name ?? id}</span>
              </span>
            );
          })}
        </span>
      </div>

      <div className="grid-view picker-grid">
        {tiles.map(({ c, f }) => {
          const id = c.owned.speciesId;
          const why = blocked(c);
          const inParty = picks.some((p) => p.id === id && p.form === f.idx);
          return (
            <button
              key={`${c.owned.dex.idx}:${f.idx}`}
              className={`tile${inParty ? " picked" : ""}`}
              disabled={!!why && !inParty}
              aria-pressed={inParty}
              title={why ?? `${f.name} 파티에 넣기`}
              onClick={() => change(inParty ? picks.filter((p) => p.id !== id) : [...picks, { id, form: f.idx }])}
            >
              <Sprite species={f} size={48} />
              <span className="tile-name">{f.name}</span>
              {f !== c.owned.dex && <span className="small muted">{c.owned.name}에서</span>}
              {pokerus.includes(c.owned.speciesId) && (
                <span className="pokerus-tag" title="고른 날짜의 포켓러스 포켓몬">
                  포켓러스
                </span>
              )}
              <span className="small muted">
                코스트 <CostValue cost={c.owned.cost} reductions={c.owned.costReductions} />
                {c.owned.luck > 0 && <span className={`luck luck-${c.owned.luck}`}>럭 {c.owned.luck}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
