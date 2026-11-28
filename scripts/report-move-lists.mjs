// Generates full move / ability lists for the role logic docs from the official PokeRogue source and dex.json.
// Usage: node scripts/report-move-lists.mjs
// Output: reports/special-calc-moves.md, reports/conditional-moves.md, reports/ability-move-synergy.md
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const vendor = path.join(root, "vendor/pokerogue");
const read = (p) => fs.readFileSync(p, "utf8");
const dex = JSON.parse(read(path.join(root, "public/data/dex.json")));
const koMove = JSON.parse(read(path.join(vendor, "locales/ko/move.json")));
const koAbility = JSON.parse(read(path.join(vendor, "locales/ko/ability.json")));
const moveSrc = read(path.join(vendor, "src/data/moves/move.ts")).split("\n");
const abilitySrc = read(path.join(vendor, "src/data/abilities/init-abilities.ts")).split("\n");

// ── dex helpers
const N = (f) => dex.names[f];
const M = dex.moveInfo;
const CAT = ["물리", "특수", "변화"];
const fidIn = (range, name) => {
  for (let f = range[0]; f < range[1]; f++) if (dex.names[f] === name) return f;
  return -1;
};
const typeFid = (koName) => fidIn(dex.ranges.type, koName);
// PokemonType enum order (NORMAL 0 ... FAIRY 17) → Korean type name
const POKEMON_TYPE = ["NORMAL", "FIGHTING", "FLYING", "POISON", "GROUND", "ROCK", "BUG", "GHOST", "STEEL", "FIRE", "WATER", "GRASS", "ELECTRIC", "PSYCHIC", "ICE", "DRAGON", "DARK", "FAIRY"];
const TYPE_KO = ["노말", "격투", "비행", "독", "땅", "바위", "벌레", "고스트", "강철", "불꽃", "물", "풀", "전기", "에스퍼", "얼음", "드래곤", "악", "페어리"];
const typeKo = (enumName) => TYPE_KO[POKEMON_TYPE.indexOf(enumName)] ?? enumName;
const camel = (id) => id.toLowerCase().replace(/_(\w)/g, (_, c) => c.toUpperCase());
const moveKo = (id) => koMove[camel(id)]?.name ?? id;
const moveEffect = (id) => (koMove[camel(id)]?.effect ?? "").replace(/\s+/g, " ");
const moveFid = (id) => fidIn(dex.ranges.move, moveKo(id));
const abilityKo = (id) => koAbility[camel(id)]?.name ?? id;

/** Final forms and megas the recommender evaluates */
const forms = dex.species.filter((s) => s.final && s.form <= 2);
const srcOf = (c) => (c <= 200 ? (c === -1 ? "기억버섯" : c === 0 ? "진화" : "레벨업") : c <= 204 ? "알기술" : c <= 208 ? "레어 알기술" : "기술머신");
const cell = (s) => String(s).replace(/\|/g, "\\|");

/** Level-up / egg learners of a move as a markdown table (TM learners only counted) */
function learnerTable(fid, { typeCheck } = {}) {
  const m = M[fid];
  const all = forms.filter((s) => s.moves[fid] != null);
  const own = all.filter((s) => s.moves[fid] <= 208);
  const tm = all.length - own.length;
  if (!own.length) return `배우는 포켓몬 (레벨업·알기술): 없음 · 기술머신 ${tm}종\n`;
  const head = typeCheck ? `| 포켓몬 | 타입 | 출처 | ${typeCheck} 타입 | 공격 | 방어 | 특공 |\n|---|---|---|---|---|---|---|` : "| 포켓몬 | 타입 | 출처 | 자속 | 공격 | 방어 | 특공 |\n|---|---|---|---|---|---|---|";
  const rows = own.map((s) => {
    const types = s.types.map(N).join("/");
    const flag = typeCheck ? (s.types.includes(typeFid(typeCheck)) ? "O" : "") : m && s.types.includes(m.type) ? "O" : "";
    return `| ${cell(s.name)} | ${types} | ${srcOf(s.moves[fid])} | ${flag} | ${s.stats[1]} | ${s.stats[2]} | ${s.stats[3]} |`;
  });
  return `배우는 포켓몬 (레벨업·알기술): ${own.length}종 · 기술머신으로만 배움: ${tm}종\n\n${head}\n${rows.join("\n")}\n`;
}

// ── move.ts: class hierarchy and move definitions
const classes = new Map(); // name → { parent, body }
{
  let cur = null;
  moveSrc.forEach((l) => {
    const m = l.match(/^(?:export )?(?:abstract )?class (\w+)(?: extends (\w+))?/);
    if (m) {
      cur = { name: m[1], parent: m[2] ?? null, body: [] };
      classes.set(m[1], cur);
    } else if (cur && /^}/.test(l)) cur = null;
    else if (cur) cur.body.push(l);
  });
}
const descends = (name, rootName) => {
  for (let c = name; c; c = classes.get(c)?.parent) if (c === rootName) return true;
  return false;
};
const moves = []; // { id, kind, line, text, attrs }
{
  let cur = null;
  moveSrc.forEach((l, i) => {
    const m = l.match(/^\s+new (\w*Move)\(MoveId\.(\w+)/);
    if (m) {
      cur = { id: m[2], kind: m[1], line: i + 1, text: [l.trim()] };
      moves.push(cur);
    } else if (cur) {
      if (/^\s*\];?\s*$/.test(l) || /^\s*\);?\s*$/.test(l)) cur = null;
      else cur.text.push(l.trim());
    }
  });
  for (const mv of moves) {
    const t = mv.text.join(" ");
    mv.attrs = [...new Set([...t.matchAll(/\.(?:attr|conditionalAttr)\((?:[^,]*?,\s*)?(?:new )?(\w+Attr)\b/g)].map((x) => x[1]))];
    mv.code = t;
  }
}
const fmtMoveHead = (mv) => {
  const fid = moveFid(mv.id);
  const m = M[fid];
  const info = m ? `${N(m.type)} · ${CAT[m.cat]} · 위력 ${m.power > 0 ? m.power : "없음(-1)"}` : "서비스 dex 데이터에 없음";
  return { fid, text: `### ${moveKo(mv.id)} (${mv.id})\n\n- 데이터: ${info}\n- 게임 설명: ${moveEffect(mv.id) || "-"}\n- 코드: \`move.ts:${mv.line}\` ${mv.attrs.length ? mv.attrs.map((a) => `\`${a}\``).join(", ") : ""}\n` };
};

const stamp = `> 자동 생성 파일 (\`node scripts/report-move-lists.mjs\`). 손으로 고치지 말고 스크립트를 다시 실행한다.\n> 기준: 포켓로그 코드 \`vendor/pokerogue\` (${dex.source?.gameVersion ?? ""} ${dex.source?.commit?.slice(0, 7) ?? ""}) · 서비스 데이터 \`public/data/dex.json\`\n> 배우는 포켓몬은 최종진화·메가 형태 기준, 레벨업(진화·기억버섯 포함)과 알기술만 표로 적고 기술머신은 수만 센다.\n`;

// ══ Report 1: special calculation moves
{
  const groups = [
    ["1. 분류 자체가 바뀌는 기술", "VariableMoveCategoryAttr", "조건에 따라 물리/특수가 바뀐다."],
    ["2. 공격 쪽에 다른 능력치를 쓰는 기술", "VariableAtkAttr", "사용자 공격 대신 다른 능력치로 데미지를 계산한다."],
    ["3. 받는 쪽에 다른 능력치를 쓰는 기술", "VariableDefAttr", "상대가 다른 방어 능력치로 받는다."],
    ["4. 위력이 상황에 따라 바뀌는 기술", "VariablePowerAttr", "dex 위력이 실제와 다를 수 있다. `MovePowerMultiplierAttr`는 조건이 맞을 때 위력에 배율을 곱한다 (조건 코드를 함께 적었다)."],
    ["5. 능력치와 무관한 고정 데미지", "FixedDamageAttr", "공격·특공·방어·특방을 쓰지 않는다."],
    ["6. 기술 타입이 바뀌는 기술", "VariableMoveTypeAttr", "날씨·필드·사용자·폼 등에 따라 기술 타입이 바뀐다."],
  ];
  let out = `# 계산 방식이 특이한 기술 전체 목록\n\n${stamp}\n`;
  const summary = [];
  for (const [title, rootName, desc] of groups) {
    const list = moves.filter((mv) => mv.attrs.some((a) => descends(a, rootName)));
    summary.push(`| ${title.replace(/^\d+\. /, "")} | \`${rootName}\` | ${list.length} |`);
    out += `\n## ${title}\n\n${desc} 기준 클래스: \`${rootName}\`와 그 하위 클래스. ${list.length}개.\n\n`;
    for (const mv of list) {
      const { fid, text } = fmtMoveHead(mv);
      out += text;
      const rel = mv.attrs.filter((a) => descends(a, rootName));
      out += `- 해당 클래스: ${rel.map((a) => `\`${a}\``).join(", ")}\n`;
      if (rel.includes("MovePowerMultiplierAttr")) {
        const cond = mv.code.match(/MovePowerMultiplierAttr,\s*([\s\S]*?)\)\s*(?:\.|$)/);
        if (cond) out += `- 배율 조건 코드: \`${cell(cond[1].slice(0, 220))}\`\n`;
      }
      out += `\n${fid >= 0 ? learnerTable(fid) : ""}\n`;
    }
  }
  // Charging moves (dex tag "2턴에 걸쳐 공격")
  const charging = Object.entries(M).filter(([, m]) => m.tags.includes(93) && m.cat !== 2 && !m.tags.includes(74));
  summary.push(`| 2턴에 걸쳐 공격하는 기술 (충전·숨기) | dex 태그 93 | ${charging.length} |`);
  out += `\n## 7. 2턴에 걸쳐 공격하는 기술 (충전·숨기)\n\ndex 태그 "2턴에 걸쳐 공격". 충전기 할인 규칙의 대상. ${charging.length}개.\n\n`;
  for (const [k, m] of charging) {
    const fid = Number(k);
    out += `### ${N(fid)}\n\n- 데이터: ${N(m.type)} · ${CAT[m.cat]} · 위력 ${m.power}\n- 게임 설명: ${(dex.descriptions[fid] ?? "-").replace(/\s+/g, " ")}\n\n${learnerTable(fid)}\n`;
  }
  out = out.replace(stamp, `${stamp}\n## 요약\n\n| 묶음 | 기준 | 기술 수 |\n|---|---|---|\n${summary.join("\n")}\n`);
  fs.writeFileSync(path.join(root, "reports/special-calc-moves.md"), out);
}

// ══ Report 2: moves whose effect depends on the user's type / species / form / IVs, or the target's type
{
  const userRe = /user\??\.(isOfType|getTypes|species|hasSpecies|ivs|formIndex|fusionSpecies)|SpeciesId\./;
  // Target or any field Pokemon (Rototiller and Flower Shield check every grounded Grass type)
  const targetRe = /(?:target|\bp|\bpoke|pokemon)\??\.(isOfType|getTypes)/;
  const userClasses = [...classes.values()].filter((c) => userRe.test(c.body.join("\n"))).map((c) => c.name);
  const targetClasses = [...classes.values()].filter((c) => targetRe.test(c.body.join("\n"))).map((c) => c.name);
  const why = (mv, re, cls) => {
    const out = mv.attrs.filter((a) => cls.includes(a)).map((a) => `\`${a}\``);
    const inline = mv.code.match(new RegExp(`.{0,60}(${re.source}|RequireTypeCondition\\(PokemonType\\.\\w+\\)).{0,80}`));
    if (inline && !out.length) out.push(`인라인 조건: \`${cell(inline[0].trim())}\``);
    return out;
  };
  const userMoves = moves.filter((mv) => mv.attrs.some((a) => userClasses.includes(a)) || userRe.test(mv.code) || /RequireTypeCondition/.test(mv.code));
  const targetMoves = moves.filter((mv) => !userMoves.includes(mv) && (mv.attrs.some((a) => targetClasses.includes(a)) || targetRe.test(mv.code)));
  let out = `# 쓰는 포켓몬·상대에 따라 효과가 달라지는 기술 전체 목록\n\n${stamp}\n`;
  out += `\n찾는 방법: 기술에 붙은 클래스나 기술 정의 안의 조건이 사용자의 타입·종·폼·개체치(\`user.isOfType\`, \`user.species\`, \`hasSpecies\`, \`user.ivs\`, \`formIndex\`, \`SpeciesId.\`, \`RequireTypeCondition\`) 또는 상대의 타입(\`target.isOfType\`, \`target.getTypes\`)을 확인하는 경우.\n\n`;
  out += `| 묶음 | 기술 수 |\n|---|---|\n| 사용자의 타입·종·폼·개체치 | ${userMoves.length} |\n| 상대의 타입 | ${targetMoves.length} |\n`;
  for (const [title, list, re, cls] of [
    ["1. 사용자의 타입·종·폼·개체치에 따라 달라지는 기술", userMoves, userRe, userClasses],
    ["2. 상대·필드 포켓몬의 타입에 따라 달라지는 기술", targetMoves, targetRe, targetClasses],
  ]) {
    out += `\n## ${title}\n\n`;
    for (const mv of list) {
      const { fid, text } = fmtMoveHead(mv);
      out += text;
      const reasons = why(mv, re, cls);
      if (reasons.length) out += `- 조건: ${reasons.join(", ")}\n`;
      // The checked type may sit in the attr class body (CurseAttr) or inline in the move definition
      const codeAll = [mv.code, ...mv.attrs.map((a) => classes.get(a)?.body.join(" ") ?? "")].join(" ");
      const typeMatch = codeAll.match(/(?:isOfType|RequireTypeCondition)\(PokemonType\.(\w+)/);
      // Only the 18 real types (not STELLAR / UNKNOWN) get a learner column
      const tc = typeMatch && POKEMON_TYPE.includes(typeMatch[1]) ? typeKo(typeMatch[1]) : undefined;
      if (tc) out += `- 확인하는 타입: ${tc} (아래 표의 "${tc} 타입" 열)\n`;
      out += `\n${fid >= 0 ? learnerTable(fid, { typeCheck: tc }) : ""}\n`;
    }
  }
  fs.writeFileSync(path.join(root, "reports/conditional-moves.md"), out);
}

// ══ Report 3: abilities that boost attacks, and which moves they boost for each holder
{
  const blocks = [];
  {
    let cur = null;
    abilitySrc.forEach((l, i) => {
      const m = l.match(/new AbBuilder\(AbilityId\.(\w+)/);
      if (m) {
        cur = { id: m[1], line: i + 1, text: [] };
        blocks.push(cur);
      } else if (cur) cur.text.push(l.trim());
      if (cur && /\.build\(\)/.test(l)) cur = null;
    });
  }
  const OFFENSE = ["MovePowerBoostAbAttr", "MoveTypePowerBoostAbAttr", "LowHpMoveTypePowerBoostAbAttr", "VariableMovePowerBoostAbAttr", "MoveTypeChangeAbAttr", "StabBoostAbAttr", "MoveDamageBoostAbAttr", "MoveEffectChanceMultiplierAbAttr", "FieldMoveTypePowerBoostAbAttr", "UserFieldMoveTypePowerBoostAbAttr", "AllyMoveCategoryPowerBoostAbAttr"];
  const FLAG_TAG = { PUNCHING_MOVE: 29, BITING_MOVE: 31, SLICING_MOVE: 28, PULSE_MOVE: 30, SOUND_BASED: 35, MAKES_CONTACT: 72, RECKLESS_MOVE: 32 };
  /** Which moves an ability boosts, read from its attrs (null = needs a manual check) */
  const predicateOf = (code) => {
    const preds = [];
    // Unseen Fist / Piercing Drill: contact moves hit through Protect (x0.25 damage), not a power boost
    if (/IgnoreProtectOnContactAbAttr/.test(code)) return [{ label: "방어를 무시하는 접촉 기술 (위력 강화 아님)", fn: (m) => m.tags.includes(72) }];
    const flags = [...code.matchAll(/MoveFlags\.(\w+)/g)].map((x) => x[1]).filter((f) => FLAG_TAG[f]);
    for (const f of flags) preds.push({ label: `기술 플래그 ${f}`, fn: (m) => m.tags.includes(FLAG_TAG[f]) });
    if (/move\.chance >= 1/.test(code)) preds.push({ label: "추가 효과가 있는 기술", fn: (m) => m.tags.includes(3) });
    if (/<= 60/.test(code) && /power/i.test(code)) preds.push({ label: "위력 60 이하", fn: (m) => m.power > 0 && m.power <= 60 });
    if (/MoveEffectChanceMultiplierAbAttr,\s*2/.test(code)) preds.push({ label: "추가 효과 확률이 있는 기술", fn: (m) => m.tags.includes(79) });
    if (!flags.length && /MovePowerBoostAbAttr[\s\S]*MoveCategory\.PHYSICAL/.test(code)) preds.push({ label: "물리 기술 (조건부)", fn: (m) => m.cat === 0 });
    if (!flags.length && /MovePowerBoostAbAttr[\s\S]*MoveCategory\.SPECIAL/.test(code)) preds.push({ label: "특수 기술 (조건부)", fn: (m) => m.cat === 1 });
    if (/normalTypeMoveConversionCondition/.test(code)) preds.push({ label: "노말 기술 (타입이 바뀜)", fn: (m) => m.type === typeFid("노말") });
    // Liquid Voice: sound moves only (flag AND conversion), so "any move" applies only without a flag
    if (!flags.length && /anyTypeMoveConversionCondition/.test(code)) preds.push({ label: "모든 기술 (노말로 바뀜)", fn: () => true });
    const to = code.match(/MoveTypeChangeAbAttr,\s*PokemonType\.(\w+)/);
    if (to && preds.length) preds[0].label += ` → ${typeKo(to[1])} 타입으로 바뀜`;
    for (const t of code.matchAll(/(?:MoveTypePowerBoostAbAttr|LowHpMoveTypePowerBoostAbAttr|FieldMoveTypePowerBoostAbAttr|UserFieldMoveTypePowerBoostAbAttr),\s*PokemonType\.(\w+)/g)) {
      const ko = typeKo(t[1]);
      preds.push({ label: `${ko} 타입 기술`, fn: (m) => m.type === typeFid(ko) });
    }
    if (/StabBoostAbAttr/.test(code)) preds.push({ label: "자속 기술", fn: (m, s) => s.types.includes(m.type) });
    if (/AllyMoveCategoryPowerBoostAbAttr,\s*\[MoveCategory\.SPECIAL\]/.test(code)) preds.push({ label: "특수 기술 (같은 편)", fn: (m) => m.cat === 1 });
    if (/AllyMoveCategoryPowerBoostAbAttr,\s*\[MoveCategory\.PHYSICAL\]/.test(code)) preds.push({ label: "물리 기술 (같은 편)", fn: (m) => m.cat === 0 });
    const uniq = preds.filter((p, i) => preds.findIndex((q) => q.label === p.label) === i);
    return uniq.length ? uniq : null;
  };
  const statMult = (code) => [...new Set([...code.matchAll(/(?<!Ally)StatMultiplierAbAttr,\s*Stat\.(ATK|SPATK),\s*([\d./ ]+)/g)].map((x) => `${x[1] === "ATK" ? "공격" : "특공"} ×${x[2].trim()}`))];
  const offense = blocks.filter((b) => OFFENSE.some((a) => b.text.join(" ").includes(a)) || statMult(b.text.join(" ")).length);
  const holders = (afid) =>
    forms.flatMap((s) => {
      const ab = s.abilities;
      const slots = [["특성1", ab.a1], ["특성2", ab.a2], ["숨겨진 특성", ab.ha], ["패시브", ab.passive]].filter(([, f]) => f === afid).map(([n]) => n);
      return slots.length ? [{ s, slot: slots.join("·") }] : [];
    });
  let out = `# 공격 기술을 강화하는 특성 전체 목록\n\n${stamp}\n`;
  out += `\n찾는 방법: \`src/data/abilities/init-abilities.ts\`에서 기술 위력·타입·자속·능력치(공격/특공)를 바꾸는 클래스(${OFFENSE.map((a) => `\`${a}\``).join(", ")}, \`StatMultiplierAbAttr\`의 공격·특공)를 쓰는 특성.\n`;
  out += `\n"강화되는 기술"은 보유 포켓몬이 레벨업·알기술로 배우는 위력 있는 공격기 중 특성 조건에 맞는 기술이다 (위력 50 미만은 테크니션만 표시). 조건을 자동으로 읽지 못한 특성은 "수동 확인"으로 표시했다.\n`;
  const summary = [];
  let body = "";
  for (const b of offense) {
    const code = b.text.join(" ");
    const name = abilityKo(b.id);
    const afid = fidIn(dex.ranges.ability, name);
    const preds = predicateOf(code);
    const stats = statMult(code);
    const conditional = /conditionalAttr|=>/.test(code);
    const allMoves = Object.values(M).filter((m) => m.cat !== 2 && m.power > 0 && !m.tags.includes(74));
    const split = preds ? [0, 1].map((c) => allMoves.filter((m) => m.cat === c && preds.some((p) => p.fn(m, { types: [] }))).length) : null;
    const scope = stats.length ? stats.join(", ") : preds ? preds.map((p) => p.label).join(", ") : "수동 확인";
    const splitText = stats.length
      ? "능력치"
      : /StabBoostAbAttr/.test(code)
        ? "포켓몬 타입에 따라 다름"
        : split
          ? `물리 ${split[0]} · 특수 ${split[1]}`
          : "-";
    const hs = afid >= 0 ? holders(afid) : [];
    summary.push(`| ${name} | ${cell(scope)} | ${splitText} | ${hs.length} |`);
    body += `\n### ${name} (${b.id})\n\n- 설명: ${(dex.descriptions[afid] ?? "-").replace(/\s+/g, " ")}\n- 코드: \`init-abilities.ts:${b.line}\`${conditional ? " · 조건부 효과 포함" : ""}\n- 강화 대상: ${cell(scope)} (${splitText})\n`;
    if (!preds && !stats.length) body += `- 수동 확인용 코드: \`${cell(code.replace(/\s+/g, " ").slice(0, 260))}\`\n`;
    body += "\n";
    if (!hs.length) {
      body += "보유 포켓몬 (최종진화·메가): 없음\n";
      continue;
    }
    body += `| 포켓몬 | 슬롯 | 공격 | 특공 | 강화되는 물리 기술 | 강화되는 특수 기술 |\n|---|---|---|---|---|---|\n`;
    for (const { s, slot } of hs) {
      const boosted = (cat) =>
        preds
          ? Object.entries(s.moves)
              .filter(([k, c]) => c <= 208 && M[k] && M[k].cat === cat && M[k].power > 0 && (M[k].power >= 50 || /<= 60/.test(code)) && preds.some((p) => p.fn(M[k], s)))
              .map(([k, c]) => `${N(+k)}${M[k].power}${c <= 200 ? "" : "(알)"}${s.types.includes(M[k].type) ? "*" : ""}`)
              .join(", ")
          : stats.some((x) => x.startsWith(cat === 0 ? "공격" : "특공")) ? "모든 기술" : "";
      body += `| ${cell(s.name)} | ${slot} | ${s.stats[1]} | ${s.stats[3]} | ${boosted(0)} | ${boosted(1)} |\n`;
    }
  }
  out += `\n기술 표기: 기술명 + 위력, \`(알)\` 알기술, \`*\` 자속.\n\n## 요약\n\n| 특성 | 강화 대상 | 전체 공격기 중 해당 기술 수 | 보유 포켓몬 수 |\n|---|---|---|---|\n${summary.join("\n")}\n\n## 특성별 보유 포켓몬\n${body}`;
  fs.writeFileSync(path.join(root, "reports/ability-move-synergy.md"), out);
}
console.log("reports written");
