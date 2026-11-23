// 챌린지에서 쓸 수 없는 형태 경고.
// 단일 타입·세대 챌린지는 그 타입·세대인 형태로만 싸울 수 있다 (진화 전 단계·다른 진화 갈래·메가진화·거다이맥스·폼 변화 포함).
import type { Dex, DexSpecies } from "./dex";
import type { Official } from "./official";
import { formAllowed, type ClearCriterion } from "./ribbons";
import type { OwnedStarter } from "./starters";

const formsById = new WeakMap<Dex, Map<number, DexSpecies[]>>();
function formsOf(dex: Dex, id: number): DexSpecies[] {
  let m = formsById.get(dex);
  if (!m) {
    m = new Map();
    for (const s of dex.species) {
      const list = m.get(s.id);
      if (list) list.push(s);
      else m.set(s.id, [s]);
    }
    formsById.set(dex, m);
  }
  return m.get(id) ?? [];
}

/**
 * 이 스타터로 쓸 수 있는 모든 형태: 스타터에서 진화해 닿는 종(공식 진화 데이터, 리전폼 진화 포함)의
 * 기본 형태와 메가진화·거다이맥스·폼 변화, 잡아 둔 다른 스타팅 형태. 스타모빌처럼 상대 전용인 폼은 뺀다.
 */
export function usableForms(owned: OwnedStarter, dex: Dex, official: Official | null): DexSpecies[] {
  const regional = owned.speciesId >= 2000;
  const ids = official
    ? official.evolutionLine(owned.speciesId)
    : [...new Set(owned.family.filter((f) => regional || f.id < 2000).map((f) => f.id))];
  return ids.flatMap((id) =>
    formsOf(dex, id).filter(
      (f) =>
        f.img === String(f.id) ||
        (f.form >= 1 && f.form <= 4) ||
        // 다른 스타팅 형태(춤추새 스타일, 켄타로스 품종 등)는 그 스타터 자신의 것을 잡아 둔 경우만
        (f.starter && f.id === owned.speciesId && owned.formStatus[f.idx] === "caught"),
    ),
  );
}

/** 챌린지에서 못 쓰는 형태가 있으면 경고 문구, 없으면 null */
export function challengeWarning(
  owned: OwnedStarter,
  c: ClearCriterion,
  dex: Dex,
  official: Official | null,
): string | null {
  if (c.mode === "classic") return null;
  const forms = usableForms(owned, dex, official);
  const ok = forms.filter((f) => formAllowed(f, c));
  if (!ok.length || ok.length === forms.length) return null;
  const names = [...new Set(ok.map((f) => f.name))];
  return `주의: 해당 챌린지에서는 ${names.map((n) => `${n} 폼`).join("/")}만 사용 가능합니다!`;
}
