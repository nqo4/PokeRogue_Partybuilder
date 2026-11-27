/** Hash of public/data at build time (vite.config.ts define), used to bust the data cache on deploy */
declare const __DATA_VERSION__: string;
/** Hash per image group (biomes, trainers, ribbons, shiny, items, pokemon) at build time */
declare const __IMAGE_VERSIONS__: Record<string, string>;
