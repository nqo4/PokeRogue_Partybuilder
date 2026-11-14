// 한 형태를 얻는 방법: 기본 폼은 진화 조건, 메가·거다이맥스·원시회귀·오리진폼 등은 폼 변화 조건
import type { Dex, DexSpecies } from "./dex";
import type { Official } from "./official";

export interface HowToGet {
  /** 예: "파이리 → 레벨 16", "리자몽나이트 X를 통해 폼체인지" */
  text: string;
  /** 필요한 아이템 그림 키 */
  items: string[];
}

export function howToGet(s: DexSpecies, dex: Dex, official: Official | null): HowToGet[] {
  if (!official) return [];
  const formIndex = dex.formIndex(s);
  if (formIndex > 0) return official.formChangesTo(s.id, formIndex).map((f) => ({ text: f.text, items: f.items }));
  return official.evolutionsTo(s.id).map((e) => ({
    text: `${dex.byId(e.from)?.name ?? e.from} → ${e.text.join(", ")}`,
    items: e.item ? [e.item] : [],
  }));
}
