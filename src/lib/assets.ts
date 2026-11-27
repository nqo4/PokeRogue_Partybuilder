// URLs for files in public/images with a per-group version (?v=...) from vite.config.ts, so pictures that
// change keep their file names but still refresh right after a deploy instead of waiting for the cache.

/** e.g. imageUrl("biomes/plains.png"), imageUrl("6.png"), imageUrl("shiny/6_1.png") */
export function imageUrl(path: string): string {
  const slash = path.indexOf("/");
  const group = slash > 0 ? path.slice(0, slash) : path === "items.png" ? "items" : "pokemon";
  const v = __IMAGE_VERSIONS__[group];
  return `${import.meta.env.BASE_URL}images/${path}${v ? `?v=${v}` : ""}`;
}
