// 포켓로그 세이브(.prsv) 복호화와 원본 구조.
// 세이브는 브라우저 안에서만 처리하고 서버로 보내지 않는다.
import AES from "crypto-js/aes";
import Utf8 from "crypto-js/enc-utf8";

/** 포켓로그 클라이언트가 세이브 내보내기에 쓰는 패스프레이즈 (공개된 클라이언트 상수) */
const SAVE_PASSPHRASE = "x0i2O7WRiANTqPmZ";

/** dexData 항목 (키 = SpeciesId) */
export interface RawDexEntry {
  /** seenAttr */
  $sa: number | string;
  /** caughtAttr (DexAttr 비트). 안농처럼 큰 값은 문자열로 저장된다 */
  $ca: number | string;
  /** natureAttr: 성격 n 이 해금되면 1 << (n + 1) */
  $na: number;
  $s: number;
  $c: number;
  $hc: number;
  /** 개체치 [HP, 공격, 방어, 특공, 특방, 스피드] */
  $i: number[];
  ribbons?: string;
}

/** starterData 항목 (키 = 스타터 SpeciesId) */
export interface RawStarterEntry {
  /** 저장된 무브셋 */
  $m: number[] | null;
  /** 알기술 해금 비트 (bit0~3 = 알기술 1~4) */
  $em: number;
  /** 사탕 */
  $x: number;
  /** 친밀도 */
  $f: number;
  /** 특성 해금 비트: 1 특성1, 2 특성2, 4 숨겨진 특성 */
  $a: number;
  /** 패시브: 1 해금, 2 켜짐 */
  $pa: number;
  /** 코스트 감소 횟수 */
  $vr: number;
  /** 클래식 클리어 횟수 */
  $wc: number;
  pity?: number[];
}

export interface RawSave {
  trainerId: number;
  secretId: number;
  gender: number;
  dexData: Record<string, RawDexEntry>;
  starterData: Record<string, RawStarterEntry>;
  gameStats: Record<string, number>;
  gameVersion: string;
  timestamp: number;
  [key: string]: unknown;
}

export class SaveError extends Error {}

/** .prsv 내용(텍스트)을 복호화해 JSON 으로 돌려준다. 이미 복호화된 JSON 도 받는다. */
export function decryptSave(text: string): RawSave {
  const trimmed = text.trim();
  let json: string;
  if (trimmed.startsWith("{")) {
    json = trimmed;
  } else {
    try {
      json = AES.decrypt(trimmed, SAVE_PASSPHRASE).toString(Utf8);
    } catch {
      json = "";
    }
    if (!json) throw new SaveError("세이브 파일을 복호화하지 못했습니다. 포켓로그에서 내보낸 .prsv 파일인지 확인해 주세요.");
  }
  let data: RawSave;
  try {
    data = JSON.parse(json) as RawSave;
  } catch {
    throw new SaveError("세이브 내용을 읽지 못했습니다 (JSON 형식 오류).");
  }
  if (!data || typeof data !== "object" || !data.dexData || !data.starterData) {
    throw new SaveError("시스템 세이브가 아닙니다. 데이터 관리 → 데이터 내보내기로 저장한 파일을 올려 주세요.");
  }
  return data;
}
