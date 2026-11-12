// 트레이너 도감: 악의 조직별(간부·보스), 리그별(사천왕·챔피언), 바이옴별 관장
import { useMemo, useState } from "react";
import { typeStyle } from "../lib/color";
import type { Dex } from "../lib/dex";
import {
  EVIL_TEAMS,
  GYM_WAVES,
  REGIONS,
  TYPE_KEY_KO,
  baseLevelForWave,
  type Official,
  type Trainer,
  type TrainerSlot,
} from "../lib/official";
import { Sprite } from "./Sprite";
import { useOfficial } from "./OfficialContext";

type Section = "evil" | "league" | "gym";
const E4_KEYS = ["ELITE_FOUR_1", "ELITE_FOUR_2", "ELITE_FOUR_3", "ELITE_FOUR_4"];

/** 고정 배틀 웨이브의 i 번째 칸에 나오는 트레이너들 */
function waveSlot(official: Official, key: string, i: number): string[] {
  return official.data.fixedWaves.find((w) => w.key === key)?.trainers[i] ?? [];
}

export function TrainersView({ dex }: { dex: Dex }) {
  const official = useOfficial();
  const [section, setSection] = useState<Section>("evil");
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");

  const typeBadge = (key: string | null) => {
    if (!key) return null;
    const fid = dex.fid("type", TYPE_KEY_KO[key] ?? "");
    if (fid < 0) return null;
    return (
      <span className="type" style={typeStyle(dex.data.typeColors[fid])}>
        {dex.name(fid)}
      </span>
    );
  };

  const gymByBiome = useMemo(() => {
    if (!official) return [];
    const q = query.trim();
    return official.data.biomes
      .map((b) => ({
        biome: b,
        leaders: b.trainers
          .find((t) => t.tier === "BOSS")
          ?.trainers.map((t) => official.trainerByType.get(t.type))
          .filter((t): t is Trainer => !!t && (!q || t.name.includes(q)) && (!type || t.specialty === type)) ?? [],
      }))
      .filter((x) => x.leaders.length);
  }, [official, query, type]);

  if (!official) {
    return <p className="muted">공식 게임 데이터(official.json)가 없습니다. npm run export:official 로 만들 수 있습니다.</p>;
  }

  /** 한 자리: 후보 스프라이트(폼 반영) + 보스/에이스 표시 */
  const slotView = (s: { species: number[]; forms?: number[]; boss?: boolean }, i: number, ace = false) => {
    const mons = s.species
      .flatMap((id) => (s.forms?.length ? s.forms.map((f) => dex.form(id, f)) : [dex.byId(id)]))
      .filter((m) => !!m);
    const multi = mons.length > 1;
    return (
      <span
        key={i}
        className={`party-slot${ace ? " ace" : ""}${multi ? " multi" : ""}`}
        title={multi ? `이 중 한 마리: ${mons.map((m) => m!.name).join(", ")}` : undefined}
      >
        {multi && <span className="pick-label">택1</span>}
        {mons.map((m, mi) => (
          <span key={`${m!.idx}-${mi}`} className="pick">
            {mi > 0 && <span className="pick-sep">/</span>}
            <Sprite species={m!} size={40} />
          </span>
        ))}
        {(s.boss || ace) && (
          <span className="slot-tags">
            {ace && <span className="tag ace-tag">에이스</span>}
            {s.boss && <span className="tag boss-tag">보스</span>}
          </span>
        )}
      </span>
    );
  };

  const party = (t: Trainer, opts?: { ace?: boolean }) => {
    const rows: TrainerSlot[] = t.slots.length
      ? [...t.slots].sort((a, b) => a.slot - b.slot)
      : (t.signature ?? []).map((species, i) => ({ slot: i, species }));
    const last = rows.length - 1;
    return <div className="trainer-party">{rows.map((s, i) => slotView(s, i, !!opts?.ace && i === last))}</div>;
  };

  const card = (t: Trainer, extra?: string, note?: string, opts?: { ace?: boolean }) => (
    <article key={t.type} className="trainer-card">
      <header>
        <b>{t.name}</b> {typeBadge(t.specialty)}
        {extra && <span className="muted small"> {extra}</span>}
      </header>
      {party(t, opts)}
      {note && <p className="small muted">{note}</p>}
      {!note && t.signature && !t.slots.length && (
        <p className="small muted">대표 포켓몬 (나머지는 전문 타입에서 무작위). 점선 「택1」 칸은 그중 한 마리가 나옵니다.</p>
      )}
    </article>
  );

  const byType = (types: string[]) =>
    types.map((x) => official.trainerByType.get(x)).filter((x): x is Trainer => !!x);

  // ── 악의 조직 하나: 보스(1·2차전) + 간부(주 포켓몬) ─────────────
  const teamBlock = (i: number) => {
    const team = EVIL_TEAMS[i];
    // 간부: 66·114·164 웨이브 칸에 나오는 사람을 모아 등장 웨이브를 붙인다
    const adminWaves = new Map<string, number[]>();
    for (const key of ["EVIL_ADMIN_1", "EVIL_ADMIN_2", "EVIL_ADMIN_3"]) {
      const w = official.data.fixedWaves.find((x) => x.key === key);
      for (const a of w?.trainers[i] ?? []) adminWaves.set(a, [...(adminWaves.get(a) ?? []), w!.wave]);
    }
    const boss1 = byType(waveSlot(official, "EVIL_BOSS_1", i));
    const boss2 = byType(waveSlot(official, "EVIL_BOSS_2", i));
    return (
      <div key={team.name} className="trainer-group evil-team">
        <h2>
          {team.name} <span className="muted small">({team.gens.join("·")}세대)</span>
        </h2>
        <h3>간부</h3>
        <div className="trainer-grid">
          {[...adminWaves].map(([type, waves]) => {
            const t = official.trainerByType.get(type);
            if (!t) return null;
            return card(t, `· ${waves.join("·")}웨이브`, "주 포켓몬 (마지막 칸이 에이스)", { ace: true });
          })}
        </div>
        <h3>보스</h3>
        <div className="trainer-grid">
          {boss1.map((t) => card(t, "· 1차전 115웨이브", "6마리 모두 고정입니다. 점선 「택1」 칸은 그중 한 마리가 나옵니다."))}
          {boss2.map((t) => card(t, "· 2차전 165웨이브", "6마리 모두 고정입니다. 점선 「택1」 칸은 그중 한 마리가 나옵니다."))}
        </div>
      </div>
    );
  };

  // ── 리그 하나: 사천왕 4명(자리별) + 챔피언 ─────────────────
  const leagueBlock = (i: number) => {
    const region = REGIONS[i];
    const alt = (list: string[]) => (list.length > 1 ? ` · ${list.map((x) => official.trainerName(x)).join(" 또는 ")}` : "");
    const champs = waveSlot(official, "CHAMPION", i);
    return (
      <div key={region.name} className="trainer-group evil-team">
        <h2>
          {region.name} 리그 <span className="muted small">({region.gen}세대)</span>
        </h2>
        <h3>사천왕</h3>
        <div className="trainer-grid">
          {E4_KEYS.flatMap((k, n) => {
            const list = waveSlot(official, k, i);
            const wave = official.data.fixedWaves.find((w) => w.key === k)?.wave ?? 0;
            return byType(list).map((t) => card(t, `· ${n + 1}번째 (${wave}웨이브, 레벨 약 ${baseLevelForWave(wave)})${alt(list)}`));
          })}
        </div>
        <h3>챔피언</h3>
        <div className="trainer-grid">
          {byType(champs).map((t) => card(t, `· 190웨이브, 레벨 약 ${baseLevelForWave(190)}${alt(champs)}`))}
        </div>
      </div>
    );
  };

  return (
    <section>
      <div className="filters">
        <span className="view-toggle" style={{ marginLeft: 0 }}>
          <button className={section === "evil" ? "active" : ""} onClick={() => setSection("evil")}>
            악의 조직
          </button>
          <button className={section === "league" ? "active" : ""} onClick={() => setSection("league")}>
            사천왕·챔피언
          </button>
          <button className={section === "gym" ? "active" : ""} onClick={() => setSection("gym")}>
            바이옴별 관장
          </button>
        </span>
        {section === "gym" && (
          <>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">전체 타입</option>
              {Object.entries(TYPE_KEY_KO).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <input placeholder="관장 이름" value={query} onChange={(e) => setQuery(e.target.value)} />
          </>
        )}
      </div>

      {section === "evil" && (
        <>
          <p className="small muted">
            한 판에 아래 조직 중 하나만 나옵니다. 간부는 66·114·164웨이브, 보스는 115웨이브(1차전)와 165웨이브(2차전)에
            나옵니다.
          </p>
          {EVIL_TEAMS.map((_, i) => teamBlock(i))}
        </>
      )}

      {section === "league" && (
        <>
          <p className="small muted">
            한 판에 아래 리그 중 하나가 정해져 사천왕 4명(182·184·186·188웨이브)과 챔피언(190웨이브)이 모두 그 리그에서
            나옵니다. "A 또는 B" 자리는 둘 중 한 명입니다.
          </p>
          {REGIONS.map((_, i) => leagueBlock(i))}
        </>
      )}

      {section === "gym" && (
        <>
          <p className="small muted">
            클래식에서 관장은 {GYM_WAVES.join("·")} 웨이브(판에 따라 10씩 뒤)에 그때 있는 바이옴의 관장 중 한 명이 나옵니다. 기준
            레벨은 대략 {GYM_WAVES.map((w) => `${w}웨이브 ${baseLevelForWave(w)}`).join(", ")}입니다.
          </p>
          {gymByBiome.map(({ biome, leaders }) => (
            <div key={biome.id} className="trainer-group">
              <h2>{biome.name}</h2>
              <div className="trainer-grid">{leaders.map((t) => card(t))}</div>
            </div>
          ))}
        </>
      )}

      <p className="small muted">출처: {official.data.source.name} {official.data.source.gameVersion} (AGPL-3.0)</p>
    </section>
  );
}
