/*
 * Builds public/data/dex.json from the official PokeRogue repository (pagefaultgames/pokerogue, AGPL-3.0).
 * Runs inside vendor/pokerogue (copied to scripts/pb-export/ by scripts/export-official.mjs).
 *
 * The output keeps the app's DexData shape (src/lib/dex.ts). IDs ("fid"):
 *   types     0-17           = PokemonType (game order)
 *   abilities 1000 + AbilityId
 *   moves     2000 + MoveId
 * Move tags and effects (procs) follow the app's existing numbering (TAG_NAMES / PROC_NAMES below) and are
 * derived from the official move / ability attributes and flags.
 * Result: vendor/pokerogue/pb-export-output/dex.json
 */
import "../game-data-exporter/i18n"; // must be first

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { speciesDataRegistry } from "#app/global-species-data-registry";
import { allAbilities, allMoves } from "#data/data-lists";
import { speciesEggMoves } from "#balance/moves/egg-moves";
import { tmPoolTiers } from "#balance/tm-pool-tiers";
import { AbilityId } from "#enums/ability-id";
import { FormChangeItem } from "#enums/form-change-item";
import { ModifierTier } from "#enums/modifier-tier";
import { MoveCategory } from "#enums/move-category";
import { MoveFlags } from "#enums/move-flags";
import { MoveId } from "#enums/move-id";
import { MoveTarget } from "#enums/move-target";
import { MultiHitType } from "#enums/multi-hit-type";
import { PokemonType } from "#enums/pokemon-type";
import { SpeciesId } from "#enums/species-id";
import { StatusEffect } from "#enums/status-effect";
import { WeatherType } from "#enums/weather-type";
import { BattlerTagType } from "#enums/battler-tag-type";
import { getLevelMoves } from "#field/learnsets";
import { initAbilities } from "#abilities/init-abilities";
import { initMoves } from "#moves/move";
import {
  CritOnlyAttr,
  CutHpStatStageBoostAttr,
  DoublePowerChanceAttr,
  FlinchAttr,
  ConfuseAttr,
  ForceSwitchOutAttr,
  HalfSacrificialAttr,
  HealStatusEffectAttr,
  HighCritAttr,
  HitHealAttr,
  MultiHitAttr,
  MultiStatusEffectAttr,
  OneHitKOAttr,
  RecoilAttr,
  RemoveArenaTrapAttr,
  StatStageChangeAttr,
  StormAccuracyAttr,
  ThunderAccuracyAttr,
  StatusEffectAttr,
  TrapAttr,
  AddBattlerTagAttr,
} from "#moves/move";
import {
  IntimidateImmunityAbAttr,
  MoveAbilityBypassAbAttr,
  PostDefendWeatherChangeAbAttr,
  PostSummonWeatherChangeAbAttr,
  TypeImmunityAbAttr,
  UngroundedAbAttr,
} from "#abilities/ab-attrs";
import { failIfDampCondition } from "#moves/move-condition";
import { SpeciesFormChangeAbilityTrigger, SpeciesFormChangeItemTrigger } from "#data/form-change-triggers";
import i18next from "i18next";
import { test } from "vitest";
import variantMasterlist from "../../assets/images/pokemon/variant/_masterlist.json";

const ROOT = join(import.meta.dirname, "..", "..");
const OUT = join(ROOT, "pb-export-output");
const ABILITY_BASE = 1000;
const MOVE_BASE = 2000;
const abilityFid = (id: number) => ABILITY_BASE + id;
const moveFid = (id: number) => MOVE_BASE + id;

/** Type colors used by the app (UI palette, game type order) */
const TYPE_COLORS = [
  "#ADA594", "#A55239", "#9CADF7", "#9141CB", "#AE7A3B", "#BDA55A", "#ADBD21", "#6363B5", "#81A6BE",
  "#F75231", "#399CFF", "#7BCE52", "#FFC631", "#EF4179", "#5ACEE7", "#7B63E7", "#735A4A", "#EF70EF",
];

/** Move effect labels (MoveProc[1]). 0-6 user stat, 7-13 target stat, 14-21 status, 22 user all stats */
const PROC_NAMES = [
  "사용자 공격", "사용자 방어", "사용자 특수공격", "사용자 특수방어", "사용자 스피드", "사용자 명중률", "사용자 회피율",
  "공격", "방어", "특수공격", "특수방어", "스피드", "명중률", "회피율",
  "중독 부여", "맹독 부여", "잠듦 부여", "얼음 부여", "마비 부여", "화상 부여", "혼란 부여", "풀죽음",
  "사용자 공/방/특공/특방/스피드", "중독/마비/잠듦", "화상/마비/얼음", "스텔라 사용자 공/특공", "데미지", "우선도",
];

/** Move / ability tag labels. Numbers are used by the app (src/lib/dex.ts TAG) */
const TAG_NAMES = [
  "대상: 무작위 적", "대상: 모든 적", "대상: 전체 필드", "우격다짐의 영향을 받음", "급소율 높음", "급소 확정", "사용자 급소율 +2",
  "사용자 공격 최대", "HP 33% 소모", "HP 50% 소모", "반동 HP 50%", "반동 피해의 50%", "반동 피해의 33%", "반동 피해의 25%",
  "30% 확률 2배 피해", "가한 피해의 100% 회복", "가한 피해의 75% 회복", "가한 피해의 50% 회복", "상대 공격력만큼 회복",
  "상태 이상 회복", "수면 회복", "얼음 회복", "화상 회복", "풀/방진 특성 무효", "풀 타입에 씨뿌리기 불가", "힐링시프트 특성 발동",
  "춤꾼 특성 발동", "바람타기 특성 발동", "예리함으로 강화", "철주먹으로 강화", "메가런처로 강화", "옹골찬턱으로 강화",
  "이판사판으로 강화", "방탄 특성에 무효", "습기 특성에 방해됨", "소리 기반 기술", "대타출동 무시", "특성 무시", "방어/지키기 무시",
  "사용자 교체", "상대 교체", "2회 공격", "3회 공격", "10회 공격", "2~5회 공격", "2~3턴 동안 반복", "장애물 제거",
  "상대를 가두고 피해", "무효화 불가", "교체 불가", "무시 불가", "재지정 불가", "반사 불가", "비 오는 날씨에서 항상 명중",
  "사용자 교체 불가", "상대 교체 불가", "전기 면역", "불꽃 면역", "땅 면역", "물 면역", "위협 면역", "비 시너지", "비 생성",
  "모래 시너지", "모래 생성", "눈 시너지", "햇빛 시너지", "햇빛 생성", "일격 기술", "보스전에서 수정됨", "보스에게 효과 없음",
  "더블배틀코롱 특성", "접촉 기술", "부분 구현됨", "미구현",
];
const T = Object.fromEntries(TAG_NAMES.map((n, i) => [n, i])) as Record<string, number>;

/** Mega stones listed after this one in FormChangeItem are the newer megas (Legends Z-A and later) */
const FIRST_NEW_MEGA_STONE = FormChangeItem.CLEFABLITE;

/** Weather keyword per synergy / setter tag (ability source text is matched for "WeatherType.X") */
const WEATHER_TAGS: [WeatherType[], number | null, number | null][] = [
  [[WeatherType.RAIN, WeatherType.HEAVY_RAIN], T["비 시너지"], T["비 생성"]],
  [[WeatherType.SANDSTORM], T["모래 시너지"], T["모래 생성"]],
  [[WeatherType.HAIL, WeatherType.SNOW], T["눈 시너지"], null],
  [[WeatherType.SUNNY, WeatherType.HARSH_SUN], T["햇빛 시너지"], T["햇빛 생성"]],
];

/** Source text of each ability's builder chain, for conditions that are closures (e.g. Swift Swim in rain) */
function abilitySourceBlocks(): Map<number, string> {
  const src = readFileSync(join(ROOT, "src", "data", "abilities", "init-abilities.ts"), "utf8");
  const out = new Map<number, string>();
  const re = /new AbBuilder\(AbilityId\.(\w+)/g;
  const hits = [...src.matchAll(re)];
  hits.forEach((m, i) => {
    const end = i + 1 < hits.length ? hits[i + 1].index : src.length;
    out.set(AbilityId[m[1] as keyof typeof AbilityId], src.slice(m.index, end));
  });
  return out;
}

function abilityTags(a: (typeof allAbilities)[number], block: string): number[] {
  const tags = new Set<number>();
  const attrs = a.attrs as unknown[];
  for (const attr of attrs) {
    if (attr instanceof TypeImmunityAbAttr) {
      const t = (attr as unknown as { immuneType: PokemonType | null }).immuneType;
      if (t === PokemonType.ELECTRIC) tags.add(T["전기 면역"]);
      if (t === PokemonType.FIRE) tags.add(T["불꽃 면역"]);
      if (t === PokemonType.GROUND) tags.add(T["땅 면역"]);
      if (t === PokemonType.WATER) tags.add(T["물 면역"]);
    }
    if (attr instanceof UngroundedAbAttr) tags.add(T["땅 면역"]);
    if (attr instanceof IntimidateImmunityAbAttr) tags.add(T["위협 면역"]);
    if (attr instanceof MoveAbilityBypassAbAttr) tags.add(T["특성 무시"]);
  }
  const setters = attrs
    .filter((x) => x instanceof PostSummonWeatherChangeAbAttr || x instanceof PostDefendWeatherChangeAbAttr)
    .map((x) => (x as unknown as { weatherType: WeatherType }).weatherType);
  // Synergy: the weather appears in the ability's weather conditions, weather healing / damage blocking, or it
  // sets the weather on entry. Form-change weather lists and move charge checks do not count.
  const synergyText = [
    ...block.matchAll(/getWeatherCondition\(([^)]*)\)/g),
    ...block.matchAll(/\.attr\((?:PostWeatherLapseHealAbAttr|BlockWeatherDamageAttr|PostSummonWeatherChangeAbAttr)[^)]*\)/g),
  ].map((x) => x[0]);
  for (const [weathers, synergy, setter] of WEATHER_TAGS) {
    if (setter != null && setters.some((w) => weathers.includes(w))) tags.add(setter);
    const mentions = weathers.some((w) =>
      synergyText.some((t) => new RegExp(`WeatherType\\.${WeatherType[w]}\\b`).test(t)),
    );
    if (synergy != null && mentions) tags.add(synergy);
  }
  if (!a.suppressable) tags.add(T["무효화 불가"]);
  if (!a.replaceable) tags.add(T["교체 불가"]);
  if (a.partial) tags.add(T["부분 구현됨"]);
  if (a.unimplemented) tags.add(T["미구현"]);
  return [...tags].sort((x, y) => x - y);
}

type Proc = [number, number, number];

/** Source text of each move's builder chain in initMoves, for module-private conditions */
function moveSourceBlocks(): Map<number, string> {
  const src = readFileSync(join(ROOT, "src", "data", "moves", "move.ts"), "utf8");
  const body = src.slice(src.indexOf("export function initMoves"));
  const hits = [...body.matchAll(/new \w+\(MoveId\.(\w+),/g)];
  const out = new Map<number, string>();
  hits.forEach((h, i) => {
    const end = i + 1 < hits.length ? hits[i + 1].index : body.length;
    out.set(MoveId[h[1] as keyof typeof MoveId], body.slice(h.index, end));
  });
  return out;
}

function moveTagsAndProcs(m: (typeof allMoves)[number], block: string): { tags: number[]; procs: Proc[] } {
  const tags = new Set<number>();
  // failOnBossCondition is private to move.ts, so it is read from the move's source
  if (/\bfailOnBossCondition\b/.test(block)) tags.add(T["보스에게 효과 없음"]);
  const procs: Proc[] = [];
  // Charge moves keep their first-turn effects (e.g. Meteor Beam's Sp. Atk boost) in chargeAttrs
  const attrs = [...(m.attrs as unknown[]), ...(((m as unknown as { chargeAttrs?: unknown[] }).chargeAttrs) ?? [])];
  const has = (f: MoveFlags) => m.hasFlag(f);
  // Effect chance as the game rolls it: -1 = always (status moves and effects without a chance)
  const chance = m.chance >= 1 ? m.chance : -1;
  // Ignoring Protect only matters for moves not aimed at the user alone
  const selfOrSide = m.moveTarget === MoveTarget.USER;

  switch (m.moveTarget) {
    case MoveTarget.RANDOM_NEAR_ENEMY:
      tags.add(T["대상: 무작위 적"]);
      break;
    case MoveTarget.ALL_NEAR_ENEMIES:
    case MoveTarget.ALL_ENEMIES:
      tags.add(T["대상: 모든 적"]);
      break;
    case MoveTarget.ALL_NEAR_OTHERS:
    case MoveTarget.ALL_OTHERS:
      tags.add(T["대상: 전체 필드"]);
      break;
  }
  // Sheer Force boosts any move with an effect chance (init-abilities: move.chance >= 1)
  if (m.chance >= 1) tags.add(T["우격다짐의 영향을 받음"]);
  if (m.hasCondition(failIfDampCondition)) tags.add(T["습기 특성에 방해됨"]);
  if (has(MoveFlags.POWDER_MOVE)) tags.add(T["풀/방진 특성 무효"]);
  if (has(MoveFlags.HEALING_MOVE)) tags.add(T["힐링시프트 특성 발동"]);
  if (has(MoveFlags.DANCE_MOVE)) tags.add(T["춤꾼 특성 발동"]);
  if (has(MoveFlags.WIND_MOVE)) tags.add(T["바람타기 특성 발동"]);
  if (has(MoveFlags.SLICING_MOVE)) tags.add(T["예리함으로 강화"]);
  if (has(MoveFlags.PUNCHING_MOVE)) tags.add(T["철주먹으로 강화"]);
  if (has(MoveFlags.PULSE_MOVE)) tags.add(T["메가런처로 강화"]);
  if (has(MoveFlags.BITING_MOVE)) tags.add(T["옹골찬턱으로 강화"]);
  if (has(MoveFlags.RECKLESS_MOVE)) tags.add(T["이판사판으로 강화"]);
  if (has(MoveFlags.BALLBOMB_MOVE)) tags.add(T["방탄 특성에 무효"]);
  if (has(MoveFlags.SOUND_BASED)) tags.add(T["소리 기반 기술"]);
  // Sound moves also go through Substitute (Move.hitsSubstitute)
  if (has(MoveFlags.IGNORE_SUBSTITUTE) || has(MoveFlags.SOUND_BASED)) tags.add(T["대타출동 무시"]);
  if (has(MoveFlags.IGNORE_ABILITIES)) tags.add(T["특성 무시"]);
  if (has(MoveFlags.IGNORE_PROTECT) && !selfOrSide) tags.add(T["방어/지키기 무시"]);
  if (has(MoveFlags.MAKES_CONTACT)) tags.add(T["접촉 기술"]);

  for (const attr of attrs) {
    if (attr instanceof HighCritAttr) tags.add(T["급소율 높음"]);
    if (attr instanceof CritOnlyAttr) tags.add(T["급소 확정"]);
    if (attr instanceof CutHpStatStageBoostAttr) {
      const cut = (attr as unknown as { cutRatio: number }).cutRatio;
      if (attr.stages >= 12) tags.add(T["사용자 공격 최대"]);
      tags.add(cut === 3 ? T["HP 33% 소모"] : T["HP 50% 소모"]);
    }
    if (attr instanceof HalfSacrificialAttr) tags.add(T["반동 HP 50%"]);
    if (attr instanceof RecoilAttr) {
      const r = (attr as unknown as { damageRatio: number; useHp: boolean }).damageRatio;
      const useHp = (attr as unknown as { useHp: boolean }).useHp;
      if (useHp) tags.add(T["반동 HP 50%"]);
      else if (r >= 0.5) tags.add(T["반동 피해의 50%"]);
      else if (r >= 0.33) tags.add(T["반동 피해의 33%"]);
      else tags.add(T["반동 피해의 25%"]);
    }
    if (attr instanceof DoublePowerChanceAttr) tags.add(T["30% 확률 2배 피해"]);
    if (attr instanceof HitHealAttr) {
      const r = (attr as unknown as { healRatio: number; healStat: unknown }).healRatio;
      const stat = (attr as unknown as { healStat: unknown }).healStat;
      if (stat != null) tags.add(T["상대 공격력만큼 회복"]);
      else if (r >= 1) tags.add(T["가한 피해의 100% 회복"]);
      else if (r >= 0.75) tags.add(T["가한 피해의 75% 회복"]);
      else tags.add(T["가한 피해의 50% 회복"]);
    }
    if (attr instanceof HealStatusEffectAttr) {
      const effects = (attr as unknown as { effects: StatusEffect[] }).effects;
      if (effects.includes(StatusEffect.FREEZE) && effects.length === 1) tags.add(T["얼음 회복"]);
      else if (effects.includes(StatusEffect.SLEEP) && effects.length === 1) tags.add(T["수면 회복"]);
      else if (effects.includes(StatusEffect.BURN) && effects.length === 1) tags.add(T["화상 회복"]);
      else tags.add(T["상태 이상 회복"]);
    }
    if (attr instanceof ForceSwitchOutAttr) {
      tags.add((attr as unknown as { selfSwitch: boolean }).selfSwitch ? T["사용자 교체"] : T["상대 교체"]);
    }
    if (attr instanceof MultiHitAttr) {
      const t = (attr as unknown as { intrinsicMultiHitType: MultiHitType }).intrinsicMultiHitType;
      if (t === MultiHitType.TWO) tags.add(T["2회 공격"]);
      if (t === MultiHitType.THREE) tags.add(T["3회 공격"]);
      if (t === MultiHitType.TEN) tags.add(T["10회 공격"]);
      if (t === MultiHitType.TWO_TO_FIVE) tags.add(T["2~5회 공격"]);
    }
    if (attr instanceof RemoveArenaTrapAttr) tags.add(T["장애물 제거"]);
    if (attr instanceof TrapAttr) tags.add(T["상대를 가두고 피해"]);
    if (attr instanceof OneHitKOAttr) {
      tags.add(T["일격 기술"]);
      tags.add(T["보스전에서 수정됨"]); // OneHitKOAttr fails against boss-immune targets
    }
    if (attr instanceof ThunderAccuracyAttr || attr instanceof StormAccuracyAttr) {
      tags.add(T["비 오는 날씨에서 항상 명중"]);
    }
    if (attr instanceof AddBattlerTagAttr && !(attr instanceof TrapAttr)) {
      const tag = (attr as unknown as { tagType: BattlerTagType }).tagType;
      if (tag === BattlerTagType.FRENZY) tags.add(T["2~3턴 동안 반복"]);
      if (tag === BattlerTagType.CRIT_BOOST) tags.add(T["사용자 급소율 +2"]);
      if (tag === BattlerTagType.TRAPPED) tags.add(attr.selfTarget ? T["사용자 교체 불가"] : T["상대 교체 불가"]);
    }

    // Effects (procs)
    if (attr instanceof StatStageChangeAttr) {
      const stats = (attr as unknown as { stats: number[] }).stats;
      const stages = attr.stages;
      if (attr.selfTarget && stats.length >= 5) procs.push([chance, 22, stages]);
      else for (const s of stats) procs.push([chance, (attr.selfTarget ? 0 : 7) + s - 1, stages]);
    }
    if (attr instanceof MultiStatusEffectAttr) {
      const e = (attr as unknown as { effects: StatusEffect[] }).effects;
      procs.push([chance, e.includes(StatusEffect.POISON) ? 23 : 24, 0]);
    } else if (attr instanceof StatusEffectAttr && !attr.selfTarget) {
      const map: Partial<Record<StatusEffect, number>> = {
        [StatusEffect.POISON]: 14,
        [StatusEffect.TOXIC]: 15,
        [StatusEffect.SLEEP]: 16,
        [StatusEffect.FREEZE]: 17,
        [StatusEffect.PARALYSIS]: 18,
        [StatusEffect.BURN]: 19,
      };
      const p = map[(attr as unknown as { effect: StatusEffect }).effect];
      if (p != null) procs.push([chance, p, 0]);
    }
    if (attr instanceof ConfuseAttr && !attr.selfTarget) procs.push([chance, 20, 0]);
    if (attr instanceof FlinchAttr) procs.push([chance, 21, 0]);
  }
  if (String((m as unknown as { nameAppend: string }).nameAppend).includes("(P)")) {
    tags.add(T["부분 구현됨"]);
  }
  if (String((m as unknown as { nameAppend: string }).nameAppend).includes("(N)")) tags.add(T["미구현"]);
  return { tags: [...tags].sort((x, y) => x - y), procs };
}

test(
  "export dex",
  async () => {
    await i18next.changeLanguage("ko");
    await i18next.loadNamespaces(["pokemon", "pokemonForm", "battlePokemonForm", "pokemonCategory", "move", "ability", "pokemonInfo"]);
    if (allMoves.length === 0) initMoves();
    if (allAbilities.length === 0) initAbilities();
    for (const m of allMoves) m.localize();

    const names: (string | null)[] = [];
    const descriptions: Record<string, string> = {};
    for (let t = 0; t <= PokemonType.FAIRY; t++) names[t] = i18next.t(`pokemonInfo:type.${PokemonType[t].toLowerCase()}`);

    // ── Abilities
    const blocks = abilitySourceBlocks();
    const abilityTagMap: Record<string, number[]> = {};
    let maxAbility = 0;
    for (const a of allAbilities) {
      // skip unreleased placeholder abilities (ABILITY_314 ...)
      if (!a || a.id === AbilityId.NONE || /^ABILITY_\d+$/.test(AbilityId[a.id])) continue;
      const fid = abilityFid(a.id);
      maxAbility = Math.max(maxAbility, a.id);
      names[fid] = a.name.replace(/( \((N|P)\))+$/, "");
      if (a.description) descriptions[fid] = a.description.replace(/( \((N|P)\))+$/, "");
      const tags = abilityTags(a, blocks.get(a.id) ?? "");
      if (tags.length) abilityTagMap[fid] = tags;
    }

    // ── Moves
    const moveInfo: Record<string, unknown> = {};
    const moveBlocks = moveSourceBlocks();
    let maxMove = 0;
    for (const m of allMoves) {
      if (!m || m.id === MoveId.NONE) continue;
      const fid = moveFid(m.id);
      maxMove = Math.max(maxMove, m.id);
      names[fid] = m.name.replace(/( \((N|P)\))+$/, "");
      if (m.effect) descriptions[fid] = m.effect.replace(/( \((N|P)\))+$/, "");
      const { tags, procs } = moveTagsAndProcs(m, moveBlocks.get(m.id) ?? "");
      const tm = (tmPoolTiers as Record<number, ModifierTier>)[m.id];
      moveInfo[fid] = {
        // Shop tier of this move's TM (0 common, 1 great, 2 ultra), absent if there is no TM
        ...(tm != null && tm <= ModifierTier.ULTRA ? { tm } : {}),
        type: m.type,
        cat: m.category,
        power: m.power,
        acc: m.accuracy,
        pp: m.pp,
        priority: m.priority,
        procs,
        tags,
      };
    }
    for (let i = 0; i < MOVE_BASE + maxMove + 1; i++) names[i] ??= null;

    // ── Species
    const tmTier = (id: MoveId): number | null => {
      const tier = (tmPoolTiers as Record<number, ModifierTier>)[id];
      return tier == null ? null : tier;
    };
    const species: unknown[] = [];
    const familyNames: Record<string, string> = {};
    // Form changes into each form key: the item used (mega stones) and whether every way in is an ability trigger
    type Target = { item: FormChangeItem | null; abilityOnly: boolean };
    const formChangeTargets = new Map<number, Map<string, Target>>();
    for (const data of Object.values(speciesDataRegistry.data)) {
      const targets = new Map<string, Target>();
      for (const fc of data.formChanges ?? []) {
        const trigger = fc.trigger as unknown;
        const item = trigger instanceof SpeciesFormChangeItemTrigger ? trigger.item : null;
        const prev = targets.get(fc.formKey);
        targets.set(fc.formKey, {
          item: item ?? prev?.item ?? null,
          abilityOnly: (prev?.abilityOnly ?? true) && trigger instanceof SpeciesFormChangeAbilityTrigger,
        });
      }
      formChangeTargets.set(data.species.speciesId, targets);
    }

    for (const data of Object.values(speciesDataRegistry.data)) {
      const sp = data.species;
      sp.localize();
      const id = sp.speciesId;
      const starterId = data.starter;
      const starter = speciesDataRegistry.getSpecies(starterId);
      starter.localize();
      familyNames[starterId] = starter.getExpandedSpeciesName();
      const eggMoves = (speciesEggMoves as Record<number, MoveId[]>)[starterId] ?? [];
      const cost = speciesDataRegistry.getStarterCost(starterId) ?? 0;
      const final = !speciesDataRegistry.hasEvolutions(id);
      const baseTms = speciesDataRegistry.getTms(id) as MoveId[];
      const formTms = (data as unknown as { formTms?: Record<string, MoveId[]> }).formTms ?? {};
      const targets = formChangeTargets.get(id) ?? new Map();

      const forms = sp.forms.length ? sp.forms.map((f, i) => ({ f, i })) : [{ f: null, i: -1 }];
      for (const { f, i } of forms) {
        const fi = Math.max(i, 0);
        const src = f ?? sp;
        const formKey = f?.formKey ?? "";
        const img = sp.getSpriteKey(false, f ? fi : undefined).replace(/^pkmn__/, "");
        // Form kind: 0 base / other, 1 mega, 2 newer mega, 3 gigantamax / eternamax, 4 battle form change
        //   (battle form = reached by a form change and not selectable as a starter; Eternamax counts as one)
        let kind = 0;
        const target = targets.get(formKey);
        if (f && formKey.startsWith("mega")) {
          const item = target?.item;
          kind = item != null && item >= FIRST_NEW_MEGA_STONE && item < FormChangeItem.BLUE_ORB ? 2 : 1;
        } else if (formKey.includes("gigantamax")) kind = 3;
        else if (formKey === "eternamax") kind = 4;
        else if (f && target && !f.isStarterSelectable) kind = 4;
        let name: string;
        if (!f) name = sp.getExpandedSpeciesName();
        else if (kind === 1 || kind === 2 || kind === 3 || formKey === "primal") name = sp.getName(fi);
        else if (fi === 0 && !formKey) name = sp.getExpandedSpeciesName();
        else name = sp.getFormNameToDisplay(fi, true) || sp.getExpandedSpeciesName();

        const passives = data.passives as unknown;
        const passive = typeof passives === "number" ? passives : (passives as number[])[fi] ?? (passives as number[])[0];

        // Learnset: egg moves (family) > level-up > TM, with TM tier folded into egg codes
        const moves: Record<string, number> = {};
        const lv = getLevelMoves(
          { pokemonSpeciesForm: sp, pokemonFormKey: formKey, startingLevel: 1, level: 999 } as never,
          true,
          true,
          true,
        ) as [number, MoveId, unknown][];
        for (const [level, move] of lv) {
          const k = moveFid(move);
          const prev = moves[k];
          // keep evolve (0) over levels, the lowest level otherwise, relearn (-1) only if nothing else
          if (prev == null || prev === -1 || (level !== -1 && level < prev)) moves[k] = level;
        }
        const tms = new Set<MoveId>([...baseTms, ...(formTms[formKey] ?? [])]);
        for (const move of tms) {
          const tier = tmTier(move);
          if (tier == null || tier > ModifierTier.ULTRA) continue;
          const k = moveFid(move);
          if (moves[k] == null) moves[k] = 209 + tier;
        }
        eggMoves.forEach((move, slot) => {
          const k = moveFid(move);
          const tier = tms.has(move) ? tmTier(move) : null;
          const rare = slot === 3;
          moves[k] = tier != null && tier <= ModifierTier.ULTRA ? (rare ? 205 : 201) + tier : rare ? 208 : 204;
        });

        species.push({
          idx: species.length,
          id,
          img,
          name,
          types: src.type2 == null ? [src.type1] : [src.type1, src.type2],
          abilities: {
            a1: abilityFid(src.ability1),
            a2: src.ability2 === src.ability1 || src.ability2 === AbilityId.NONE ? null : abilityFid(src.ability2),
            ha:
              src.abilityHidden === AbilityId.NONE || src.abilityHidden === src.ability1 || src.abilityHidden === src.ability2
                ? null
                : abilityFid(src.abilityHidden),
            passive: passive == null || passive === AbilityId.NONE ? null : abilityFid(passive),
          },
          stats: [...src.baseStats],
          bst: src.baseTotal,
          eggMoves: eggMoves.map(moveFid),
          cost,
          starter: speciesDataRegistry.isStarter(id),
          family: starterId,
          final,
          form: kind,
          variants: (variantMasterlist as Record<string, unknown>)[img] != null ? 3 : 1,
          gen: src.generation,
          moves,
          unobtainable: f?.isUnobtainable ?? false,
          formKey,
        });
      }
    }

    // Keep only moves some Pokemon can learn (drops Z-Moves, Max Moves, Struggle and the like)
    const learnable = new Set<number>();
    for (const s of species as { moves: Record<string, number>; eggMoves: number[] }[]) {
      for (const k of Object.keys(s.moves)) learnable.add(Number(k));
      for (const k of s.eggMoves) learnable.add(k);
    }
    for (const k of Object.keys(moveInfo).map(Number)) {
      if (learnable.has(k)) continue;
      delete moveInfo[k];
      delete descriptions[k];
      names[k] = null;
    }

    const tagsByName: Record<string, number[]> = {};
    for (const [fid, tags] of Object.entries(abilityTagMap)) {
      for (const t of tags) (tagsByName[TAG_NAMES[t]] ??= []).push(Number(fid));
    }

    const out = {
      source: {
        name: "pagefaultgames/pokerogue",
        url: "https://github.com/pagefaultgames/pokerogue",
        license: "AGPL-3.0",
        commit: "",
        gameVersion: "",
        date: new Date().toISOString().slice(0, 10),
      },
      ranges: { type: [0, 18], ability: [ABILITY_BASE, ABILITY_BASE + maxAbility + 1], move: [MOVE_BASE, MOVE_BASE + maxMove + 1] },
      names,
      typeColors: TYPE_COLORS,
      abilityTags: abilityTagMap,
      moveInfo,
      descriptions,
      procNames: PROC_NAMES,
      tagNames: TAG_NAMES,
      familyNames,
      tags: tagsByName,
      species,
    };
    mkdirSync(OUT, { recursive: true });
    writeFileSync(join(OUT, "dex.json"), JSON.stringify(out));
    console.log(`dex.json: ${species.length} forms, ${Object.keys(moveInfo).length} moves, ${Object.keys(abilityTagMap).length} tagged abilities`);
  },
  600000,
);
