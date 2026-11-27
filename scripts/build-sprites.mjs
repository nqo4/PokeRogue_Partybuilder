// Builds the Pokemon images (public/images/{img}.png and shiny/{img}_{tier}.png) from the official
// pokerogue-assets sprites, using the first frame of each atlas (same frame the game shows in the dex).
// Shiny tiers follow the game's getSpriteId rules with the variant masterlist:
//   no entry          -> tier 1 = shiny/{key}, no tier 2/3
//   value 0           -> shiny/{key} (tier 1 only)
//   value 1           -> normal sprite recolored with variant/{key}.json[tier - 1]
//   value 2           -> separate atlas variant/{key}_{tier}
//
// Needs: public/data/dex.json (npm run export:official) and vendor/pokerogue-assets with images/pokemon
// checked out at the commit pinned by vendor/pokerogue (see scripts/export-official.mjs).
// Run: npm run build:sprites
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const root = path.resolve(import.meta.dirname, "..");
const pk = path.join(root, "vendor", "pokerogue-assets", "images", "pokemon");
const out = path.join(root, "public", "images");
const dex = JSON.parse(fs.readFileSync(path.join(root, "public", "data", "dex.json"), "utf8"));
if (!fs.existsSync(path.join(pk, "variant", "_masterlist.json"))) {
  console.error("vendor/pokerogue-assets/images/pokemon 이 없습니다 (scripts/export-official.mjs 의 준비 단계 참고).");
  process.exit(1);
}
const master = JSON.parse(fs.readFileSync(path.join(pk, "variant", "_masterlist.json"), "utf8"));

// Some official PNGs carry extra bytes after the IEND chunk, which pngjs rejects: cut them off
function readPng(p) {
  let buf = fs.readFileSync(p);
  const iend = buf.lastIndexOf("IEND");
  if (iend > 0 && iend + 8 < buf.length) buf = buf.subarray(0, iend + 8);
  return PNG.sync.read(buf);
}

function framesOf(jsonPath) {
  const d = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  if (d.textures) return d.textures[0].frames;
  const fr = d.frames;
  return Array.isArray(fr) ? fr : Object.entries(fr).map(([filename, v]) => ({ ...v, filename }));
}

/** First frame of an atlas, trimmed to its opaque pixels. null if missing or rotated */
function firstFrame(base) {
  const js = `${base}.json`;
  const png = `${base}.png`;
  if (!fs.existsSync(js) || !fs.existsSync(png)) return null;
  const f = framesOf(js).sort((a, b) => (a.filename < b.filename ? -1 : a.filename > b.filename ? 1 : 0))[0];
  if (!f || f.rotated) return null;
  const sheet = readPng(png);
  const { x, y, w, h } = f.frame;
  // Opaque bounds inside the frame
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      if (sheet.data[((y + j) * sheet.width + (x + i)) * 4 + 3] === 0) continue;
      if (i < minX) minX = i;
      if (j < minY) minY = j;
      if (i > maxX) maxX = i;
      if (j > maxY) maxY = j;
    }
  }
  if (maxX < 0) return null;
  const img = new PNG({ width: maxX - minX + 1, height: maxY - minY + 1 });
  for (let j = 0; j < img.height; j++) {
    const from = ((y + minY + j) * sheet.width + (x + minX)) * 4;
    sheet.data.copy(img.data, j * img.width * 4, from, from + img.width * 4);
  }
  return img;
}

function recolor(img, map) {
  const m = new Map(Object.entries(map).map(([k, v]) => [k.toLowerCase(), v.toLowerCase()]));
  const outImg = new PNG({ width: img.width, height: img.height });
  img.data.copy(outImg.data);
  const hex = (n) => n.toString(16).padStart(2, "0");
  for (let p = 0; p < outImg.data.length; p += 4) {
    if (!outImg.data[p + 3]) continue;
    const to = m.get(hex(outImg.data[p]) + hex(outImg.data[p + 1]) + hex(outImg.data[p + 2]));
    if (!to) continue;
    outImg.data[p] = parseInt(to.slice(0, 2), 16);
    outImg.data[p + 1] = parseInt(to.slice(2, 4), 16);
    outImg.data[p + 2] = parseInt(to.slice(4, 6), 16);
  }
  return outImg;
}

/** Same visible pixels (the color of fully transparent pixels does not matter) */
function samePixels(a, b) {
  for (let i = 0; i < a.length; i += 4) {
    if (a[i + 3] !== b[i + 3]) return false;
    if (a[i + 3] && (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2])) return false;
  }
  return true;
}

/** Write a PNG unless the existing file already has the same pixels (keeps unchanged files out of git diffs) */
function write(img, p) {
  if (fs.existsSync(p)) {
    try {
      const old = readPng(p);
      if (old.width === img.width && old.height === img.height && samePixels(old.data, img.data)) return;
    } catch {
      /* unreadable: overwrite */
    }
  }
  fs.writeFileSync(p, PNG.sync.write(img));
}

fs.mkdirSync(path.join(out, "shiny"), { recursive: true });
const seen = new Set();
let normal = 0;
let shiny = 0;
const missing = [];
for (const s of dex.species) {
  if (seen.has(s.img)) continue;
  seen.add(s.img);
  const img = firstFrame(path.join(pk, s.img));
  if (!img) {
    missing.push(s.img);
    continue;
  }
  write(img, path.join(out, `${s.img}.png`));
  normal++;
  const vset = master[s.img] ?? null;
  let palette = null;
  for (let tier = 1; tier <= (s.variants === 3 ? 3 : 1); tier++) {
    const v = vset ? vset[tier - 1] : null;
    let t = null;
    if (vset == null || v === 0) {
      if (tier === 1) t = firstFrame(path.join(pk, "shiny", s.img));
    } else if (v === 1) {
      palette ??= JSON.parse(fs.readFileSync(path.join(pk, "variant", `${s.img}.json`), "utf8"));
      const map = palette[String(tier - 1)];
      if (map) t = recolor(img, map);
    } else if (v === 2) {
      t = firstFrame(path.join(pk, "variant", `${s.img}_${tier}`));
    }
    if (t) {
      write(t, path.join(out, "shiny", `${s.img}_${tier}.png`));
      shiny++;
    }
  }
}
console.log(`포켓몬 그림 ${normal}장, 이로치 ${shiny}장 → public/images${missing.length ? ` (그림 없음: ${missing.join(", ")})` : ""}`);

// Trainer pictures (first frame of images/trainer/{sprite}) and biome backgrounds (images/arenas/{key}_bg.png)
const official = JSON.parse(fs.readFileSync(path.join(root, "public", "data", "official.json"), "utf8"));
const assets = path.join(root, "vendor", "pokerogue-assets", "images");
const trainerOut = path.join(out, "trainers");
fs.mkdirSync(trainerOut, { recursive: true });
const trainerMissing = [];
let trainers = 0;
for (const key of new Set(official.trainers.map((t) => t.sprite).filter(Boolean))) {
  const img = firstFrame(path.join(assets, "trainer", key));
  if (!img) {
    trainerMissing.push(key);
    continue;
  }
  write(img, path.join(trainerOut, `${key}.png`));
  trainers++;
}
/** Arena layer at full canvas size: a plain PNG, or the first frame of an atlas placed at its source offset */
function layerImage(base) {
  if (fs.existsSync(`${base}.json`) && fs.existsSync(`${base}.png`)) {
    const f = framesOf(`${base}.json`).sort((a, b) => (a.filename < b.filename ? -1 : a.filename > b.filename ? 1 : 0))[0];
    if (!f || f.rotated) return null;
    const sheet = readPng(`${base}.png`);
    const img = new PNG({ width: f.sourceSize.w, height: f.sourceSize.h });
    for (let j = 0; j < f.frame.h; j++) {
      const from = ((f.frame.y + j) * sheet.width + f.frame.x) * 4;
      const to = ((f.spriteSourceSize.y + j) * img.width + f.spriteSourceSize.x) * 4;
      sheet.data.copy(img.data, to, from, from + f.frame.w * 4);
    }
    return img;
  }
  return fs.existsSync(`${base}.png`) ? readPng(`${base}.png`) : null;
}

/** Alpha-blend `top` onto `dst` at the top-left corner */
function blend(dst, top) {
  for (let y = 0; y < Math.min(dst.height, top.height); y++) {
    for (let x = 0; x < Math.min(dst.width, top.width); x++) {
      const s = (y * top.width + x) * 4;
      const a = top.data[s + 3] / 255;
      if (!a) continue;
      const d = (y * dst.width + x) * 4;
      for (let c = 0; c < 3; c++) dst.data[d + c] = Math.round(top.data[s + c] * a + dst.data[d + c] * (1 - a));
      dst.data[d + 3] = Math.max(dst.data[d + 3], top.data[s + 3]);
    }
  }
}

const biomeOut = path.join(out, "biomes");
fs.mkdirSync(biomeOut, { recursive: true });
const biomeMissing = [];
let biomes = 0;
for (const b of official.biomes) {
  const key = b.key.toLowerCase();
  const src = path.join(assets, "arenas", `${key}_bg.png`);
  if (!fs.existsSync(src)) {
    biomeMissing.push(key);
    continue;
  }
  // Like the battle field (ArenaBase): background, then the player platform ({key}_a) and the enemy
  // platform ({key}_b), both full-size layers drawn at the top-left. Random enemy-side props are left out.
  const img = readPng(src);
  for (const layer of [`${key}_a`, `${key}_b`]) {
    const top = layerImage(path.join(assets, "arenas", layer));
    if (top) blend(img, top);
  }
  // Crop to the platform layer height: below it the game shows the battle menu, not the field
  const h = Math.min(img.height, layerImage(path.join(assets, "arenas", `${key}_a`))?.height ?? img.height);
  const cropped = new PNG({ width: img.width, height: h });
  img.data.copy(cropped.data, 0, 0, img.width * h * 4);
  write(cropped, path.join(biomeOut, `${key}.png`));
  biomes++;
}
console.log(
  `트레이너 그림 ${trainers}장${trainerMissing.length ? ` (없음: ${trainerMissing.join(", ")})` : ""}, ` +
    `바이옴 배경 ${biomes}장${biomeMissing.length ? ` (없음: ${biomeMissing.join(", ")})` : ""}`,
);
