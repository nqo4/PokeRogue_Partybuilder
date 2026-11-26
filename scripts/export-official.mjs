// 포켓로그 공식 저장소에서 데이터를 뽑는다.
//   public/data/dex.json      도감 (종·폼·특성·기술·습득 기술·이로치 단계 등, scripts/official-export/dex.test.ts)
//   public/data/official.json 진화·바이옴·트레이너 (scripts/official-export/export.test.ts)
// 포켓몬 그림은 이어서 npm run build:sprites 로 만든다.
//
// 준비 (한 번만):
//   git clone --depth 1 https://github.com/pagefaultgames/pokerogue.git vendor/pokerogue
//   git -C vendor/pokerogue submodule update --init --depth 1 locales
//   (공식 저장소는 Node 24 이상과 pnpm 이 필요하다. vendor/tools 에 따로 설치해 쓴다)
//   cd vendor/tools && npm i pnpm@10 node@24 && 복사: node_modules/node/bin/node.exe → vendor/tools/bin/
//   vendor/pokerogue 에서: <node24> <pnpm> install --frozen-lockfile --ignore-scripts
//   에셋: 공식 저장소가 고정한 커밋(git -C vendor/pokerogue ls-tree HEAD assets)의 필요한 부분만 받는다
//   git clone --filter=blob:none --no-checkout https://github.com/pagefaultgames/pokerogue-assets.git vendor/pokerogue-assets
//   git -C vendor/pokerogue-assets sparse-checkout set --no-cone "/images/items.*" "/images/items/*ribbon*.png" "/images/pokemon/*.png" "/images/pokemon/*.json" "/images/pokemon/shiny/*" "/images/pokemon/variant/*" "/images/trainer/*" "/images/arenas/*" "/LICENSES/*" "/starter-colors.json"
//   git -C vendor/pokerogue-assets checkout <고정 커밋>
//   (Git Bash 에서는 앞에 MSYS_NO_PATHCONV=1 을 붙여야 "/..." 경로가 바뀌지 않는다)
//   (items.png 는 Nintendo·Creatures·GAME FREAK 의 저작물로, 에셋 저장소가 공정 이용으로 표기한 파일이다)
//
// 실행: npm run export:official
import { execFileSync, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const repo = path.join(root, "vendor", "pokerogue");
const tools = path.join(root, "vendor", "tools");
const node = [path.join(tools, "bin", "node.exe"), path.join(tools, "bin", "node")].find((p) => fs.existsSync(p)) ?? "node";
const pnpmCjs = path.join(tools, "node_modules", "pnpm", "bin", "pnpm.cjs");

if (!fs.existsSync(path.join(repo, "package.json"))) {
  console.error("vendor/pokerogue 가 없습니다. 이 파일 맨 위의 준비 단계를 먼저 해 주세요.");
  process.exit(1);
}

const dest = path.join(repo, "scripts", "pb-export");
fs.mkdirSync(dest, { recursive: true });
// The dex exporter imports the variant masterlist from the (uninitialized) assets submodule
const masterlist = path.join(root, "vendor", "pokerogue-assets", "images", "pokemon", "variant", "_masterlist.json");
const masterDest = path.join(repo, "assets", "images", "pokemon", "variant");
fs.mkdirSync(masterDest, { recursive: true });
fs.copyFileSync(masterlist, path.join(masterDest, "_masterlist.json"));
for (const f of ["export.test.ts", "dex.test.ts", "vitest.config.ts"]) {
  fs.copyFileSync(path.join(root, "scripts", "official-export", f), path.join(dest, f));
}

const version = JSON.parse(fs.readFileSync(path.join(repo, "package.json"), "utf8")).version;
let commit = "unknown";
try {
  commit = execFileSync("git", ["-C", repo, "rev-parse", "HEAD"]).toString().trim();
} catch {
  /* git 정보가 없어도 진행 */
}

console.log(`공식 저장소 ${version} (${commit.slice(0, 7)}) 에서 데이터를 뽑는 중…`);
const vitestArgs = ["exec", "vitest", "run", "--config", "scripts/pb-export/vitest.config.ts"];
if (fs.existsSync(pnpmCjs)) {
  execFileSync(node, [pnpmCjs, ...vitestArgs], {
    cwd: repo,
    stdio: "inherit",
    env: { ...process.env, PATH: `${path.dirname(node)}${path.delimiter}${process.env.PATH}` },
  });
} else {
  // No local pnpm: run the version the official repo pins (packageManager) through npx
  const pm = JSON.parse(fs.readFileSync(path.join(repo, "package.json"), "utf8")).packageManager ?? "pnpm@10";
  execSync(`npx --yes ${pm} ${vitestArgs.join(" ")}`, { cwd: repo, stdio: "inherit" });
}

let dateStr = new Date().toISOString().slice(0, 10);
try {
  dateStr = execFileSync("git", ["-C", repo, "log", "-1", "--format=%cs"]).toString().trim();
} catch {
  /* keep today */
}
const dexOut = JSON.parse(fs.readFileSync(path.join(repo, "pb-export-output", "dex.json"), "utf8"));
dexOut.source = { ...dexOut.source, gameVersion: version, commit, date: dateStr };
const dexTarget = path.join(root, "public", "data", "dex.json");
fs.writeFileSync(dexTarget, JSON.stringify(dexOut));
console.log(`완료 → ${path.relative(root, dexTarget)} (${(fs.statSync(dexTarget).size / 1024).toFixed(0)} KB)`);

const out = JSON.parse(fs.readFileSync(path.join(repo, "pb-export-output", "official.json"), "utf8"));
out.source = { ...out.source, url: "https://github.com/pagefaultgames/pokerogue", gameVersion: version, commit };
const target = path.join(root, "public", "data", "official.json");
fs.writeFileSync(target, JSON.stringify(out));
console.log(`완료 → ${path.relative(root, target)} (${(fs.statSync(target).size / 1024).toFixed(0)} KB)`);

// 아이템 스프라이트 시트 복사 (좌표는 official.json 의 itemSprites)
const itemsPng = path.join(root, "vendor", "pokerogue-assets", "images", "items.png");
if (fs.existsSync(itemsPng)) {
  fs.copyFileSync(itemsPng, path.join(root, "public", "images", "items.png"));
  console.log("아이템 그림 → public/images/items.png");
} else {
  console.warn("vendor/pokerogue-assets 가 없어 아이템 그림은 건너뜁니다 (파일 맨 위 준비 단계 참고).");
}

// Ribbon icons (32x32 item images) for the species detail ribbon list (src/lib/ribbons.ts RibbonDef.icon)
const ribbonDir = path.join(root, "vendor", "pokerogue-assets", "images", "items");
const ribbonFiles = fs.existsSync(ribbonDir) ? fs.readdirSync(ribbonDir).filter((f) => /ribbon.*\.png$/.test(f)) : [];
if (ribbonFiles.length) {
  const dest = path.join(root, "public", "images", "ribbons");
  fs.mkdirSync(dest, { recursive: true });
  for (const f of ribbonFiles) fs.copyFileSync(path.join(ribbonDir, f), path.join(dest, f));
  console.log(`리본 그림 ${ribbonFiles.length}장 → public/images/ribbons`);
} else {
  console.warn("리본 그림이 없어 건너뜁니다 (파일 맨 위 준비 단계 참고).");
}
