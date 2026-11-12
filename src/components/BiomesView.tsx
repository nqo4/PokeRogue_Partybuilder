// 바이옴 안내: 다음 바이옴, 날씨, 출현 포켓몬(등급별 확률), 트레이너·관장
import { useState } from "react";
import { typeStyle } from "../lib/color";
import type { Dex } from "../lib/dex";
import { BOSS_TIER_CHANCE, TIER_NAMES, TIME_NAMES, TYPE_KEY_KO, WILD_TIER_CHANCE, type Biome } from "../lib/official";
import type { FormStatus } from "../lib/starters";
import { evaluateBiome } from "../lib/route";
import { Sprite } from "./Sprite";
import { useOfficial } from "./OfficialContext";
import { BiomeMap } from "./BiomeMap";

const WEATHER_KO: Record<string, string> = {
  NONE: "맑음(없음)", SUNNY: "쾌청", RAIN: "비", SANDSTORM: "모래바람", HAIL: "싸라기눈", SNOW: "눈", FOG: "안개",
  HEAVY_RAIN: "강한 비", HARSH_SUN: "아주 강한 햇살", STRONG_WINDS: "난기류",
};
const pct = (x: number) => (x >= 0.1 ? `${(x * 100).toFixed(0)}%` : `${(x * 100).toFixed(1)}%`);

export function BiomesView({ dex, status }: { dex: Dex; status?: Record<number, FormStatus> }) {
  const official = useOfficial();
  const [selected, setSelected] = useState<number | null>(null);
  const [view, setView] = useState<"info" | "map">("info");
  if (!official) return <p className="muted">공식 게임 데이터(official.json)가 없습니다.</p>;

  const biomes = official.data.biomes;
  const cur = official.biomeById.get(selected ?? biomes[0].id)!;
  const ev = evaluateBiome(cur, dex, official, status, null);

  const toggle = (
    <div className="filters">
      <span className="view-toggle" style={{ marginLeft: 0 }}>
        <button className={view === "map" ? "active" : ""} onClick={() => setView("map")}>
          지도
        </button>
        <button className={view === "info" ? "active" : ""} onClick={() => setView("info")}>
          바이옴 정보
        </button>
      </span>
    </div>
  );

  if (view === "map") {
    return (
      <>
        {toggle}
        <BiomeMap
          official={official}
          selected={cur.id}
          onSelect={(id) => {
            setSelected(id);
            setView("info");
            window.scrollTo({ top: 0 });
          }}
        />
      </>
    );
  }

  return (
    <>
    {toggle}
    <section className="biome-layout">
      <nav className="biome-list">
        {biomes.map((b) => (
          <button key={b.id} className={b.id === cur.id ? "active" : ""} onClick={() => setSelected(b.id)}>
            {b.name}
          </button>
        ))}
      </nav>
      <div className="biome-detail">
        <h2>{cur.name}</h2>
        <p>
          <span className="label">다음 바이옴</span>{" "}
          {cur.links.length ? (
            cur.links.map((l, i) => (
              <span key={l.to}>
                {i > 0 && " · "}
                <button className="link-button" onClick={() => setSelected(l.to)}>
                  {official.biomeById.get(l.to)?.name ?? l.to}
                </button>
                {l.chance < 1 && <span className="muted small"> ({pct(l.chance)} 확률로 선택지에 등장)</span>}
              </span>
            ))
          ) : (
            <span className="muted">없음</span>
          )}
        </p>
        <p className="small">
          <span className="label">날씨</span>{" "}
          {(() => {
            const total = cur.weather.reduce((a, w) => a + w.weight, 0);
            return cur.weather.map((w) => `${WEATHER_KO[w.key] ?? w.key} ${pct(w.weight / total)}`).join(" · ");
          })()}
          {status && (
            <>
              {" · "}
              <span className="label">못 잡은 포켓몬이 나올 확률</span> <b>{pct(ev.newChance)}</b>
            </>
          )}
        </p>

        <BiomeTrainers biome={cur} dex={dex} />

        <h3>야생 포켓몬</h3>
        <PoolTable biome={cur} dex={dex} status={status} boss={false} />
        <h3>보스 포켓몬 (10웨이브마다)</h3>
        <PoolTable biome={cur} dex={dex} status={status} boss={true} />
        <p className="small muted">
          등급 확률은 게임 코드의 추첨 범위 그대로입니다. 같은 등급 안에서는 그 시간대에 나오는 포켓몬 중 하나가 고르게 뽑힙니다.
          시간대 표시가 없는 포켓몬은 언제나 나옵니다. 출처: {official.data.source.name} {official.data.source.gameVersion}
        </p>
      </div>
    </section>
    </>
  );
}

function BiomeTrainers({ biome, dex }: { biome: Biome; dex: Dex }) {
  const official = useOfficial()!;
  const typeBadge = (key: string | null) => {
    const fid = dex.fid("type", TYPE_KEY_KO[key ?? ""] ?? "");
    return fid < 0 ? null : (
      <span className="type" style={typeStyle(dex.data.typeColors[fid])}>
        {dex.name(fid)}
      </span>
    );
  };
  const bosses = biome.trainers.filter((t) => t.tier.startsWith("BOSS")).flatMap((t) => t.trainers);
  return (
    <>
      {bosses.length > 0 && (
        <p>
          <span className="label">체육관 관장</span>{" "}
          {bosses.map((t, i) => {
            const tr = official.trainerByType.get(t.type);
            return (
              <span key={t.type}>
                {i > 0 && " · "}
                {t.name} {typeBadge(tr?.specialty ?? null)}
              </span>
            );
          })}
        </p>
      )}
    </>
  );
}

function PoolTable({
  biome,
  dex,
  status,
  boss,
}: {
  biome: Biome;
  dex: Dex;
  status?: Record<number, FormStatus>;
  boss: boolean;
}) {
  const chances = boss ? BOSS_TIER_CHANCE : WILD_TIER_CHANCE;
  const pools = biome.pokemon.filter((p) => chances[p.tier] != null && p.species.length);
  if (!pools.length) return <p className="muted small">없음</p>;
  return (
    <div className="pool-table">
      {pools.map((p) => {
        // 같은 포켓몬이 여러 시간대에 있으면 한 번만, 시간대를 모아서 보여준다
        const byId = new Map<number, string[]>();
        for (const s of p.species) {
          const times = byId.get(s.id) ?? [];
          if (s.time !== "ALL") times.push(TIME_NAMES[s.time]);
          byId.set(s.id, times);
        }
        return (
          <div key={p.tier} className="pool-row">
            <div className="pool-tier">
              <b>{TIER_NAMES[p.tier]}</b>
              <span className="muted small">{pct(chances[p.tier]!)}</span>
            </div>
            <div className="pool-species">
              {[...byId].map(([id, times]) => {
                const s = dex.byId(id);
                if (!s) return null;
                const st = status?.[s.idx];
                return (
                  <span key={id} className={`pool-mon${st && st !== "caught" ? ` dim-${st}` : ""}`}>
                    <Sprite species={s} size={40} />
                    <span className="small">{s.name}</span>
                    {times.length > 0 && <span className="small muted">{times.join("·")}</span>}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
