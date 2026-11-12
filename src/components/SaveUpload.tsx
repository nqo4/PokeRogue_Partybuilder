import { useState } from "react";

interface Props {
  disabled: boolean;
  onFile: (file: File) => void;
  /** 세이브를 불러온 뒤에는 한 줄짜리로 작게 보여준다 */
  compact?: boolean;
}

export function SaveUpload({ disabled, onFile, compact }: Props) {
  const [dragging, setDragging] = useState(false);

  return (
    <label
      className={`upload${compact ? " compact" : ""}${dragging ? " dragging" : ""}${disabled ? " disabled" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files[0];
        if (f && !disabled) onFile(f);
      }}
    >
      <input
        type="file"
        accept=".prsv,.json,.txt"
        disabled={disabled}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      {compact ? <span>다른 세이브 불러오기</span> : <strong>세이브 파일(.prsv)을 끌어 놓거나 눌러서 선택</strong>}
      {!compact && <span className="muted">포켓로그 → ESC → 데이터 관리 → 데이터 내보내기</span>}
    </label>
  );
}
