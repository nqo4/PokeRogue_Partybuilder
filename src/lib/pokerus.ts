// 날짜별 포켓러스 스타터와 알 뽑기 전설 픽업 계산.
// 게임(getPokerusStarters)은 그날 UTC 자정 시각 문자열을 시드로 Phaser 의 난수 생성기를 돌려
// 전체 스타터 목록에서 서로 다른 5마리를 뽑는다. 같은 생성기를 옮겨 와 어느 날짜든 계산한다.
//
// 아래 Rnd 는 Phaser 3 RandomDataGenerator 의 sow·hash·rnd·frac·integerInRange·pick 을 그대로 옮긴 것이다.
// Phaser: Copyright 2013-2025 Phaser Studio Inc., MIT License (https://opensource.org/licenses/MIT)

class Rnd {
  private n = 0;
  private s0 = 0;
  private s1 = 0;
  private s2 = 0;
  private c = 1;

  constructor(seeds: string[]) {
    this.sow(seeds);
  }

  private hash(data: string): number {
    let h: number;
    let n = this.n;
    for (let i = 0; i < data.length; i++) {
      n += data.charCodeAt(i);
      h = 0.02519603282416938 * n;
      n = h >>> 0;
      h -= n;
      h *= n;
      n = h >>> 0;
      h -= n;
      n += h * 0x100000000;
    }
    this.n = n;
    return (n >>> 0) * 2.3283064365386963e-10;
  }

  private sow(seeds: string[]): void {
    this.n = 0xefc8249d;
    this.s0 = this.hash(" ");
    this.s1 = this.hash(" ");
    this.s2 = this.hash(" ");
    this.c = 1;
    for (const seed of seeds) {
      this.s0 -= this.hash(seed);
      this.s0 += ~~(this.s0 < 0);
      this.s1 -= this.hash(seed);
      this.s1 += ~~(this.s1 < 0);
      this.s2 -= this.hash(seed);
      this.s2 += ~~(this.s2 < 0);
    }
  }

  private rnd(): number {
    const t = 2091639 * this.s0 + this.c * 2.3283064365386963e-10;
    this.c = t | 0;
    this.s0 = this.s1;
    this.s1 = this.s2;
    this.s2 = t - this.c;
    return this.s2;
  }

  private frac(): number {
    return this.rnd() + ((this.rnd() * 0x200000) | 0) * 1.1102230246251565e-16;
  }

  integerInRange(min: number, max: number): number {
    return Math.floor(this.frac() * (max - min + 1) + min);
  }

  /** Phaser 의 shuffle (뒤에서부터 섞는다) */
  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(this.frac() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }

  pick<T>(items: readonly T[]): T {
    // 게임의 randSeedItem: 하나뿐이면 난수를 쓰지 않는다
    return items.length === 1 ? items[0] : items[this.integerInRange(0, items.length - 1)];
  }
}

/** 게임과 같은 수 (POKERUS_STARTER_COUNT) */
export const POKERUS_COUNT = 5;

/** 그날 UTC 자정 시각 (밀리초) */
export function utcDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * 그날의 포켓러스 스타터 SpeciesId 5개.
 * @param starterIds 게임의 전체 스타터 목록 (speciesDataRegistry.getAllStarters 순서 그대로)
 */
export function pokerusStarters(date: Date, starterIds: readonly number[], count = POKERUS_COUNT): number[] {
  if (starterIds.length < count) return [];
  // 게임은 executeWithSeedOffset(…, 0, 시드) 로 부른다. 오프셋 0 이라 시드 문자열이 그대로 쓰인다
  const rnd = new Rnd([String(utcDay(date))]);
  const out: number[] = [];
  while (out.length < count) {
    const id = rnd.pick(starterIds);
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

/** 알 뽑기 시드 (게임의 EGG_SEED) */
const EGG_SEED = "1073741824";
const DAY_MS = 86400000;

/**
 * 그날(UTC) 알 뽑기 전설 픽업 SpeciesId. 게임의 getLegendaryGachaSpeciesForTimestamp 와 같다:
 * 후보 수만큼의 날을 한 주기로, 주기마다 시드 문자를 주기 번호만큼 밀어 후보를 섞고 그날 순번의 포켓몬을 고른다.
 * @param legendaryIds 게임의 후보 목록 (getValidLegendaryGachaSpecies 순서 그대로)
 */
export function legendaryPickup(date: Date, legendaryIds: readonly number[]): number | undefined {
  const n = legendaryIds.length;
  if (!n) return undefined;
  const day = Math.floor(date.getTime() / DAY_MS);
  const cycle = Math.floor(day / n);
  const seed = Array.from(EGG_SEED, (ch) => String.fromCharCode(ch.charCodeAt(0) + cycle)).join("");
  return new Rnd([seed]).shuffle([...legendaryIds])[day % n];
}
