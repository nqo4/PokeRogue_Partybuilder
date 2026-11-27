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

/** Image groups under public/images that get their own version (see src/lib/assets.ts) */
const IMAGE_GROUPS = ["biomes", "trainers", "ribbons", "shiny", "items", "pokemon"] as const;

/**
 * Short hash per image group, appended to image URLs (?v=...) so changed pictures show up right after a deploy.
 * "pokemon" is the loose files in public/images except items.png, "items" is items.png.
 */
function imageVersions(): Record<string, string> {
  const root = path.join(import.meta.dirname, "public", "images");
  const hashes = Object.fromEntries(IMAGE_GROUPS.map((g) => [g, createHash("sha1")]));
  const walk = (dir: string, group: string | null) => {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir).sort()) {
      const p = path.join(dir, name);
      if (fs.statSync(p).isDirectory()) {
        walk(p, group ?? name);
        continue;
      }
      const g = group ?? (name === "items.png" ? "items" : "pokemon");
      hashes[g]?.update(name).update(fs.readFileSync(p));
    }
  };
  walk(root, null);
  return Object.fromEntries(Object.entries(hashes).map(([g, h]) => [g, h.digest("hex").slice(0, 10)]));
}

export default defineConfig({
  plugins: [react()],
  // 상대 경로로 빌드해서 GitHub Pages 같은 하위 경로 배포에서도 동작하게 한다.
  base: "./",
  define: {
    __DATA_VERSION__: JSON.stringify(dataVersion()),
    __IMAGE_VERSIONS__: JSON.stringify(imageVersions()),
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
