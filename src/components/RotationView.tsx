// 로테이션: 날짜마다 바뀌는 알 뽑기 전설 픽업(달력)과 포켓러스 스타터(목록).
// 둘 다 게임과 같은 계산으로 어느 날짜든 미리 구한다. 날짜는 게임처럼 UTC 기준이다.
import { useMemo, useState } from "react";
import type { Dex } from "../lib/dex";
import { legendaryPickup, pokerusStarters } from "../lib/pokerus";
import { useOfficial } from "./OfficialContext";
import { Sprite } from "./Sprite";

interface Props {
  dex: Dex;
  /** 세이브의 보유 스타터 SpeciesId (없으면 보유 표시를 하지 않는다) */
  owned?: Set<number>;
}

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (n: number) => String(n).padStart(2, "0");

export function RotationView({ dex, owned }: Props) {
  const official = useOfficial();
  const now = new Date();
  const today = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`;
  const [month, setMonth] = useState({ y: now.getUTCFullYear(), m: now.getUTCMonth() });
  const [view, setView] = useState<"legend" | "pokerus">("legend");

  /** 이 달의 날짜별 전설 픽업·포켓러스 */
  const days = useMemo(() => {
    const count = new Date(Date.UTC(month.y, month.m + 1, 0)).getUTCDate();
    return Array.from({ length: count }, (_, i) => {
      const date = new Date(Date.UTC(month.y, month.m, i + 1));
      return {
        day: i + 1,
        key: `${month.y}-${pad(month.m + 1)}-${pad(i + 1)}`,
        weekday: date.getUTCDay(),
        legend: legendaryPickup(date, official?.data.legendaryGachaIds ?? []),
        pokerus: pokerusStarters(date, official?.data.starterIds ?? []),
      };
    });
  }, [month, official]);

  const move = (d: number) => setMonth(({ y, m }) => ({ y: y + Math.floor((m + d) / 12), m: (((m + d) % 12) + 12) % 12 }));
  const mon = (id: number | undefined, size: number) => {
    const sp = id == null ? undefined : dex.byId(id);
    if (!sp) return null;
    const miss = owned && !owned.has(sp.id);
    return (
      <span className={`rot-mon${miss ? " not-owned" : ""}`} title={owned ? (miss ? "미보유" : "보유") : undefined}>
        <Sprite species={sp} size={size} />
        <span className="small">{sp.name}</span>
      </span>
    );
  };

  if (!official?.data.legendaryGachaIds?.length) return <p className="muted">게임 데이터를 불러오는 중입니다.</p>;

  return (
    <section>
      <div className="filters">
        <span className="view-toggle" role="group" aria-label="로테이션 종류" style={{ marginLeft: 0 }}>
          <button className={view === "legend" ? "active" : ""} aria-pressed={view === "legend"} onClick={() => setView("legend")}>
            전설 픽업
          </button>
          <button className={view === "pokerus" ? "active" : ""} aria-pressed={view === "pokerus"} onClick={() => setView("pokerus")}>
            포켓러스
          </button>
        </span>
        <span className="rot-month">
          <button onClick={() => move(-1)} aria-label="이전 달">
            ◀
          </button>
          <strong>
            {month.y}년 {month.m + 1}월
          </strong>
          <button onClick={() => move(1)} aria-label="다음 달">
            ▶
          </button>
          <button onClick={() => setMonth({ y: now.getUTCFullYear(), m: now.getUTCMonth() })}>오늘</button>
        </span>
      </div>
      <p className="muted small">한국 시간 기준 오전 9시에 변경</p>

      {view === "legend" ? (
        <div className="rot-calendar">
          {WEEK.map((w) => (
            <div key={w} className="rot-week small muted">
              {w}
            </div>
          ))}
          {Array.from({ length: days[0].weekday }, (_, i) => (
            <div key={`e${i}`} />
          ))}
          {days.map((d) => (
            <div key={d.key} className={`rot-day${d.key === today ? " today" : ""}`}>
              <span className="small muted">{d.day}</span>
              {mon(d.legend, 48)}
            </div>
          ))}
        </div>
      ) : (
        <ul className="rot-list">
          {days.map((d) => (
            <li key={d.key} className={d.key === today ? "today" : ""}>
              <span className="rot-date">
                {month.m + 1}/{d.day} ({WEEK[d.weekday]})
              </span>
              <span className="rot-mons">
                {d.pokerus.map((id) => (
                  <span key={id}>{mon(id, 40)}</span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
