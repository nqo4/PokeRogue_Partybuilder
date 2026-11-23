// 클리어 기준 고르기 팝업: 모드(클래식·챌린지) → 챌린지 종류(단일 세대·단일 타입) → 세대·타입.
// 단계마다 라디오 버튼으로 고르고, 뒤로 가기로 앞 단계로 돌아간다.
import { useEffect, useState } from "react";
import { typesInGameOrder, type Dex } from "../lib/dex";
import { cleared, eligible, type ClearCriterion } from "../lib/ribbons";
import type { OwnedStarter } from "../lib/starters";

type Mode = "classic" | "challenge";
type Challenge = "gen" | "type";
type Step = "mode" | "challenge" | "option";

interface Props {
  dex: Dex;
  starters: OwnedStarter[];
  value: ClearCriterion;
  onApply: (c: ClearCriterion) => void;
  onClose: () => void;
}

export function ClearCriterionDialog({ dex, starters, value, onApply, onClose }: Props) {
  const [step, setStep] = useState<Step>("mode");
  const [mode, setMode] = useState<Mode>(value.mode === "classic" ? "classic" : "challenge");
  const [challenge, setChallenge] = useState<Challenge>(value.mode === "type" ? "type" : "gen");
  const [gen, setGen] = useState(value.mode === "gen" ? value.gen : 1);
  const types = typesInGameOrder(dex);
  const [type, setType] = useState(value.mode === "type" ? value.type : types[0]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.classList.add("menu-open");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("menu-open");
    };
  }, [onClose]);

  /** 이 기준으로 클리어한 스타터 수 / 도전할 수 있는 스타터 수 */
  const count = (c: ClearCriterion) => {
    const list = starters.filter((s) => eligible(s, c));
    return `${list.filter((s) => cleared(s, c, dex)).length} / ${list.length}`;
  };

  const back = () => setStep(step === "option" ? "challenge" : "mode");
  const next = () => {
    if (step === "mode") {
      if (mode === "classic") onApply({ mode: "classic" });
      else setStep("challenge");
    } else if (step === "challenge") setStep("option");
    else onApply(challenge === "gen" ? { mode: "gen", gen } : { mode: "type", type });
  };
  const last = step === "option" || (step === "mode" && mode === "classic");

  const radio = <T extends string | number>(name: string, v: T, cur: T, set: (v: T) => void, label: string, sub?: string) => (
    <label key={String(v)} className={`criterion-option${cur === v ? " checked" : ""}`}>
      <input type="radio" name={name} checked={cur === v} onChange={() => set(v)} />
      <span>{label}</span>
      {sub && <span className="muted small">{sub}</span>}
    </label>
  );

  const heading =
    step === "mode" ? "어떤 모드의 클리어를 볼까요?" : step === "challenge" ? "챌린지 종류" : challenge === "gen" ? "세대 고르기" : "타입 고르기";

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal criterion" role="dialog" aria-modal="true" aria-labelledby="criterion-title">
        <header className="modal-head">
          <div>
            <h2 id="criterion-title">클리어 기준</h2>
            <span className="muted small">{heading}</span>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </header>

        <div className="criterion-list" role="radiogroup" aria-label={heading}>
          {step === "mode" && (
            <>
              {radio("mode", "classic", mode, setMode, "클래식", `클리어 ${count({ mode: "classic" })}종`)}
              {radio("mode", "challenge", mode, setMode, "챌린지", "단일 세대 · 단일 타입")}
            </>
          )}
          {step === "challenge" && (
            <>
              {radio("challenge", "gen", challenge, setChallenge, "단일 세대")}
              {radio("challenge", "type", challenge, setChallenge, "단일 타입")}
            </>
          )}
          {step === "option" && (
            <div className={`criterion-grid${challenge === "type" ? " types" : ""}`}>
              {challenge === "gen"
                ? Array.from({ length: 9 }, (_, i) => i + 1).map((g) =>
                    radio("gen", g, gen, setGen, `${g}세대`, count({ mode: "gen", gen: g })),
                  )
                : types.map((t) => radio("type", t, type, setType, dex.name(t), count({ mode: "type", type: t })))}
            </div>
          )}
        </div>

        {step === "mode" && (
          <p className="muted small">
            클래식은 클리어 횟수로, 챌린지는 게임이 주는 리본으로 판단합니다. 엔드리스는 클리어 리본이 없어 고를 수 없습니다.
          </p>
        )}
        {step === "option" && <p className="muted small">숫자는 리본을 받은 스타터 / 도전할 수 있는 스타터 (진화·폼 포함)</p>}

        <div className="criterion-actions">
          {step !== "mode" && <button onClick={back}>← 뒤로</button>}
          <button className="primary" onClick={next}>
            {last ? "적용" : "다음 →"}
          </button>
        </div>
      </div>
    </div>
  );
}
