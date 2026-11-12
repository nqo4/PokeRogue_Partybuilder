// 추천 파티 카드 안의 "지도 경로 추천"
import { useMemo, useState } from "react";
import type { Dex } from "../lib/dex";
import type { PartyAnalysis } from "../lib/classic/party";
import { bestRoute } from "../lib/route";
import type { FormStatus } from "../lib/starters";
import { useOfficial } from "./OfficialContext";

const pct = (x: number) => `${(x * 100).toFixed(0)}%`;

export function RouteSection({
  dex,
  party,
  status,
}: {
  dex: Dex;
  party: PartyAnalysis;
  status?: Record<number, FormStatus>;
}) {
  const official = useOfficial();
  const town = official?.data.biomes.find((b) => b.key === "TOWN")?.id ?? 0;
  const [start, setStart] = useState(town);
  const [steps, setSteps] = useState(6);
  const route = useMemo(
    () => (official ? bestRoute(start, steps, dex, official, status, party) : []),
    [official, start, steps, dex, status, party],
  );
  if (!official) return null;

  return (
    <details className="route">
      <summary>지도 경로 추천 (지도 아이템이 있을 때)</summary>
      <div className="filters small">
        <label>
          지금 바이옴
          <select value={start} onChange={(e) => setStart(Number(e.target.value))}>
            {official.data.biomes.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          앞으로
          <select value={steps} onChange={(e) => setSteps(Number(e.target.value))}>
            {[3, 4, 5, 6, 8, 10].map((n) => (
              <option key={n} value={n}>
                {n}번 이동
              </option>
            ))}
          </select>
        </label>
      </div>
      {route.length === 0 ? (
        <p className="muted small">이 바이옴에서는 고를 수 있는 다음 바이옴이 없습니다.</p>
      ) : (
        <ol className="route-steps">
          <li className="muted">{official.biomeById.get(start)?.name} (출발)</li>
          {route.map((r, i) => (
            <li key={i}>
              <b>{r.eval.biome.name}</b>
              {r.chance < 1 && <span className="muted small"> · 선택지에 {pct(r.chance)} 확률로 등장</span>}
              <span className="small">
                {status && <> · 새 포켓몬 {pct(r.eval.newChance)}</>}
                {r.eval.gyms.length > 0 && (
                  <>
                    {" · 관장 "}
                    {r.eval.gyms.map((g, gi) => (
                      <span key={g.trainer.type}>
                        {gi > 0 && ", "}
                        {g.trainer.name}
                        {g.typeFid >= 0 && (
                          <span className="type type-sm" style={{ background: dex.data.typeColors[g.typeFid] }}>
                            {dex.name(g.typeFid)}
                          </span>
                        )}
                        <span className={g.risk > 0 ? "error" : g.risk < 0 ? "accent" : "muted"}>
                          {g.risk > 0 ? " 불리" : g.risk < 0 ? " 유리" : " 보통"}
                        </span>
                      </span>
                    ))}
                  </>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
      <p className="small muted">
        아직 못 잡은 포켓몬을 만날 확률이 높고, 이 파티가 관장 타입에 약하지 않은 바이옴을 우선합니다. 지도가 없으면 다음 바이옴은
        무작위이고, 확률로만 뜨는 연결은 선택지에 없을 수 있습니다.
      </p>
    </details>
  );
}
