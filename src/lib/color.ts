// 색 대비 도우미: 타입 배지 글자색을 배경에 맞춰 고른다 (WCAG 상대 휘도 기준)

const DARK_TEXT = "#16161a";
const LIGHT_TEXT = "#ffffff";

function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const cache = new Map<string, string>();

/** 배경색 위에서 더 잘 읽히는 글자색 (흰색 또는 거의 검정) */
export function readableText(bg: string): string {
  let c = cache.get(bg);
  if (!c) {
    c = contrast(bg, LIGHT_TEXT) >= contrast(bg, DARK_TEXT) ? LIGHT_TEXT : DARK_TEXT;
    cache.set(bg, c);
  }
  return c;
}

/** hex 색을 검정 쪽으로 t(0~1)만큼 어둡게 */
function darken(hex: string, t: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * (1 - t)));
  return "#" + ch.map((v) => v.toString(16).padStart(2, "0")).join("");
}

const styleCache = new Map<string, { background: string; color: string }>();

/**
 * 타입 배지 style: 배경 + 대비가 맞는 글자색.
 * 흰 글자·검은 글자 모두 4.5:1 에 못 미치는 중간 밝기 색은 배경을 조금씩 어둡게 해서 흰 글자를 맞춘다.
 */
export function typeStyle(bg: string | undefined): { background?: string; color?: string } {
  if (!bg) return {};
  let s = styleCache.get(bg);
  if (!s) {
    let back = bg;
    let color = readableText(bg);
    if (Math.max(contrast(bg, LIGHT_TEXT), contrast(bg, DARK_TEXT)) < 4.5) {
      for (let t = 0.04; t <= 0.4 && contrast(back, LIGHT_TEXT) < 4.5; t += 0.04) back = darken(bg, t);
      color = LIGHT_TEXT;
    }
    s = { background: back, color };
    styleCache.set(bg, s);
  }
  return s;
}
