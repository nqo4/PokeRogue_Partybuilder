// 문의 보내기: 사이트 안 양식에서 쓴 내용을 Web3Forms(https://web3forms.com)를 거쳐 개발자 메일로 보낸다.
// 서버가 없는 정적 사이트라 메일 전달은 Web3Forms 가 맡는다. 받는 메일 주소는 키를 만들 때 정해지고 화면에는 드러나지 않는다.
import { useState, type FormEvent } from "react";

/** Web3Forms 접근 키. 공개해도 되는 키(받는 주소를 숨겨 주는 용도)라 코드에 그대로 둔다. 비어 있으면 양식을 잠근다 */
const WEB3FORMS_KEY = "4bc2053d-e96c-450d-8e15-da3d453e9d60";

const KINDS = ["버그 신고", "기능 제안", "데이터 오류", "기타"] as const;
const MAX = 2000;

type Status = { kind: "idle" | "sending" | "sent" } | { kind: "error"; message: string };

export function ContactView() {
  const [kind, setKind] = useState<(typeof KINDS)[number]>(KINDS[0]);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const ready = WEB3FORMS_KEY !== "";

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = message.trim();
    if (!ready || text.length < 5 || status.kind === "sending") return;
    // 사람에게는 안 보이는 칸. 자동 스팸 프로그램이 채우면 Web3Forms 가 걸러 낸다
    const botcheck = (new FormData(e.currentTarget).get("botcheck") as string | null) ?? "";
    setStatus({ kind: "sending" });
    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: WEB3FORMS_KEY,
          subject: `[포켓로그 파티 빌더] ${kind}`,
          from_name: "포켓로그 파티 빌더 문의",
          종류: kind,
          내용: text,
          botcheck,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; message?: string };
      if (!res.ok || !data.success) throw new Error(data.message || `응답 코드 ${res.status}`);
      setStatus({ kind: "sent" });
      setMessage("");
    } catch (err) {
      // 실패하면 쓴 내용을 지우지 않아서 다시 보낼 수 있다
      setStatus({ kind: "error", message: (err as Error).message });
    }
  }

  return (
    <section className="contact">
      <p className="muted">
        버그, 기능 제안, 잘못된 데이터 등 무엇이든 알려 주세요. 보내 주신 내용은 개발자에게 메일로 전달됩니다. 답장은 드리지
        못합니다.
      </p>
      <p className="muted small">세이브 파일 내용이나 이메일·연락처 같은 개인 정보는 적지 마세요.</p>

      {!ready && <p className="contact-note">문의 보내기는 준비 중입니다. 곧 열 예정입니다.</p>}

      {status.kind === "sent" ? (
        <div className="contact-done" role="status">
          <strong>문의를 보냈습니다. 고맙습니다!</strong>
          <button onClick={() => setStatus({ kind: "idle" })}>하나 더 보내기</button>
        </div>
      ) : (
        <form className="contact-form" onSubmit={submit}>
          <label>
            문의 종류
            <select value={kind} onChange={(e) => setKind(e.target.value as (typeof KINDS)[number])} disabled={!ready}>
              {KINDS.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
          <label>
            내용
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={MAX}
              rows={8}
              required
              minLength={5}
              disabled={!ready}
              placeholder={"예: 파티 추천에서 OO를 고르면 화면이 멈춥니다.\n어떤 화면에서 무엇을 했는지 적어 주시면 빨리 고칠 수 있어요."}
            />
            <span className="muted small contact-count">
              {message.length} / {MAX}
            </span>
          </label>
          <input type="checkbox" name="botcheck" className="contact-hp" tabIndex={-1} autoComplete="off" aria-hidden="true" />
          {status.kind === "error" && (
            <p className="contact-error" role="alert">
              보내지 못했습니다 ({status.message}). 잠시 뒤 다시 시도해 주세요.
            </p>
          )}
          <button type="submit" className="primary" disabled={!ready || message.trim().length < 5 || status.kind === "sending"}>
            {status.kind === "sending" ? "보내는 중…" : "보내기"}
          </button>
        </form>
      )}
    </section>
  );
}
