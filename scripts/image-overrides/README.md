# Image overrides

PNG files here replace the images copied from PokeRogue-Dex by `npm run build:dex`
(same layout as `public/images/`: `{img}.png`, `shiny/{img}_{tier}.png`).

All files are built from the official game sprites in
[pokerogue-assets](https://github.com/pagefaultgames/pokerogue-assets) (branch `beta`, `images/pokemon/`),
using the first animation frame (`0001.png` in the atlas), trimmed to its bounding box.

| Images | Why |
|---|---|
| `95.png`, `shiny/95_1..3.png` (Onix) | Dex image was missing the lower jaw |
| 205 other forms (normal + their shiny tiers) | Dex image shape overlapped less than 98% with the official first frame: clipped sprites (e.g. 223 Remoraid tail, 142 Aerodactyl wings, 534 Conkeldurr pillar) or outdated art (e.g. 1021 Raging Bolt, 169 Crobat) |

Shiny tiers follow the game's `getSpriteId` rules with `variant/_masterlist.json`:

- no masterlist entry: tier 1 only, from `shiny/{img}`
- value `0`: from `shiny/{img}` (tier 1)
- value `1`: the normal sprite recolored with `variant/{img}.json["{tier - 1}"]`
- value `2`: separate atlas `variant/{img}_{tier}`

The rules were checked against 20 forms whose Dex images already matched the official sprites:
all three shiny tiers came out pixel-identical.

To regenerate, sparse-clone pokerogue-assets into `vendor/pokerogue-assets`, compare each `public/images/{img}.png`
with the official first frame, and rebuild the forms below the 98% overlap threshold the same way.
