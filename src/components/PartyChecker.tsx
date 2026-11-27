// 내 파티 점검: 새 게임 스타터 고르기처럼 보유 스타터로 파티를 짜고(코스트 10 이하),
// 추천과 같은 기준으로 역할·약점을 점검한다. 결과 카드는 추천 결과(PartyCard)를 그대로 쓴다.
import { useEffect, useMemo, useState } from "react";
import { typesInGameOrder, type Dex, type DexSpecies } from "../lib/dex";
import { pokerusStarters } from "../lib/pokerus";
import { useOfficial } from "./OfficialContext";
import type { FormStatus, OwnedStarter } from "../lib/starters";
import { CLASSIC, cleared, type ClearCriterion } from "../lib/ribbons";
import { GameKindButton, useChallengeWarning } from "./ClearCriterionDialog";
import type { Candidate } from "../lib/classic/candidate";
import { findings } from "../lib/classic/check";
import { partyKey, type PartyRecommendation } from "../lib/classic/recommend";
import { Sprite } from "./Sprite";
import { CostValue } from "./CostValue";
import { SearchInput } from "./SearchInput";
import { PartyCard, type RecommenderFor } from "./ClassicRecommender";
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
type ClearFilter = "all" | "cleared" | "uncleared";
type EtcFilter = "all" | "pokerus";
type SortKey = "id" | "cost" | "name";

/** 오늘(UTC) 날짜 "YYYY-MM-DD". 게임의 포켓러스는 UTC 자정에 바뀐다 */
const todayUtc = () => new Date().toISOString().slice(0, 10);

export function PartyChecker({
  recommenderFor,
  starters,
  dex,
  status,
  typeBadge,
  onBuildFrom,
}: {
  recommenderFor: RecommenderFor;
  starters: OwnedStarter[];
  dex: Dex;
  status?: Record<number, FormStatus>;
  typeBadge: (fid: number) => JSX.Element;
  onBuildFrom: (picks: PartyPick[], criterion: ClearCriterion) => void;
}) {
  /** 게임 종류. 챌린지면 도전할 수 있는 스타터만 보이고, 형태도 챌린지에 맞는 것만 고른다 */
  const [criterion, setCriterion] = useState<ClearCriterion>(CLASSIC);
  const recommender = recommenderFor(criterion)!;
  const warn = useChallengeWarning(dex, criterion);
  const ownedIds = useMemo(() => new Set(starters.map((s) => s.speciesId)), [starters]);
  const costLimit = recommender.cfg.raw.costLimit;
  const [picks, setPicks] = useState<PartyPick[]>([]);
  const [clear, setClear] = useState<ClearFilter>("all");
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
    const clearOk = (c: Candidate) => clear === "all" || (clear === "cleared") === cleared(c.owned, criterion, dex);
    const etcOk = (c: Candidate) => etc === "all" || pokerus.includes(c.owned.speciesId);
    const dir = desc ? -1 : 1;
    const value = (c: Candidate) => (sort === "cost" ? c.owned.cost : c.owned.speciesId);
    return [...recommender.candidates]
      .filter(
        (c) =>
          // 세대·타입 챌린지를 고르면 같은 종류의 필터는 숨기고 적용하지 않는다
          (!gen || criterion.mode === "gen" || c.owned.gen === gen) &&
          clearOk(c) &&
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
  }, [recommender, dex, criterion, clear, query, gen, shiny, unlock, form, dexState, etc, sort, desc, pokerus]);

  /** 카드는 스타터 기준. 타입은 진화형·폼 변화까지 포함해서 거른다 */
  const tiles = useMemo(
    () => list.filter((c) => type < 0 || criterion.mode === "type" || recommender.forms(c.owned.speciesId).some((f) => f.types.includes(type))),
    [list, recommender, criterion, type],
  );
  /** 진화형을 고르는 중인 스타터 */
  const [choosing, setChoosing] = useState<Candidate | null>(null);
  const add = (c: Candidate, form: number) => change([...picks, { id: c.owned.speciesId, form }]);

  /** 넣을 수 없는 이유 (넣을 수 있으면 null) */
  const blocked = (c: Candidate): string | null =>
    picks.some((p) => p.id === c.owned.speciesId)
      ? "같은 포켓몬(다른 형태)이 이미 파티에 있음"
      : picks.length >= PARTY_MAX
        ? "6마리가 꽉 참"
        : cost + c.owned.cost > costLimit
          ? `코스트 초과 (${cost} + ${c.owned.cost} > ${costLimit})`
          : null;

  /** 게임 종류를 바꾸면, 그 게임에 나갈 수 없는 포켓몬은 파티에서 빼고 맞지 않는 형태는 맞는 형태로 바꾼다 */
  const changeCriterion = (c: ClearCriterion) => {
    const next = recommenderFor(c);
    setCriterion(c);
    if (!next) return;
    change(
      picks.flatMap((p) => {
        const cand = next.candidate(p.id);
        if (!cand) return [];
        return [{ id: p.id, form: next.forms(p.id).some((f) => f.idx === p.form) ? p.form : cand.form.idx }];
      }),
    );
  };

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
                  <Sprite species={m.form} size={48} warning={warn(m.owned)} />
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
          onClick={() => onBuildFrom(picks, criterion)}
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
          </section>
          <PartyCard index={0} title="내 파티" rec={result} dex={dex} status={status} typeBadge={typeBadge} warn={warn} />
        </>
      )}

      <h2 className="picker-title">보유 포켓몬</h2>
      <div className="filters picker-filters">
        <SearchInput placeholder="이름 검색" value={query} onChange={setQuery} />
        <select value={clear} onChange={(e) => setClear(e.target.value as ClearFilter)} aria-label="클리어 여부">
          <option value="all">클리어 여부: 전체</option>
          <option value="cleared">클리어</option>
          <option value="uncleared">미클리어</option>
        </select>
        <GameKindButton dex={dex} starters={starters} value={criterion} onChange={changeCriterion} />
        {criterion.mode !== "gen" && (
          <select value={gen} onChange={(e) => setGen(Number(e.target.value))} aria-label="세대">
            <option value={0}>세대: 전체</option>
            {Array.from({ length: 9 }, (_, i) => (
              <option key={i} value={i + 1}>
                {i + 1}세대
              </option>
            ))}
          </select>
        )}
        {criterion.mode !== "type" && (
          <select value={type} onChange={(e) => setType(Number(e.target.value))} aria-label="타입">
            <option value={-1}>타입: 전체</option>
            {typesInGameOrder(dex).map((t) => (
              <option key={t} value={t}>
                {dex.name(t)}
              </option>
            ))}
          </select>
        )}
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
        <span className="muted">{tiles.length}종</span>
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
            const owned = ownedIds.has(id);
            const sp = dex.byId(id);
            return (
              <span key={id} className={`pokerus-mon${owned ? "" : " not-owned"}`} title={owned ? "보유" : "미보유"}>
                {sp && <Sprite species={sp} size={32} />}
                <span className="small">{sp?.name ?? id}</span>
              </span>
            );
          })}
        </span>
      </div>

      <div className="grid-view picker-grid">
        {tiles.map((c) => {
          const id = c.owned.speciesId;
          const pick = picks.find((p) => p.id === id);
          const inParty = !!pick;
          const why = inParty ? null : blocked(c);
          const picked = pick && recommender.forms(id).find((f) => f.idx === pick.form);
          return (
            <button
              key={c.owned.dex.idx}
              className={`tile${inParty ? " picked" : ""}`}
              disabled={!!why}
              aria-pressed={inParty}
              title={why ?? (inParty ? `${c.owned.name} 빼기` : `${c.owned.name} 진화형 골라서 넣기`)}
              onClick={() => {
                if (inParty) return change(picks.filter((p) => p.id !== id));
                const forms = recommender.forms(id);
                if (forms.length === 1) add(c, forms[0].idx);
                else setChoosing(c);
              }}
            >
              <Sprite species={c.owned.dex} size={48} warning={warn(c.owned)} />
              <span className="tile-name">{c.owned.name}</span>
              {picked && picked !== c.owned.dex && <span className="small">→ {picked.name}</span>}
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
      {choosing && (
        <EvolutionPicker
          c={choosing}
          forms={recommender.forms(choosing.owned.speciesId)}
          typeBadge={typeBadge}
          onPick={(form) => {
            add(choosing, form);
            setChoosing(null);
          }}
          onClose={() => setChoosing(null)}
        />
      )}
    </div>
  );
}

/** 스타터를 눌렀을 때 쓸 진화형(메가진화·거다이맥스 등 포함)을 고르는 창 */
function EvolutionPicker({
  c,
  forms,
  typeBadge,
  onPick,
  onClose,
}: {
  c: Candidate;
  forms: DexSpecies[];
  typeBadge: (fid: number) => JSX.Element;
  onPick: (formIdx: number) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal evo-picker" role="dialog" aria-modal="true" aria-labelledby="evo-title">
        <header className="modal-head">
          <h2 id="evo-title">{c.owned.name}: 진화형 고르기</h2>
          <button className="modal-close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </header>
        <p className="muted small">파티에서 쓸 형태를 고르세요</p>
        <div className="grid-view picker-grid">
          {forms.map((f, i) => {
            const st = c.owned.formStatus[f.idx];
            return (
            <button
              key={f.idx}
              className={`tile${st && st !== "caught" ? ` dim-${st}` : ""}`}
              title={st === "unseen" ? "미발견" : st === "seen" ? "미포획 (발견만)" : undefined}
              autoFocus={i === 0}
              onClick={() => onPick(f.idx)}
            >
              <Sprite species={f} size={56} />
              <span className="tile-name">{f.name}</span>
              <span>{f.types.map(typeBadge)}</span>
              <span className="small muted">
                종족값 {f.bst}
                {st === "unseen" ? " · 미발견" : st === "seen" ? " · 미포획" : ""}
              </span>
            </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
