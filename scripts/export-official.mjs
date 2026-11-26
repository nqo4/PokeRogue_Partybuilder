// 포켓로그 공식 저장소에서 진화·바이옴·트레이너 데이터를 뽑아 public/data/official.json 으로 만든다.
//
// 준비 (한 번만):
//   git clone --depth 1 https://github.com/pagefaultgames/pokerogue.git vendor/pokerogue
//   git -C vendor/pokerogue submodule update --init --depth 1 locales
//   (공식 저장소는 Node 24 이상과 pnpm 이 필요하다. vendor/tools 에 따로 설치해 쓴다)
//   cd vendor/tools && npm i pnpm@10 node@24 && 복사: node_modules/node/bin/node.exe → vendor/tools/bin/
//   vendor/pokerogue 에서: <node24> <pnpm> install --frozen-lockfile --ignore-scripts
//   (선택) 아이템 그림: 에셋 저장소에서 아이템 스프라이트 시트만 받는다
//   git clone --filter=blob:none --no-checkout --depth 1 https://github.com/pagefaultgames/pokerogue-assets.git vendor/pokerogue-assets
//   git -C vendor/pokerogue-assets sparse-checkout set --no-cone "/images/items.*" "/images/items/*ribbon*.png" "/LICENSES/*" "/starter-colors.json" && git -C vendor/pokerogue-assets checkout
//   (Git Bash 에서는 앞에 MSYS_NO_PATHCONV=1 을 붙여야 "/..." 경로가 바뀌지 않는다)
//   (items.png 는 Nintendo·Creatures·GAME FREAK 의 저작물로, 에셋 저장소가 공정 이용으로 표기한 파일이다)
//
// 실행: npm run export:official
import { execFileSync } from "node:child_process";
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
for (const f of ["export.test.ts", "vitest.config.ts"]) {
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
const args = fs.existsSync(pnpmCjs)
  ? [pnpmCjs, "exec", "vitest", "run", "--config", "scripts/pb-export/vitest.config.ts"]
  : null;
execFileSync(args ? node : "pnpm", args ?? ["exec", "vitest", "run", "--config", "scripts/pb-export/vitest.config.ts"], {
  cwd: repo,
  stdio: "inherit",
  env: { ...process.env, PATH: `${path.dirname(node)}${path.delimiter}${process.env.PATH}` },
});

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
