// scripts/build-dex.mjs 가 만든 public/data/dex.json 의 형식과 조회 도우미.

/** 기술 습득 방법 코드 (Dex 원본 그대로).
 * -1 기억버섯, 0 진화 시, 1~200 레벨, 201~203 알기술(+머신), 204 알기술,
 * 205~207 레어 알기술(+머신), 208 레어 알기술, 209~211 머신(일반/슈퍼/하이퍼) */
export type LearnCode = number;

export interface DexSpecies {
  /** items 배열 위치 (Dex 내부 인덱스) */
  idx: number;
  /** 포켓로그 SpeciesId. 세이브의 dexData/starterData 키와 같다 (리전폼은 2000·4000·6000·8000번대) */
  id: number;
  /** 이미지 키. 폼은 "768-mega" 처럼 접미사가 붙는다 */
  img: string;
  name: string;
  /** 타입 fid (0~17) 1~2개 */
  types: number[];
  abilities: { a1: number; a2: number | null; ha: number | null; passive: number | null };
  /** [HP, 공격, 방어, 특공, 특방, 스피드] */
  stats: [number, number, number, number, number, number];
  bst: number;
  /** 알기술 fid 4개. 마지막은 레어 알기술 */
  eggMoves: [number, number, number, number];
  /** 기본 코스트 (감소 전) */
  cost: number;
  /** 스타팅 화면에서 고를 수 있는 형태 */
  starter: boolean;
  /** 진화 계열 ID. 같은 값이면 같은 계열 */
  family: number;
  /** 완전진화 형태 */
  final: boolean;
  /** 폼 종류: 0 기본, 1 메가, 2 신규 메가, 3 거다이맥스, 4 변형 */
  form: number;
  gen: number;
  /** 기술 fid → 습득 방법 */
  moves: Record<string, LearnCode>;
}

export interface DexData {
  source: {
    name: string;
    url: string;
    license: string;
    commit: string;
    gameVersion: string;
    date: string;
  };
  ranges: { type: [number, number]; ability: [number, number]; move: [number, number] };
  /** fid → 한국어 이름 (타입·특성·기술) */
  names: string[];
  /** 타입 fid → 색상 */
  typeColors: string[];
  familyNames: Record<string, string>;
  /** 특성 fid → 태그 번호 목록 (MOVE_TAG 참고) */
  abilityTags: Record<string, number[]>;
  /** 기술 fid → 기술 정보 */
  moveInfo: Record<string, MoveInfo>;
  /** 특성·기술 fid → 한국어 설명 */
  descriptions: Record<string, string>;
  /** 효과 번호 → 이름 (MoveProc[1]) */
  procNames: string[];
  /** 태그 번호 → 이름 */
  tagNames: string[];
  /** 태그 이름 → 해당 특성 fid 목록 (예: "전기 면역") */
  tags: Record<string, number[]>;
  species: DexSpecies[];
}

/** [확률(−1 확정, −2 배율), 효과 번호, 랭크 변화 또는 배율]. 효과 0~6 = 사용자 공/방/특공/특방/스피드/명중/회피, 22 = 사용자 전 능력치 */
export type MoveProc = [number, number, number];

export interface MoveInfo {
  /** 타입 fid */
  type: number;
  /** 0 물리, 1 특수, 2 변화 */
  cat: 0 | 1 | 2;
  /** −1 이면 위력 없음 */
  power: number;
  acc: number;
  pp: number;
  priority: number;
  procs: MoveProc[];
  tags: number[];
}

/** Dex 의 태그 번호 (lang/ko.js tagToDesc) 중 쓰는 것 */
export const TAG = {
  TARGET_ALL_ENEMIES: 1,
  TARGET_ALL_FIELD: 2,
  HIT_2: 41,
  HIT_3: 42,
  HIT_10: 43,
  HIT_2_5: 44,
  ELECTRIC_IMMUNE: 56,
  FIRE_IMMUNE: 57,
  GROUND_IMMUNE: 58,
  WATER_IMMUNE: 59,
  RAIN_SYNERGY: 61,
  RAIN_SETTER: 62,
  SAND_SYNERGY: 63,
  SAND_SETTER: 64,
  SNOW_SYNERGY: 65,
  SUN_SYNERGY: 66,
  SUN_SETTER: 67,
  BOSS_NO_EFFECT: 70,
  CONTACT: 72,
  NOT_IMPLEMENTED: 74,
} as const;

export const FORM_NAMES = ["기본", "메가", "신규 메가", "거다이맥스", "변형"] as const;

export class Dex {
  readonly data: DexData;
  private readonly starterById = new Map<number, DexSpecies>();
  private readonly byFamily = new Map<number, DexSpecies[]>();
  private readonly formIndexByIdx = new Map<number, number>();

  constructor(data: DexData) {
    this.data = data;
    // 같은 SpeciesId 안에서의 순서 = 게임의 formIndex (Dex 는 게임 폼 순서대로 행을 만든다)
    const formCount = new Map<number, number>();
    for (const s of data.species) {
      const n = formCount.get(s.id) ?? 0;
      this.formIndexByIdx.set(s.idx, n);
      formCount.set(s.id, n + 1);
    }
    for (const s of data.species) {
      const list = this.byFamily.get(s.family);
      if (list) list.push(s);
      else this.byFamily.set(s.family, [s]);
      if (!s.starter) continue;
      // 같은 SpeciesId 에 스타팅 폼이 여러 개면(피카츄 코스튬, 메가 등) 기본 이미지 키를 우선한다.
      const prev = this.starterById.get(s.id);
      if (!prev || (prev.img !== String(s.id) && s.img === String(s.id))) this.starterById.set(s.id, s);
    }
  }

  get species(): DexSpecies[] {
    return this.data.species;
  }

  name(fid: number | null | undefined): string {
    return fid == null ? "" : (this.data.names[fid] ?? `#${fid}`);
  }

  typeNames(s: Pick<DexSpecies, "types">): string[] {
    return s.types.map((t) => this.name(t));
  }

  /** 세이브의 스타터 키(SpeciesId)에 해당하는 기본 스타팅 형태 */
  starter(speciesId: number): DexSpecies | undefined {
    return this.starterById.get(speciesId);
  }

  /** 같은 진화 계열의 모든 형태 (진화형·메가·거다이·변형 포함) */
  family(family: number): DexSpecies[] {
    return this.byFamily.get(family) ?? [];
  }

  /** SpeciesId 의 기본 형태 (formIndex 0) */
  byId(id: number): DexSpecies | undefined {
    if (!this.baseById) {
      this.baseById = new Map();
      for (const s of this.data.species) if (!this.baseById.has(s.id)) this.baseById.set(s.id, s);
    }
    return this.baseById.get(id);
  }
  private baseById?: Map<number, DexSpecies>;

  /** SpeciesId + 게임 formIndex 에 해당하는 형태 (없으면 기본 형태) */
  form(id: number, formIndex = 0): DexSpecies | undefined {
    if (formIndex > 0) {
      const hit = this.data.species.find((s) => s.id === id && this.formIndex(s) === formIndex);
      if (hit) return hit;
    }
    return this.byId(id);
  }

  /** 게임의 formIndex (세이브 caughtAttr 의 폼 비트 위치 = 7 + formIndex) */
  formIndex(s: DexSpecies): number {
    return this.formIndexByIdx.get(s.idx) ?? 0;
  }

  move(fid: number): MoveInfo | undefined {
    return this.data.moveInfo[fid];
  }

  description(fid: number | null | undefined): string {
    return fid == null ? "" : (this.data.descriptions[fid] ?? "");
  }

  isMove(fid: number): boolean {
    const [from, to] = this.data.ranges.move;
    return fid >= from && fid < to;
  }

  abilityTags(fid: number | null | undefined): number[] {
    return fid == null ? [] : (this.data.abilityTags[fid] ?? []);
  }

  /** 한국어 이름 → fid (타입·특성·기술 구간을 나눠서 찾는다). 없으면 −1 */
  fid(kind: "type" | "ability" | "move", name: string): number {
    let index = this.nameIndex.get(kind);
    if (!index) {
      index = new Map();
      const [from, to] = this.data.ranges[kind];
      for (let i = from; i < to; i++) if (!index.has(this.data.names[i])) index.set(this.data.names[i], i);
      this.nameIndex.set(kind, index);
    }
    return index.get(name) ?? -1;
  }
  private readonly nameIndex = new Map<string, Map<string, number>>();

  familyName(family: number): string {
    return this.data.familyNames[family] ?? `#${family}`;
  }
}

export async function fetchDex(url = `${import.meta.env.BASE_URL}data/dex.json`): Promise<Dex> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`도감 데이터를 불러오지 못했습니다 (${res.status})`);
  return new Dex((await res.json()) as DexData);
}
