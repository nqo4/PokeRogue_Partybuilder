/// <reference types="vitest" />
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Short hash of the game data files. The app appends it to the data URLs (?v=...), so a deploy with new data
 * is fetched right away instead of waiting for the browser / CDN cache of public/data to expire.
 */
function dataVersion(): string {
  const hash = createHash("sha1");
  for (const f of ["dex.json", "official.json"]) {
    const p = path.join(import.meta.dirname, "public", "data", f);
    if (fs.existsSync(p)) hash.update(fs.readFileSync(p));
  }
  return hash.digest("hex").slice(0, 10);
}

export default defineConfig({
  plugins: [react()],
  // 상대 경로로 빌드해서 GitHub Pages 같은 하위 경로 배포에서도 동작하게 한다.
  base: "./",
  define: {
    __DATA_VERSION__: JSON.stringify(dataVersion()),
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
