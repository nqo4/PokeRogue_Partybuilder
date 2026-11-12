// 포켓몬(형태) 상세 화면. 목록 위에 겹쳐 띄워서, 닫으면 목록의 필터·스크롤이 그대로 남는다.
// 진화형·메가 등 어떤 형태든 열 수 있고, 세이브가 있으면 그 계열 스타터의 해금 상태를 함께 보여준다.
import { useEffect } from "react";
import { typeStyle } from "../lib/color";
import type { Dex, DexSpecies } from "../lib/dex";
import { FORM_NAMES } from "../lib/dex";
import { NATURE_NAMES } from "../lib/rules";
import type { FormStatus, OwnedStarter } from "../lib/starters";
import { Sprite, nationalDex } from "./Sprite";
import { InfoLink, MoveLabel } from "./InfoPopup";
import { useOfficial } from "./OfficialContext";

export const STAT_NAMES = ["HP", "공격", "방어", "특공", "특방", "스피드"];
export const STATUS_LABEL: Record<FormStatus, string> = { caught: "잡음", seen: "발견만", unseen: "미발견" };

interface Props {
  species: DexSpecies;
  dex: Dex;
  /** 이 형태가 속한 계열의 보유 스타터 (세이브가 없거나 못 잡았으면 없음) */
  owned?: OwnedStarter;
  /** 형태별 도감 상태 (세이브가 없으면 없음) */
  status?: Record<number, FormStatus>;
  onClose: () => void;
}

const stageOf = (f: DexSpecies) => `${f.starter ? "스타터" : f.final ? "최종" : "중간"} · ${FORM_NAMES[f.form] ?? "폼"}`;

export function SpeciesModal({ species, dex, owned, status, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    // 뒤 화면이 같이 스크롤되지 않게 막는다
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const typeBadge = (fid: number) => (
    <span key={fid} className="type" style={typeStyle(dex.data.typeColors[fid])}>
      {dex.name(fid)}
    </span>
  );
  const family = owned?.family ?? dex.family(species.family);
  const official = useOfficial();
  const familyIds = new Set(family.map((f) => f.id));
  /** 이 형태로 진화하는 방법 (계열 안의 이전 형태에서). 폼 변화 행에는 표시하지 않는다 */
  const evoText = (f: DexSpecies) =>
    f.form !== 0 || !official
      ? []
      : official
          .evolutionsTo(f.id)
          .filter((e) => familyIds.has(e.from) && e.from !== f.id)
          .map((e) => `${dex.byId(e.from)?.name ?? e.from} → ${e.text.join(", ")}`);
  const myEvo = evoText(species);
  const baseTypes = (owned?.dex ?? family.find((f) => f.starter) ?? species).types.join(",");
  const myStatus = status?.[species.idx];
  const [, atk, , spa] = species.stats;
  const isStarterForm = owned?.dex.idx === species.idx;
  // 특성 칸 해금 여부는 계열 공통 (스타터 기준)
  const slots: [string, number | null, boolean | undefined][] = [
    ["", species.abilities.a1, owned?.abilities.a1.unlocked],
    ["", species.abilities.a2, owned?.abilities.a2?.unlocked],
    ["숨특", species.abilities.ha, owned?.abilities.hidden?.unlocked],
  ];
  const passiveFid = species.abilities.passive ?? owned?.dex.abilities.passive ?? null;

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label={`${species.name} 상세`}>
        <header className="modal-head">
          <span className={myStatus && myStatus !== "caught" ? `dim-${myStatus}` : ""}>
            <Sprite species={species} size={72} />
          </span>
          <div>
            <div className="muted small">
              No.{String(nationalDex(species.id)).padStart(4, "0")} · {species.gen}세대 · {stageOf(species)}
              {myStatus && <span className={`status-tag status-${myStatus}`}>{STATUS_LABEL[myStatus]}</span>}
            </div>
            <h2>{species.name}</h2>
            {myEvo.length > 0 && <div className="small accent">진화 조건: {myEvo.join(" / ")}</div>}
            <div>
              {species.types.map(typeBadge)}
              <span className={`atk-kind ${atk >= spa ? "phys" : "spec"}`}>{atk >= spa ? "물리형" : "특수형"}</span>
              {owned && owned.luck > 0 && <span className={`luck luck-${owned.luck}`}>럭 {owned.luck}</span>}
            </div>
            {owned ? (
              <div className="small muted">
                {!isStarterForm && (
                  <>
                    스타터{" "}
                    <span className="inline-sprite">
                      <Sprite species={owned.dex} size={24} />
                    </span>
                    {owned.name} ·{" "}
                  </>
                )}
                코스트 {owned.cost}
                {owned.costReductions > 0 && ` (${owned.baseCost}−${owned.costReductions}회)`} · 클래식 클리어{" "}
                {owned.classicWins}회 · 사탕 {owned.candy} · 친밀도 {owned.friendship}
              </div>
            ) : (
              <div className="small muted">{status ? "이 계열의 스타터를 아직 보유하지 않았습니다." : `기본 코스트 ${species.cost}`}</div>
            )}
          </div>
          <button className="modal-close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </header>

        <div className="detail-grid">
          <div>
            <h3>특성 (눌러서 설명 보기)</h3>
            <ul>
              {slots.map(([label, fid, unlocked], i) =>
                fid == null ? null : (
                  <li key={i} className={owned && !unlocked ? "locked" : ""}>
                    <InfoLink fid={fid} />
                    {label && ` (${label})`}
                    {owned && !unlocked && " — 미해금"}
                  </li>
                ),
              )}
              {passiveFid != null && (
                <li className={owned && !owned.passive.unlocked ? "locked" : ""}>
                  <InfoLink fid={passiveFid} /> (패시브
                  {owned ? (owned.passive.unlocked ? (owned.passive.enabled ? ", 켜짐" : ", 꺼짐") : ", 미해금") : ""})
                </li>
              )}
            </ul>
          </div>
          <div>
            <h3>알기술 (계열 공통)</h3>
            <ul className="egg-moves">
              {species.eggMoves.map((fid, i) => {
                const unlocked = owned?.eggMoves[i]?.unlocked;
                return (
                  <li key={`${fid}-${i}`} className={owned && !unlocked ? "locked" : ""}>
                    <MoveLabel fid={fid} />
                    {i === 3 && " (레어)"}
                    {owned && !unlocked && " — 미해금"}
                  </li>
                );
              })}
            </ul>
          </div>
          <div>
            <h3>종족값 · 합계 {species.bst}</h3>
            <table className="iv-table">
              <thead>
                <tr>
                  {STAT_NAMES.map((n) => (
                    <th key={n}>{n}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {species.stats.map((v, i) => (
                    <td key={i} className="iv-max">
                      {v}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
            {owned && (
              <>
                <h3>개체치 (스타터에서 전승)</h3>
                <table className="iv-table">
                  <thead>
                    <tr>
                      {STAT_NAMES.map((n) => (
                        <th key={n}>{n}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {owned.ivs.map((v, i) => (
                        <td key={i} className={v === 31 ? "iv-max" : ""}>
                          {v}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
                <h3>해금 성격 {owned.natures.length}/25</h3>
                <p className="small">{owned.natures.map((n) => NATURE_NAMES[n]).join(", ")}</p>
              </>
            )}
          </div>
          <div className="wide">
            <h3>
              진화 계열 ({dex.familyName(species.family)}){" "}
              <span className="muted small">— 사진을 누르면 그 포켓몬을 봅니다{status && " · 어두운 형태는 아직 잡지 못한 형태"}</span>
            </h3>
            <div className="table-wrap">
              <table className="family">
                <thead>
                  <tr>
                    <th>포켓몬</th>
                    <th>타입</th>
                    <th>단계</th>
                    <th>진화 조건</th>
                    <th className="num">합계</th>
                    {STAT_NAMES.map((n) => (
                      <th key={n} className="num">
                        {n}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {family.map((f) => {
                    const st = status?.[f.idx];
                    return (
                      <tr key={f.idx} className={`${st ? `form-${st}` : ""}${f.idx === species.idx ? " current" : ""}`}>
                        <td>
                          <span className="name-cell">
                            <span className="dim-target">
                              <Sprite species={f} size={32} />
                            </span>
                            <span className="dim-target">{f.name}</span>
                            {st && st !== "caught" && <span className="status-tag">{STATUS_LABEL[st]}</span>}
                          </span>
                        </td>
                        <td className="dim-target">
                          {f.types.map(typeBadge)}
                          {f.types.join(",") !== baseTypes && <span className="changed">타입 변동</span>}
                        </td>
                        <td className="muted small dim-target">{stageOf(f)}</td>
                        <td className="small evo-cond">
                          {evoText(f).map((x, i) => (
                            <div key={i}>{x}</div>
                          ))}
                        </td>
                        <td className="num dim-target">{f.bst}</td>
                        {f.stats.map((v, i) => (
                          <td key={i} className="num small dim-target">
                            {v}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
