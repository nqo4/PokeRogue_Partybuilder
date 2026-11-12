// PokeRogue-Dex(https://github.com/Sandstormer/PokeRogue-Dex, AGPL-3.0) 데이터를
// 웹앱이 쓰는 정규화된 JSON(public/data/dex.json)으로 변환한다.
//
// 사용법: npm run build:dex [-- <Dex 저장소 경로>]
//   경로를 주지 않으면 vendor/PokeRogue-Dex 를 쓰고, 없으면 clone 한다.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(import.meta.dirname, "..");
const dexDir = path.resolve(process.argv[2] ?? path.join(root, "vendor", "PokeRogue-Dex"));
const outFile = path.join(root, "public", "data", "dex.json");
const REPO = "https://github.com/Sandstormer/PokeRogue-Dex.git";

if (!fs.existsSync(path.join(dexDir, "pokedex_data.js"))) {
  console.log(`Dex 저장소를 받는 중: ${REPO} → ${dexDir}`);
  fs.mkdirSync(path.dirname(dexDir), { recursive: true });
  execFileSync("git", ["clone", "--depth", "1", REPO, dexDir], { stdio: "inherit" });
}

let commit = "unknown";
try {
  commit = execFileSync("git", ["-C", dexDir, "rev-parse", "HEAD"]).toString().trim();
} catch {
  /* git 정보가 없어도 진행 */
}

// Dex 파일들은 전역 변수를 선언하는 브라우저 스크립트다. 한 컨텍스트에서 실행해 값을 꺼낸다.
const code = ["filter_data.js", "pokedex_data.js", "lang/ko.js"]
  .map((f) => fs.readFileSync(path.join(dexDir, f), "utf8"))
  .join("\n;\n");
// ko.js 의 도움말 문자열이 script.js 의 색상 객체(col)를 참조하므로 더미를 넣어 둔다.
const ctx = { col: new Proxy({}, { get: () => "" }) };
vm.createContext(ctx);
vm.runInContext(
  code +
    "\n;globalThis.__out = { gameVersion, latestDate, fidThreshold, typeColors, fidToProc, fidToDesc, procToDesc, tagToDesc, items, speciesNames, fidToName, catToName, tagToFID };",
  ctx,
);
const D = ctx.__out;

if (D.items.length !== D.speciesNames.length) {
  throw new Error(`items(${D.items.length})와 speciesNames(${D.speciesNames.length}) 길이가 다르다`);
}

const [TYPE_END, ABILITY_END, MOVE_END] = D.fidThreshold;
const stripHtml = (s) => String(s ?? "").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "").trim();

const species = D.items.map((it, i) => {
  const moves = {};
  for (const [k, v] of Object.entries(it)) {
    const fid = Number(k);
    if (Number.isInteger(fid) && fid >= ABILITY_END && fid < MOVE_END) moves[fid] = v;
  }
  return {
    idx: i,
    id: it.dex,
    img: it.img,
    name: D.speciesNames[i],
    types: it.t2 == null ? [it.t1] : [it.t1, it.t2],
    abilities: { a1: it.a1, a2: it.a2 ?? null, ha: it.ha ?? null, passive: it.pa ?? null },
    stats: [it.hp, it.atk, it.def, it.spa, it.spd, it.spe],
    bst: it.bst,
    eggMoves: [it.e1, it.e2, it.e3, it.e4],
    cost: it.co,
    starter: !!it.st,
    family: it.fa,
    final: !!it.ev,
    form: it.fx ?? 0,
    gen: it.ge,
    moves,
  };
});

// fidToProc 는 fid − 18 위치에 특성·기술 정보를 담는다.
//  특성: [효과 목록, 태그 목록]
//  기술: [효과 목록, 태그 목록, 타입, 분류(0 물리·1 특수·2 변화), 위력, 명중, PP, 우선도]
//  효과: [확률(−1 확정, −2 배율), 효과 번호, 랭크/배율]  (효과 번호 0~6 = 사용자 공/방/특공/특방/스피드/명중/회피)
const abilityTags = {};
for (let fid = TYPE_END; fid < ABILITY_END; fid++) {
  const p = D.fidToProc[fid - TYPE_END];
  if (p?.[1]?.length) abilityTags[fid] = p[1];
}
const moveInfo = {};
for (let fid = ABILITY_END; fid < MOVE_END; fid++) {
  const p = D.fidToProc[fid - TYPE_END];
  if (!p) continue;
  moveInfo[fid] = {
    type: p[2],
    cat: p[3],
    power: p[4],
    acc: p[5],
    pp: p[6],
    priority: p[7] ?? 0,
    procs: p[0],
    tags: p[1],
  };
}

const out = {
  source: {
    name: "PokeRogue-Dex",
    url: "https://github.com/Sandstormer/PokeRogue-Dex",
    license: "AGPL-3.0",
    commit,
    gameVersion: D.gameVersion,
    date: D.latestDate,
  },
  // fid 0~17: 타입, 18~334: 특성, 335~1178: 기술 (Dex 의 통합 ID 체계를 그대로 쓴다)
  ranges: { type: [0, TYPE_END], ability: [TYPE_END, ABILITY_END], move: [ABILITY_END, MOVE_END] },
  names: D.fidToName.slice(0, MOVE_END),
  typeColors: [...D.typeColors],
  abilityTags,
  moveInfo,
  // 특성·기술 설명 (fid → 한국어 설명), 효과·태그 이름 (HTML 태그 제거)
  descriptions: Object.fromEntries(
    D.fidToDesc.map((d, i) => [i + TYPE_END, stripHtml(d)]).filter(([, d]) => d),
  ),
  procNames: D.procToDesc.map(stripHtml),
  tagNames: D.tagToDesc.map(stripHtml),
  familyNames: Object.fromEntries(
    [...new Set(species.map((s) => s.family))].map((f) => [f, D.fidToName[f]]),
  ),
  tags: Object.fromEntries(
    Object.entries(D.tagToFID).map(([tag, fids]) => [D.fidToName[tag], fids]),
  ),
  species,
};

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(out));

// 포켓몬 이미지: 각 형태의 기본 색 정면 이미지({img}_0.png)를 public/images/{img}.png 로 복사한다
const imgOut = path.join(root, "public", "images");
fs.mkdirSync(imgOut, { recursive: true });
let copied = 0;
const missingImages = [];
for (const s of species) {
  const src = path.join(dexDir, "images", `${s.img}_0.png`);
  if (!fs.existsSync(src)) {
    missingImages.push(s.img);
    continue;
  }
  fs.copyFileSync(src, path.join(imgOut, `${s.img}.png`));
  copied++;
}
console.log(`이미지 ${copied}장 복사${missingImages.length ? `, 없음 ${missingImages.length}장: ${missingImages.slice(0, 10).join(", ")}` : ""}`);
console.log(
  `완료: 종/폼 ${species.length}개, 스타터 ${species.filter((s) => s.starter).length}개, ` +
    `게임 ${D.gameVersion} (${D.latestDate}), Dex ${commit.slice(0, 7)} → ${path.relative(root, outFile)} ` +
    `(${(fs.statSync(outFile).size / 1024).toFixed(0)} KB)`,
);
