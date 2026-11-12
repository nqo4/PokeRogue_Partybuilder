// 포켓로그 공식 저장소에서 진화·바이옴·트레이너 데이터를 뽑아 public/data/official.json 으로 만든다.
//
// 준비 (한 번만):
//   git clone --depth 1 https://github.com/pagefaultgames/pokerogue.git vendor/pokerogue
//   git -C vendor/pokerogue submodule update --init --depth 1 locales
//   (공식 저장소는 Node 24 이상과 pnpm 이 필요하다. vendor/tools 에 따로 설치해 쓴다)
//   cd vendor/tools && npm i pnpm@10 node@24 && 복사: node_modules/node/bin/node.exe → vendor/tools/bin/
//   vendor/pokerogue 에서: <node24> <pnpm> install --frozen-lockfile --ignore-scripts
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
