import { useCallback, useEffect, useRef, useState } from "react";
import { fetchDex, type Dex, type DexSpecies } from "./lib/dex";
import { SpriteSelectContext } from "./components/Sprite";
import { SaveError, decryptSave } from "./lib/save";
import { buildSummary, ownerOf, type SaveSummary } from "./lib/starters";
import { SaveUpload } from "./components/SaveUpload";
import { StarterTable } from "./components/StarterTable";
import { SpeciesModal } from "./components/StarterModal";
import { Footer } from "./components/Footer";
import { ClassicRecommenderView } from "./components/ClassicRecommender";
import { InfoProvider } from "./components/InfoPopup";
import { Guide } from "./components/Guide";
import { ScrollTopButton } from "./components/ScrollTopButton";
import { PokedexView } from "./components/PokedexView";
import { PAGES, Sidebar, type Page } from "./components/Sidebar";
import { TrainersView } from "./components/TrainersView";
import { BiomesView } from "./components/BiomesView";
import { OfficialContext } from "./components/OfficialContext";
import { fetchOfficial, type Official } from "./lib/official";

const TITLES: Record<Page, string> = {
  recommend: "클래식 파티 추천",
  dex: "포켓몬 도감",
  trainers: "트레이너 도감",
  biomes: "바이옴 안내",
  owned: "보유 현황",
  guide: "가이드북",
};
/** 세이브가 있어야 쓸 수 있는 화면 */
const NEEDS_SAVE: Page[] = ["recommend", "owned"];

/** 브라우저 기록에 남기는 화면 상태. 뒤로가기를 누르면 이전 상태로 돌아간다 */
interface NavState {
  page: Page;
  /** 상세 화면에 띄운 형태 (Dex idx) */
  detail: number | null;
  /** 연달아 연 상세 화면 수. 닫을 때 이만큼 뒤로 간다 */
  depth: number;
}

function readNav(): NavState {
  const st = history.state as Partial<NavState> | null;
  const hash = location.hash.slice(1) as Page;
  return {
    page: st?.page ?? (PAGES.includes(hash) ? hash : "recommend"),
    detail: st?.detail ?? null,
    depth: st?.depth ?? 0,
  };
}

export default function App() {
  const [dex, setDex] = useState<Dex | null>(null);
  const [official, setOfficial] = useState<Official | null>(null);
  const [summary, setSummary] = useState<SaveSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nav, setNav] = useState<NavState>(readNav);

  useEffect(() => {
    fetchDex().then(setDex, (e: Error) => setError(e.message));
    fetchOfficial().then(setOfficial);
    history.replaceState(readNav(), "");
    const onPop = () => setNav(readNav());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // 기록 추가는 state 갱신 함수 밖에서 한다 (개발 모드의 StrictMode 는 갱신 함수를 두 번 실행한다)
  const navRef = useRef(nav);
  navRef.current = nav;
  const go = useCallback((next: Partial<NavState>) => {
    const cur = navRef.current;
    const state = { ...cur, ...next };
    if (state.page === cur.page && state.detail === cur.detail) return;
    state.depth = state.detail == null ? 0 : cur.detail != null ? cur.depth + 1 : 1;
    history.pushState(state, "", `#${state.page}`);
    navRef.current = state;
    setNav(state);
    if (state.page !== cur.page) window.scrollTo({ top: 0 });
  }, []);

  const closeDetail = useCallback(() => {
    // 상세 화면을 여러 개 이어서 열었어도, 닫으면 상세를 열기 전 화면으로 돌아간다
    const depth = navRef.current.depth;
    if (depth > 0) history.go(-depth);
    else setNav({ ...navRef.current, detail: null, depth: 0 });
  }, []);

  /** 사진을 누르면 그 형태의 상세 화면을 띄운다 (상세 화면 안에서 누르면 새 상세로 바뀐다) */
  const showSpecies = useCallback((s: DexSpecies) => go({ detail: s.idx }), [go]);

  async function handleFile(file: File) {
    if (!dex) return;
    setError(null);
    try {
      const save = decryptSave(await file.text());
      setSummary(buildSummary(save, dex));
    } catch (e) {
      setSummary(null);
      setError(e instanceof SaveError ? e.message : `세이브를 읽는 중 오류가 났습니다: ${(e as Error).message}`);
    }
  }

  const detail = nav.detail != null ? dex?.species[nav.detail] : undefined;
  const page = nav.page;

  return (
    <div className="layout">
      <Sidebar
        page={page}
        onSelect={(p) => go({ page: p, detail: null })}
        footer={
          summary ? (
            <span className="small">
              세이브 불러옴
              <br />
              <span className="muted">트레이너 {summary.trainerId}</span>
            </span>
          ) : (
            <span className="small muted">세이브 없음</span>
          )
        }
      />
      <main className="page">
        <header className="header">
          <h1>{TITLES[page]}</h1>
          {!summary && <p className="muted small">세이브 파일은 이 브라우저 안에서만 읽고, 서버로 보내지 않습니다.</p>}
        </header>

        {summary ? (
          // 세이브를 불러온 뒤에는 한 줄짜리 상태 줄만 남긴다
          <section className="save-bar" aria-label="불러온 세이브">
            <span>
              <b>트레이너 {summary.trainerId}</b>
            </span>
            <span>스타터 {summary.starters.length}종</span>
            <span>클래식 미클리어 {summary.starters.filter((s) => s.classicWins === 0).length}종</span>
            {summary.stats.highestEndlessWave != null && (
              <span>무한 최고 {summary.stats.highestEndlessWave.toLocaleString()}층</span>
            )}
            <span className="muted" title={`게임 ${summary.gameVersion}`}>
              {summary.savedAt.toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })} 저장
            </span>
            {summary.unmatched.length > 0 && (
              <span className="error">도감에 없는 스타터 {summary.unmatched.length}종</span>
            )}
            <SaveUpload disabled={!dex} onFile={handleFile} compact />
          </section>
        ) : (
          <SaveUpload disabled={!dex} onFile={handleFile} />
        )}
        {!dex && !error && <p className="muted">도감 데이터를 불러오는 중…</p>}
        {error && <p className="error">{error}</p>}

        {dex && (
          <OfficialContext.Provider value={official}>
          <SpriteSelectContext.Provider value={showSpecies}>
            <InfoProvider dex={dex}>
              {!summary && NEEDS_SAVE.includes(page) && (
                <p className="muted">세이브 파일을 올리면 이 화면을 쓸 수 있습니다.</p>
              )}
              {/* 화면을 모두 그려 두고 숨기기만 해서, 오가도 추천 결과·필터가 유지되게 한다 */}
              {summary && (
                <>
                  <div hidden={page !== "recommend"}>
                    <ClassicRecommenderView starters={summary.starters} dex={dex} status={summary.speciesStatus} />
                  </div>
                  <div hidden={page !== "owned"}>
                    <StarterTable starters={summary.starters} dex={dex} onOpen={(idx) => go({ detail: idx })} />
                  </div>
                </>
              )}
              <div hidden={page !== "dex"}>
                <PokedexView dex={dex} status={summary?.speciesStatus} onOpen={(idx) => go({ detail: idx })} />
              </div>
              <div hidden={page !== "trainers"}>
                <TrainersView dex={dex} />
              </div>
              <div hidden={page !== "biomes"}>
                <BiomesView dex={dex} status={summary?.speciesStatus} />
              </div>
              <div hidden={page !== "guide"}>
                <Guide />
              </div>
              {detail && (
                <SpeciesModal
                  key={detail.idx}
                  species={detail}
                  dex={dex}
                  owned={summary ? ownerOf(summary.starters, detail) : undefined}
                  status={summary?.speciesStatus}
                  onClose={closeDetail}
                />
              )}
            </InfoProvider>
          </SpriteSelectContext.Provider>
          </OfficialContext.Provider>
        )}

        <Footer dex={dex} />
      </main>
      <ScrollTopButton />
    </div>
  );
}
