// 사용자 통계: 플레이 기록, 이로치 단계 수집, 스타터 포획·육성, 도감, 알.
import { useMemo } from "react";
import type { Dex } from "../lib/dex";
import type { SaveSummary } from "../lib/starters";
import { computeStats, formatPlayTime, type Progress } from "../lib/stats";
import { ShinyIcon } from "./ShinyTiers";

const n = (x: number | undefined) => (x ?? 0).toLocaleString("ko-KR");

/** 진행 막대 한 줄: 이름, 막대, 수치 */
function Bar({ label, value, icon }: { label: string; value: Progress; icon?: JSX.Element }) {
  const pct = value.total ? (value.have / value.total) * 100 : 0;
  return (
    <div className="stat-bar">
      <span className="stat-bar-label">
        {icon}
        {label}
      </span>
      <span
        className="stat-bar-track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={value.total}
        aria-valuenow={value.have}
      >
        <span className="stat-bar-fill" style={{ width: `${pct}%` }} />
      </span>
      <span className="stat-bar-num">
        {n(value.have)} / {n(value.total)} <span className="muted">({pct.toFixed(1)}%)</span>
      </span>
    </div>
  );
}

/** 이름-값 목록 */
function Facts({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="stat-facts">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function StatsView({ summary, dex }: { summary: SaveSummary; dex: Dex }) {
  const s = useMemo(() => computeStats(summary, dex), [summary, dex]);
  const g = summary.stats;
  const owned = summary.starters.length;

  return (
    <div className="stats">
      <section className="stat-section">
        <h2>플레이 기록</h2>
        <Facts
          rows={[
            ["총 플레이 시간", formatPlayTime(s.playTimeSec)],
            ["전투", `${n(g.battles)}회`],
            ["클래식 플레이", `${n(g.classicSessionsPlayed)}판`],
            ["승리한 판 (전체 모드)", `${n(g.sessionsWon)}판`],
            ["무한 모드 플레이", `${n(g.endlessSessionsPlayed)}판 · 최고 ${n(g.highestEndlessWave)}웨이브`],
            ["데일리 런", `${n(g.dailyRunSessionsPlayed)}판 · 승리 ${n(g.dailyRunSessionsWon)}판`],
            ["쓰러뜨린 포켓몬", `${n(g.pokemonDefeated)}마리`],
            ["쓰러뜨린 트레이너", `${n(g.trainersDefeated)}명`],
            ["최고 레벨", n(g.highestLevel)],
            ["최고 데미지", n(g.highestDamage)],
          ]}
        />
      </section>

      <section className="stat-section">
        <h2>이로치 수집 (종 기준)</h2>
        <Bar label="1럭" value={s.shiny.t1} icon={<ShinyIcon tier={0} owned />} />
        <Bar label="2럭" value={s.shiny.t2} icon={<ShinyIcon tier={1} owned />} />
        <Bar label="3럭" value={s.shiny.t3} icon={<ShinyIcon tier={2} owned />} />
        <Bar label="모든 단계 완성" value={s.shiny.complete} />
        <p className="small muted">
          1럭은 모든 종, 2·3럭은 2·3럭이 있는 종({n(s.shiny.t2.total)}종)만 셉니다. 3럭을 잡으면 1럭도 등록된 것으로 칩니다.
        </p>
        <Facts
          rows={[
            ["이로치 포획", `${n(g.shinyPokemonCaught)}마리`],
            ["이로치 부화", `${n(g.shinyPokemonHatched)}마리`],
            ["이로치 발견", `${n(g.shinyPokemonSeen)}마리`],
          ]}
        />
      </section>

      <section className="stat-section">
        <h2>스타터 포획</h2>
        <Bar label="전체" value={s.starters} />
        {s.startersByGen.map((x) => (
          <Bar key={x.gen} label={`${x.gen}세대`} value={{ have: x.have, total: x.total }} />
        ))}
        <h3>보유 스타터 육성 ({n(owned)}종 중)</h3>
        <Bar label="클래식 클리어" value={{ have: s.growth.classicCleared, total: owned }} />
        <Bar label="패시브 해금" value={{ have: s.growth.passive, total: owned }} />
        <Bar label="알기술 4개 해금" value={{ have: s.growth.allEggMoves, total: owned }} />
        <Bar
          label="숨겨진 특성 해금"
          value={{ have: s.growth.hiddenAbility, total: summary.starters.filter((x) => x.abilities.hidden).length }}
        />
        <Bar label="개체치 6V" value={{ have: s.growth.sixV, total: owned }} />
      </section>

      <section className="stat-section">
        <h2>도감 (메가·폼 포함 {n(s.forms.total)}개 형태)</h2>
        <Bar label="잡음" value={{ have: s.forms.caught, total: s.forms.total }} />
        <Bar label="잡았거나 발견" value={{ have: s.forms.caught + s.forms.seen, total: s.forms.total }} />
        <Facts
          rows={[
            ["전설 포켓몬", `포획 ${n(g.legendaryPokemonCaught)} · 부화 ${n(g.legendaryPokemonHatched)} · 발견 ${n(g.legendaryPokemonSeen)}`],
            ["준전설 포켓몬", `포획 ${n(g.subLegendaryPokemonCaught)} · 부화 ${n(g.subLegendaryPokemonHatched)} · 발견 ${n(g.subLegendaryPokemonSeen)}`],
            ["환상 포켓몬", `포획 ${n(g.mythicalPokemonCaught)} · 부화 ${n(g.mythicalPokemonHatched)} · 발견 ${n(g.mythicalPokemonSeen)}`],
            ["포켓몬 포획·발견", `포획 ${n(g.pokemonCaught)} · 발견 ${n(g.pokemonSeen)}`],
          ]}
        />
      </section>

      <section className="stat-section">
        <h2>알</h2>
        <Facts
          rows={[
            ["뽑은 알", `${n(g.eggsPulled)}개`],
            ["희귀 · 에픽 · 전설 알", `${n(g.rareEggsPulled)} · ${n(g.epicEggsPulled)} · ${n(g.legendaryEggsPulled)}`],
            ["마나피 알", `${n(g.manaphyEggsPulled)}개`],
            ["부화한 포켓몬", `${n(g.pokemonHatched)}마리`],
          ]}
        />
      </section>
    </div>
  );
}
