/*
 * 포켓로그 공식 저장소(pagefaultgames/pokerogue, AGPL-3.0) 안에서 실행하는 데이터 추출 스크립트.
 * scripts/export-official.mjs 가 vendor/pokerogue/scripts/pb-export/ 로 복사해서 실행한다.
 *
 * 뽑는 것: 진화 조건(한국어 문장), 바이옴(연결·출현 포켓몬·트레이너), 트레이너(관장·사천왕·챔피언·고정 배틀).
 * 결과: vendor/pokerogue/pb-export-output/official.json
 */
import "../game-data-exporter/i18n"; // 반드시 먼저

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { speciesDataRegistry } from "#app/global-species-data-registry";
import { signatureSpecies } from "#balance/signature-species";
import { allBiomes } from "#data/data-lists";
import { BiomeId } from "#enums/biome-id";
import { BiomePoolTier } from "#enums/biome-pool-tier";
import { ClassicFixedBossWaves } from "#enums/fixed-boss-waves";
import { PokemonType } from "#enums/pokemon-type";
import { SpeciesId } from "#enums/species-id";
import { TimeOfDay } from "#enums/time-of-day";
import { TrainerType } from "#enums/trainer-type";
import { WeatherType } from "#enums/weather-type";
import { initBiomes } from "#init/init-biomes";
import { trainerConfigs } from "#trainers/trainer-config";
import { toCamelCase } from "#utils/strings";
import i18next from "i18next";
import { test } from "vitest";
import { getEvoConditionDescription } from "../game-data-exporter/data-generators/evolution-texts";

const ROOT = join(import.meta.dirname, "..", "..");
const OUT = join(ROOT, "pb-export-output");

/** enum(또는 const 객체) 값 → 키 이름. 숫자 enum·const 객체 둘 다 동작한다 */
const reverse = (o: object): Record<number, string> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => typeof v === "number").map(([k, v]) => [v, k]));
const BIOME = reverse(BiomeId);
const TIER = reverse(BiomePoolTier);
const TIME = reverse(TimeOfDay);
const TRAINER = reverse(TrainerType);
const WEATHER = reverse(WeatherType);
const PTYPE = reverse(PokemonType);

test("export party builder data", async () => {
  await i18next.changeLanguage("ko");
  await i18next.loadNamespaces([
    "pokemonEvolutions",
    "modifierType",
    "biome",
    "trainerNames",
    "trainerClasses",
    "trainerTitles",
    "pokemonInfo",
    "weather",
  ]);
  const t = i18next.getFixedT("ko");
  if (allBiomes.size === 0) initBiomes();

  // ── 진화
  const evolutions: unknown[] = [];
  for (const data of Object.values(speciesDataRegistry.data)) {
    for (const evo of data.evolutions ?? []) {
      evolutions.push({
        from: data.species.speciesId,
        fromForm: evo.preFormKey || null,
        to: evo.speciesId,
        toForm: evo.evoFormKey || null,
        level: evo.level,
        text: getEvoConditionDescription(evo, t),
      });
    }
  }

  const src = readFileSync(join(ROOT, "src/data/trainers/trainer-config.ts"), "utf8");
  const fixedSrc = readFileSync(join(ROOT, "src/data/trainers/fixed-battle-configs.ts"), "utf8");
  /** trainer-config.ts 안에서 한 트레이너의 설정 부분 */
  const configBlock = (tt: string) => {
    const start = src.indexOf(`[TrainerType.${tt}]: new TrainerConfig`);
    if (start < 0) return "";
    const end = src.indexOf("[TrainerType.", start + 20);
    return src.slice(start, end < 0 ? undefined : end);
  };

  // ── 바이옴
  const tierName = (tier: number) => TIER[tier];
  const timeName = (tod: number) => TIME[tod];
  const biomeName = (b: number) => t(`biome:${toCamelCase(BIOME[b])}`);
  const trainerName = (tt: number): string => {
    // .setName("Lance") 처럼 소스에 영어 이름이 있으면 그것으로 번역 키를 만든다 (LANCE_CHAMPION → lance)
    const setName = configBlock(TRAINER[tt]).match(/\.setName\("([^"]+)"\)/)?.[1];
    if (setName) {
      const sk = toCamelCase(setName);
      const sn = t(`trainerNames:${sk}`);
      if (sn !== sk) return sn;
    }
    const k = toCamelCase(TRAINER[tt]);
    const n = t(`trainerNames:${k}`);
    if (n !== k) return n;
    const c = t(`trainerClasses:${k}`);
    return c !== k ? c : TRAINER[tt];
  };
  const biomes = [...allBiomes.values()].map((b) => ({
    id: b.biomeId,
    key: BIOME[b.biomeId],
    name: biomeName(b.biomeId),
    links: b.biomeLinks.map((l) => (Array.isArray(l) ? { to: l[0], chance: 1 / l[1] } : { to: l, chance: 1 })),
    trainerChance: b.trainerChance,
    weather: Object.entries(b.weatherPool).map(([w, weight]) => ({
      key: WEATHER[Number(w)],
      weight,
    })),
    pokemon: Object.entries(b.pokemonPool).map(([tier, byTime]) => ({
      tier: tierName(Number(tier)),
      species: Object.entries(byTime).flatMap(([tod, list]) =>
        (list as SpeciesId[]).map((s) => ({ id: s, time: timeName(Number(tod)) })),
      ),
    })),
    trainers: Object.entries(b.trainerPool).map(([tier, list]) => ({
      tier: tierName(Number(tier)),
      trainers: (list as TrainerType[]).map((tt) => ({ type: TRAINER[tt], name: trainerName(tt) })),
    })),
  }));

  // ── 트레이너: 관장·사천왕은 대표 포켓몬(signatureSpecies), 챔피언은 소스에서 슬롯별 후보를 읽는다
  const speciesId = (name: string) => (SpeciesId as unknown as Record<string, number>)[name];

  /** 소스의 .setPartyMemberFunc(슬롯, getRandomPartyMemberFunc([후보...])) 를 읽는다 */
  const partySlots = (tt: string) => {
    const block = configBlock(tt);
    const slots: { slot: number; species: number[]; forms?: number[]; boss?: boolean }[] = [];
    const key = ".setPartyMemberFunc(";
    for (let at = block.indexOf(key); at >= 0; at = block.indexOf(key, at + 1)) {
      // 괄호 깊이를 세어 호출 전체(폼·보스 설정 콜백 포함)를 자른다
      let depth = 0;
      let end = at + key.length - 1;
      for (; end < block.length; end++) {
        if (block[end] === "(") depth++;
        else if (block[end] === ")" && --depth === 0) break;
      }
      const call = block.slice(at, end + 1);
      const m = /^\.setPartyMemberFunc\(\s*(\d+)\s*,\s*getRandomPartyMemberFunc\(\s*\[([^\]]*)\]/.exec(call);
      if (!m) continue;
      const species = [...m[2].matchAll(/SpeciesId\.(\w+)/g)].map((x) => speciesId(x[1])).filter((x) => x != null);
      // 폼: "p.formIndex = 1" 같은 상수, randSeedIntRange(a, b) 는 a~b 중 하나. 0 은 기본 폼이라 뺀다
      const forms = new Set<number>();
      for (const f of call.matchAll(/p\.formIndex\s*=\s*(\d+)\s*;/g)) if (Number(f[1]) > 0) forms.add(Number(f[1]));
      for (const f of call.matchAll(/p\.formIndex\s*=\s*randSeedIntRange\(\s*(\d+)\s*,\s*(\d+)\s*\)/g))
        for (let i = Number(f[1]); i <= Number(f[2]); i++) if (i > 0) forms.add(i);
      const slot: (typeof slots)[number] = { slot: Number(m[1]), species };
      if (forms.size) slot.forms = [...forms];
      if (/setBoss\(\s*true/.test(call)) slot.boss = true;
      slots.push(slot);
    }
    return slots;
  };

  const trainerInfo = (tt: number) => {
    const cfg = trainerConfigs[tt];
    const name = TRAINER[tt];
    const sig = (signatureSpecies as Record<string, (SpeciesId | SpeciesId[])[]>)[name];
    return {
      type: name,
      name: trainerName(tt),
      title: cfg?.title ? t(`trainerTitles:${cfg.title}`) : null,
      specialty: cfg?.specialtyType != null && cfg.specialtyType >= 0 ? PTYPE[cfg.specialtyType] : null,
      // 대표 포켓몬 (관장은 파티 뒤쪽부터 이 후보로 채운다). 비어 있으면 슬롯 지정만 있는 트레이너
      signature: sig?.length ? sig.map((x) => (Array.isArray(x) ? x : [x])) : null,
      // 슬롯 번호별 고정 후보 (사천왕·챔피언 등)
      slots: partySlots(name),
    };
  };

  // 고정 배틀 웨이브별 후보 트레이너 (getRandomTrainerFunc([...]) 목록)
  const fixedWaves: { wave: number; key: string; trainers: string[][] }[] = [];
  for (const [k, wave] of Object.entries(ClassicFixedBossWaves).filter(([, v]) => typeof v === "number")) {
    const start = fixedSrc.indexOf(`[ClassicFixedBossWaves.${k}]:`);
    if (start < 0) continue;
    const end = fixedSrc.indexOf("[ClassicFixedBossWaves.", start + 10);
    const block = fixedSrc.slice(start, end < 0 ? undefined : end);
    const at = block.indexOf("getRandomTrainerFunc(");
    const trainers: string[][] = [];
    if (at >= 0) {
      // 괄호 깊이를 세어 바깥 배열만 읽는다. [A, B] 묶음은 둘 중 하나가 나오는 짝
      let depth = 0;
      let group: string[] | null = null;
      for (let i = block.indexOf("[", at); i < block.length; i++) {
        const ch = block[i];
        if (ch === "[") {
          depth++;
          if (depth === 2) group = [];
        } else if (ch === "]") {
          if (depth === 2 && group) {
            trainers.push(group);
            group = null;
          }
          if (--depth === 0) break;
        } else if (block.startsWith("TrainerType.", i)) {
          const name = /^\w+/.exec(block.slice(i + 12))![0];
          if (depth === 2 && group) group.push(name);
          else if (depth === 1) trainers.push([name]);
          i += 11 + name.length;
        }
      }
    } else {
      const one = block.match(/TrainerType\.(\w+)/);
      if (one) trainers.push([one[1]]);
    }
    fixedWaves.push({ wave: wave as number, key: k, trainers });
  }

  const gymLeaders = new Set<number>();
  for (const b of allBiomes.values()) for (const tt of b.trainerPool[BiomePoolTier.BOSS]) gymLeaders.add(tt);
  const named = new Set<number>(gymLeaders);
  for (const w of fixedWaves) for (const g of w.trainers) for (const n of g) named.add((TrainerType as unknown as Record<string, number>)[n]);

  // 관장 세대: TrainerType 열거 순서(BROCK=200 부터 세대별로 이어짐)에서 각 세대 첫 관장 기준
  const GYM_GEN_START = ["BROCK", "FALKNER", "ROXANNE", "ROARK", "CILAN", "VIOLA", null, "MILO", "KATY"];
  const gymGen = (tt: number) => {
    let gen: number | null = null;
    GYM_GEN_START.forEach((n, i) => {
      const v = n && (TrainerType as unknown as Record<string, number>)[n];
      if (v != null && tt >= v) gen = i + 1;
    });
    return gen;
  };

  const trainers = [...named].filter((x) => x != null).map((tt) => ({
    ...trainerInfo(tt),
    gymLeader: gymLeaders.has(tt),
    gen: gymLeaders.has(tt) ? gymGen(tt) : null,
    biomes: [...allBiomes.values()].filter((b) => b.trainerPool[BiomePoolTier.BOSS].includes(tt)).map((b) => b.biomeId),
  }));

  mkdirSync(OUT, { recursive: true });
  writeFileSync(
    join(OUT, "official.json"),
    JSON.stringify({
      source: { name: "pagefaultgames/pokerogue", license: "AGPL-3.0" },
      evolutions,
      biomes,
      trainers,
      fixedWaves,
    }),
  );
  console.log(`evolutions ${evolutions.length}, biomes ${biomes.length}, trainers ${trainers.length}, fixed waves ${fixedWaves.length}`);
}, 300_000);
