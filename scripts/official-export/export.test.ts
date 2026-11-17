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
import { test, vi } from "vitest";
import { getPokerusStarters } from "#utils/pokemon-utils";
import { getLegendaryGachaSpeciesForTimestamp, getValidLegendaryGachaSpecies } from "#data/egg";
import { getEvoConditionDescription } from "../game-data-exporter/data-generators/evolution-texts";
import { EvolutionItem } from "#balance/pokemon-evolutions";
import {
  MeloettaFormChangePostMoveTrigger,
  SpeciesFormChangeAbilityTrigger,
  SpeciesFormChangeActiveTrigger,
  SpeciesFormChangeCompoundTrigger,
  SpeciesFormChangeItemTrigger,
  SpeciesFormChangeLapseTeraTrigger,
  SpeciesFormChangeMoveLearnedTrigger,
  SpeciesFormChangePostMoveTrigger,
  SpeciesFormChangePreMoveTrigger,
  SpeciesFormChangeRevertWeatherFormTrigger,
  SpeciesFormChangeStatusEffectTrigger,
  SpeciesFormChangeTeraTrigger,
  SpeciesFormChangeTimeOfDayTrigger,
  SpeciesFormChangeWeatherTrigger,
} from "#data/form-change-triggers";
import { FormChangeItem } from "#enums/form-change-item";
import { MoveId } from "#enums/move-id";

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

/**
 * 한국어 조사 자리표시([[가]]·[[을]] 등)를 앞 글자의 받침에 맞게 고른다.
 * 게임은 i18next 후처리로 하지만 추출 환경에서는 돌지 않아 그대로 남는다. 앞이 한글이 아니면 지운다.
 */
const JOSA: Record<string, [string, string]> = {
  가: ["이", "가"], 이: ["이", "가"], 을: ["을", "를"], 를: ["을", "를"], 은: ["은", "는"], 는: ["은", "는"],
  과: ["과", "와"], 와: ["과", "와"], 으로: ["으로", "로"], 로: ["으로", "로"],
};
function fixJosa(text: string): string {
  return text
    .replace(/(.?)\[\[(가|이|을|를|은|는|과|와|으로|로)\]\]/g, (_, prev: string, j: string) => {
      const code = prev ? prev.charCodeAt(0) - 0xac00 : -1;
      // 영문·숫자는 한국어로 읽은 소리의 받침으로 본다 (X 엑스 → 받침 없음, Z 제트 → 받침, L 엘·1 일 → ㄹ)
      const latin: Record<string, number> = { L: 8, M: 16, N: 4, R: 8, Z: 25, "0": 21, "1": 8, "3": 16, "6": 1, "7": 8, "8": 8 };
      if ((code < 0 || code > 11171) && !/^[A-Za-z0-9]$/.test(prev)) return prev; // 앞이 한글이 아니면(괄호 등) 조사를 뺀다
      const jong = code >= 0 && code <= 11171 ? code % 28 : (latin[prev.toUpperCase()] ?? 0);
    const [withBatchim, without] = JOSA[j];
    // "으로"는 ㄹ 받침(8) 뒤에서 "로"
      const pick = j === "으로" || j === "로" ? (jong === 0 || jong === 8 ? without : withBatchim) : jong ? withBatchim : without;
      return prev + pick;
    })
    .trim();
}

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
    "move",
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
        text: getEvoConditionDescription(evo, t).map(fixJosa),
        // 진화 아이템 이미지 키 (게임 아이템 그림 이름 = 열거 키 소문자)
        item: evo.item ? EvolutionItem[evo.item].toLowerCase() : null,
      });
    }
  }

  // ── 폼 변화 (메가·거다이맥스·원시회귀·오리진폼·아이템·날씨 등)
  // 트리거 설명은 게임 코드가 처음 읽힐 때(한국어로 바꾸기 전) 만들어지므로 같은 번역 키로 다시 만든다.
  type AnyTrigger = { constructor: unknown } & Record<string, unknown>;
  const describe = (tr: AnyTrigger): { text: string; items: string[]; revert?: boolean } => {
    const f = (k: string, o?: Record<string, string>) => fixJosa(t(`pokemonEvolutions:forms.${k}`, o));
    if (tr instanceof SpeciesFormChangeCompoundTrigger) {
      const parts = tr.triggers.map((x) => describe(x as unknown as AnyTrigger));
      return {
        text: parts.map((x) => x.text).filter(Boolean).join(", "),
        items: parts.flatMap((x) => x.items),
        revert: parts.some((x) => x.revert),
      };
    }
    if (tr instanceof SpeciesFormChangeItemTrigger) {
      const key = FormChangeItem[tr.item];
      const item = t(`modifierType:FormChangeItem.${key}`);
      return {
        text: f(tr.active ? "item" : "deactivateItem", { item }),
        items: tr.active ? [key.toLowerCase()] : [],
        revert: !tr.active,
      };
    }
    if (tr instanceof SpeciesFormChangeMoveLearnedTrigger) {
      const move = t(`move:${toCamelCase(MoveId[tr.move])}.name`);
      return { text: f(tr.known ? "moveLearned" : "moveForgotten", { move }), items: [] };
    }
    if (tr instanceof MeloettaFormChangePostMoveTrigger) return { text: f("move", { move: t("move:relicSong.name") }), items: [] };
    const simple: [unknown, string][] = [
      [SpeciesFormChangeAbilityTrigger, "ability"],
      [SpeciesFormChangeTimeOfDayTrigger, "timeOfDay"],
      [SpeciesFormChangeStatusEffectTrigger, "statusEffect"],
      [SpeciesFormChangePreMoveTrigger, "preMove"],
      [SpeciesFormChangePostMoveTrigger, "postMove"],
      [SpeciesFormChangeTeraTrigger, "tera"],
      [SpeciesFormChangeLapseTeraTrigger, "teraLapse"],
      [SpeciesFormChangeWeatherTrigger, "weather"],
      [SpeciesFormChangeRevertWeatherFormTrigger, "weatherRevert"],
    ];
    if (tr instanceof SpeciesFormChangeActiveTrigger) return { text: f(tr.active ? "enter" : "leave"), items: [] };
    for (const [cls, k] of simple) if (tr instanceof (cls as new (...a: never[]) => object)) return { text: f(k), items: [] };
    return { text: "", items: [] }; // 수동·기본 폼 맞춤 트리거는 도감에 보이지 않는다
  };
  const formChanges: unknown[] = [];
  for (const data of Object.values(speciesDataRegistry.data)) {
    const sp = data.species;
    for (const fc of data.formChanges ?? []) {
      const toForm = sp.forms.findIndex((x) => x.formKey === fc.formKey);
      if (toForm <= 0) continue; // 기본 폼으로 돌아가는 변화는 빼고, 들어가는 쪽만
      const d = describe(fc.trigger as unknown as AnyTrigger);
      if ((!d.text && !d.items.length) || d.revert) continue; // 아이템을 떼서 되돌아가는 변화는 뺀다
      // 같은 폼으로 가는 같은 조건(예: 캐스퐁 날씨 폼끼리)은 한 번만
      if ((formChanges as { species: number; toForm: number; text: string }[]).some(
        (x) => x.species === sp.speciesId && x.toForm === toForm && x.text === d.text,
      )) continue;
      formChanges.push({
        species: sp.speciesId,
        fromForm: Math.max(0, sp.forms.findIndex((x) => x.formKey === fc.preFormKey)),
        toForm,
        text: d.text,
        items: [...new Set(d.items)],
      });
    }
  }

  // ── 아이템 그림: 게임 에셋의 아이템 스프라이트 시트(items.json)에서 쓰는 아이템 칸 좌표만 뽑는다
  const itemKeys = new Set<string>([
    ...(evolutions as { item: string | null }[]).map((e) => e.item).filter((x): x is string => !!x),
    ...(formChanges as { items: string[] }[]).flatMap((x) => x.items),
    // 스타터 사탕: 바탕(candy)과 덧그림(candy_overlay)을 포켓몬별 두 색으로 물들여 그린다
    "candy",
    "candy_overlay",
  ]);
  // 포켓몬별 사탕 색 [바탕, 덧그림] (에셋 저장소의 starter-colors.json, 자동 생성 파일)
  let starterColors: Record<string, [string, string]> = {};
  try {
    starterColors = JSON.parse(readFileSync(join(ROOT, "..", "pokerogue-assets", "starter-colors.json"), "utf8"));
  } catch {
    console.warn("starter-colors.json 이 없어 사탕 색 없이 진행합니다.");
  }
  const itemSprites: Record<string, { x: number; y: number; w: number; h: number; ox: number; oy: number; sw: number; sh: number; name: string; tier: string }> = {};
  // 아이템 등급: 게임 상점 풀과 같은 규칙 (modifier-type.ts 의 EvolutionItem/FormChangeItem 생성기)
  //  진화 아이템: 번호 50 이하는 슈퍼(EVOLUTION_ITEM), 50 초과는 하이퍼(RARE_EVOLUTION_ITEM)
  //  폼 변화 아이템: 번호 150 미만(메가스톤 등)은 로그(RARE_FORM_CHANGE_ITEM), 150 이상은 하이퍼(FORM_CHANGE_ITEM)
  const itemTier = (evo: number | undefined, form: number | undefined) =>
    evo != null ? (evo > 50 ? "ultra" : "great") : form != null ? (form < 150 ? "rogue" : "ultra") : "common";
  const atlasPath = join(ROOT, "..", "pokerogue-assets", "images", "items.json");
  let itemAtlas: { w: number; h: number } | null = null;
  try {
    const atlas = JSON.parse(readFileSync(atlasPath, "utf8"));
    itemAtlas = atlas.textures[0].size;
    for (const fr of atlas.textures[0].frames) {
      if (!itemKeys.has(fr.filename)) continue;
      const key = fr.filename as string;
      const evoNo = (EvolutionItem as unknown as Record<string, number>)[key.toUpperCase()];
      const formNo = (FormChangeItem as unknown as Record<string, number>)[key.toUpperCase()];
      const evoName = evoNo != null ? t(`modifierType:EvolutionItem.${key.toUpperCase()}`) : "";
      const formName = formNo != null ? t(`modifierType:FormChangeItem.${key.toUpperCase()}`) : "";
      itemSprites[key] = {
        x: fr.frame.x, y: fr.frame.y, w: fr.frame.w, h: fr.frame.h,
        ox: fr.spriteSourceSize.x, oy: fr.spriteSourceSize.y, sw: fr.sourceSize.w, sh: fr.sourceSize.h,
        name: evoName || formName || key,
        tier: itemTier(evoNo, formNo),
      };
    }
  } catch {
    console.warn(`아이템 스프라이트 시트를 찾지 못했습니다 (${atlasPath}). 아이템 그림 없이 진행합니다.`);
  }

  // ── 포켓러스: 전체 스타터 목록(게임 순서 그대로)과, 검증용으로 몇몇 날짜의 실제 결과
  const starterIds = speciesDataRegistry.getAllStarters() as number[];
  const pokerusSamples: { date: string; ids: number[] }[] = [];
  try {
    // 추출 환경에서는 게임이 Phaser 난수 생성기를 만들지 않으므로 하나 만들어 둔다
    const P = (globalThis as unknown as { Phaser: { Math: { RND: unknown; RandomDataGenerator: new () => unknown } } }).Phaser;
    if (!P.Math.RND) P.Math.RND = new P.Math.RandomDataGenerator();
    for (const date of ["2024-06-01", "2025-01-01", "2026-11-15", "2026-12-31"]) {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(`${date}T12:00:00Z`));
      pokerusSamples.push({ date, ids: getPokerusStarters() as number[] });
      vi.useRealTimers();
    }
  } catch (e) {
    vi.useRealTimers();
    console.warn("포켓러스 표본을 만들지 못했습니다:", e);
  }

  // ── 알 뽑기 전설 픽업: 후보 목록(게임 순서 그대로)과 검증용 날짜별 결과
  const legendaryGachaIds = getValidLegendaryGachaSpecies() as number[];
  const legendarySamples: { date: string; id: number }[] = [];
  try {
    for (const date of ["2024-06-01", "2025-01-01", "2026-11-15", "2026-12-31", "2027-03-03"]) {
      legendarySamples.push({ date, id: getLegendaryGachaSpeciesForTimestamp(Date.parse(`${date}T12:00:00Z`)) as number });
    }
  } catch (e) {
    console.warn("전설 픽업 표본을 만들지 못했습니다:", e);
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
      formChanges,
      itemSprites,
      itemAtlas,
      starterColors,
      starterIds,
      pokerusSamples,
      legendaryGachaIds,
      legendarySamples,
      biomes,
      trainers,
      fixedWaves,
    }),
  );
  console.log(`form changes ${formChanges.length}, item sprites ${Object.keys(itemSprites).length}/${itemKeys.size}`);
  console.log(`evolutions ${evolutions.length}, biomes ${biomes.length}, trainers ${trainers.length}, fixed waves ${fixedWaves.length}`);
}, 300_000);
