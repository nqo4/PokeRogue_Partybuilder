// 검색: 기술·특성·아이템을 이름으로 찾고, 설명과 그것을 배우는(가진·쓰는) 포켓몬을 보여 준다.
import { useMemo, useState } from "react";
import type { Dex, DexSpecies } from "../lib/dex";
import { InfoBody } from "./InfoPopup";
import { ItemIcon } from "./ItemIcon";
import { useOfficial } from "./OfficialContext";
import { SearchInput } from "./SearchInput";
import { Sprite } from "./Sprite";

type Kind = "move" | "ability" | "item";
const KIND_NAMES: Record<Kind, string> = { move: "기술", ability: "특성", item: "아이템" };
const TIER_NAMES = { common: "노말", great: "슈퍼", ultra: "하이퍼", rogue: "로그", master: "마스터" } as const;

interface Hit {
  kind: Kind;
  /** 기술·특성은 fid, 아이템은 그림 키 */
  key: string;
  name: string;
}

/** 포켓몬 한 마리와 배우는(가진·쓰는) 방법 */
interface User {
  species: DexSpecies;
  how: string;
}

/** 기술 습득 방법 코드 → 짧은 이름 (dex.ts LearnCode 참고) */
function learnLabel(code: number): string {
  if (code === -1) return "기억버섯";
  if (code === 0) return "진화 시";
  if (code <= 200) return `Lv.${code}`;
  if (code <= 204) return "알기술";
  if (code <= 208) return "레어 알기술";
  return "기술머신";
}

const MAX_HITS = 40;
const MAX_USERS = 60;

export function SearchView({ dex }: { dex: Dex }) {
  const official = useOfficial();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<Kind | "all">("all");
  const [open, setOpen] = useState<string | null>(null);

  const hits = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    const out: Hit[] = [];
    const add = (k: Kind, range: [number, number]) => {
      const seen = new Set<string>();
      for (let f = range[0]; f < range[1]; f++) {
        const name = dex.data.names[f];
        if (!name || seen.has(name) || !name.includes(q)) continue;
        seen.add(name);
        out.push({ kind: k, key: String(f), name });
      }
    };
    if (kind === "all" || kind === "move") add("move", dex.data.ranges.move);
    if (kind === "all" || kind === "ability") add("ability", dex.data.ranges.ability);
    if (kind === "all" || kind === "item") {
      for (const [k, sp] of Object.entries(official?.data.itemSprites ?? {})) {
        if (sp.tier !== "common" && sp.name.includes(q)) out.push({ kind: "item", key: k, name: sp.name });
      }
    }
    // 검색어로 시작하는 이름, 짧은 이름을 먼저
    return out
      .sort((a, b) => Number(!a.name.startsWith(q)) - Number(!b.name.startsWith(q)) || a.name.length - b.name.length)
      .slice(0, MAX_HITS);
  }, [dex, official, query, kind]);

  return (
    <section className="search-view">
      <div className="filters">
        <SearchInput placeholder="기술·특성·아이템 이름" value={query} onChange={setQuery} />
        <span className="view-toggle" role="group" aria-label="검색 종류" style={{ marginLeft: 0 }}>
          {(["all", "move", "ability", "item"] as const).map((k) => (
            <button key={k} className={kind === k ? "active" : ""} aria-pressed={kind === k} onClick={() => setKind(k)}>
              {k === "all" ? "전체" : KIND_NAMES[k]}
            </button>
          ))}
        </span>
        {query.trim() && <span className="muted">{hits.length >= MAX_HITS ? `${MAX_HITS}개 이상` : `${hits.length}개`}</span>}
      </div>
      {!query.trim() && <p className="muted">이름 일부를 입력하면 기술·특성·아이템을 찾아 설명과 해당 포켓몬을 보여 줍니다.</p>}
      {query.trim() && !hits.length && <p className="muted">찾는 이름이 없습니다.</p>}
      <ul className="search-hits">
        {hits.map((h) => {
          const id = `${h.kind}:${h.key}`;
          const isOpen = open === id || hits.length === 1;
          return (
            <li key={id} className={isOpen ? "open" : ""}>
              <button className="search-hit" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : id)}>
                <span className="search-kind">{KIND_NAMES[h.kind]}</span>
                {h.kind === "item" && <ItemIcon item={h.key} size={24} />}
                <b>{h.name}</b>
                <span className="muted small">{isOpen ? "접기" : "자세히"}</span>
              </button>
              {isOpen && <HitDetail hit={h} dex={dex} />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function HitDetail({ hit, dex }: { hit: Hit; dex: Dex }) {
  const official = useOfficial();
  const [all, setAll] = useState(false);

  const users = useMemo<User[]>(() => {
    if (hit.kind === "move") {
      const fid = hit.key;
      return dex.species.filter((s) => s.moves[fid] != null).map((s) => ({ species: s, how: learnLabel(s.moves[fid]) }));
    }
    if (hit.kind === "ability") {
      const fid = Number(hit.key);
      const out: User[] = [];
      for (const s of dex.species) {
        const a = s.abilities;
        const how = [
          a.a1 === fid || a.a2 === fid ? "특성" : "",
          a.ha === fid ? "숨겨진 특성" : "",
          a.passive === fid ? "패시브" : "",
        ].filter(Boolean);
        if (how.length) out.push({ species: s, how: how.join("·") });
      }
      return out;
    }
    // 아이템: 이 아이템으로 진화하거나 폼이 바뀌는 형태
    const out: User[] = [];
    for (const e of official?.data.evolutions ?? []) {
      const to = e.item === hit.key ? dex.byId(e.to) : undefined;
      if (to && !out.some((u) => u.species === to)) out.push({ species: to, how: "진화" });
    }
    for (const f of official?.data.formChanges ?? []) {
      const to = f.items.includes(hit.key) ? dex.form(f.species, f.toForm) : undefined;
      if (to && !out.some((u) => u.species === to)) out.push({ species: to, how: "폼 변화" });
    }
    return out;
  }, [hit, dex, official]);

  const sp = hit.kind === "item" ? official?.data.itemSprites?.[hit.key] : undefined;
  const label = hit.kind === "move" ? "배우는 포켓몬" : hit.kind === "ability" ? "가진 포켓몬" : "이 아이템으로 바뀌는 포켓몬";
  const shown = all ? users : users.slice(0, MAX_USERS);

  return (
    <div className="search-detail">
      {hit.kind === "item" ? (
        <p>
          <span className={`item-name tier-${sp?.tier ?? "common"}`}>{hit.name}</span>{" "}
          <span className="muted small">{TIER_NAMES[sp?.tier ?? "common"]} 등급 (게임 상점에서 나오는 등급)</span>
        </p>
      ) : (
        <div className="search-info">
          <InfoBody dex={dex} fid={Number(hit.key)} />
        </div>
      )}
      <h3>
        {label} <span className="muted small">{users.length}개 형태 · 그림을 누르면 상세</span>
      </h3>
      {users.length === 0 ? (
        <p className="muted small">없습니다.</p>
      ) : (
        <div className="search-users">
          {shown.map((u) => (
            <span key={u.species.idx} className="search-user">
              <Sprite species={u.species} size={40} />
              <span className="small">{u.species.name}</span>
              <span className="small muted">{u.how}</span>
            </span>
          ))}
        </div>
      )}
      {users.length > MAX_USERS && (
        <button className="link-button" onClick={() => setAll(!all)}>
          {all ? "줄이기" : `${users.length - MAX_USERS}개 더 보기`}
        </button>
      )}
    </div>
  );
}
