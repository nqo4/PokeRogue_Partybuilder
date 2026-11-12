// 개발용: 실제 세이브로 클래식 추천 결과를 콘솔에 출력한다.  npx vite-node scripts/try-recommend.ts [세이브 경로]
import fs from "node:fs";
import path from "node:path";
import { Dex, type DexData } from "../src/lib/dex";
import { decryptSave } from "../src/lib/save";
import { buildSummary } from "../src/lib/starters";
import { ClassicRecommender } from "../src/lib/classic/recommend";
import { ROLE_NAMES, ROLES, reasonText } from "../src/lib/classic/candidate";

const root = path.resolve(import.meta.dirname, "..");
const savePath = process.argv[2] ?? path.join(root, "testdata", fs.readdirSync(path.join(root, "testdata")).find((f) => f.endsWith(".prsv"))!);
const dex = new Dex(JSON.parse(fs.readFileSync(path.join(root, "public/data/dex.json"), "utf8")) as DexData);
const summary = buildSummary(decryptSave(fs.readFileSync(savePath, "utf8")), dex);
let t = Date.now();
const rec = new ClassicRecommender(dex, summary.starters);
console.log(`후보 평가 ${rec.candidates.length}종 ${Date.now() - t}ms`);
const pool = rec.candidates.filter((c) => c.owned.classicWins === 0);
for (const r of ROLES) {
  const top = pool.filter((c) => c.roles[r].score >= 0.5).sort((a, b) => b.roles[r].score - a.roles[r].score || b.value - a.value);
  console.log(`[${ROLE_NAMES[r]}] ${top.length}종: ` + top.slice(0, 8).map((c) => `${c.form.name}(${c.owned.cost})`).join(" "));
}
console.log("개별 점수 상위:", pool.slice().sort((a, b) => b.value - a.value).slice(0, 12).map((c) => `${c.form.name} ${c.value.toFixed(1)}`).join(", "));
t = Date.now();
const res = rec.recommend({ onlyUncleared: true });
console.log(`추천 ${Date.now() - t}ms`);
for (const [i, r] of res.entries()) {
  const a = r.analysis;
  console.log(`\n#${i + 1} 점수 ${a.score.toFixed(1)} 코스트 ${a.cost} 럭 ${a.luck}`);
  a.members.forEach((m, j) => console.log(`  ${m.form.name.padEnd(10)} c${m.owned.cost} [${a.memberRoles[j].map((x) => ROLE_NAMES[x]).join(",")}] ${m.ability.name}${m.passive.active ? "+" + m.passive.name : ""} | ${ROLES.flatMap((x) => m.roles[x].reasons).slice(0, 3).map((x) => reasonText(x, (f) => dex.name(f))).join(" / ")}`));
  console.log("  위험:", a.dangerTypes.slice(0, 4).map((x) => dex.name(x)).join(","), "| 이슈:", a.issues.map((x) => x.text).join(" ; "));
  console.log("  제안:", r.suggestions.map((s) => `${s.candidate.form.name}${s.replace ? "↔" + s.replace.form.name : "+"} (${s.covers.map((x) => dex.name(x)).join(",")})`).join(" | "));
}
