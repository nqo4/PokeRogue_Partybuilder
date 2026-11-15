// 배경 색 설정: 밝게 / 어둡게 / 시스템 설정에 맞게.
// 고른 값은 이 브라우저에만 저장하고, 실제 색은 <html data-theme="light|dark"> 로 정한다.
// 첫 화면이 깜빡이지 않도록 index.html 의 작은 스크립트가 같은 규칙으로 먼저 한 번 정한다.

export type ThemeChoice = "light" | "dark" | "system";

const KEY = "theme";
const darkQuery = () => window.matchMedia("(prefers-color-scheme: dark)");

export function loadTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    // 저장소를 못 쓰는 브라우저(사생활 보호 모드 등)는 시스템 설정을 따른다
  }
  return "system";
}

export function applyTheme(choice: ThemeChoice): void {
  const dark = choice === "dark" || (choice === "system" && darkQuery().matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export function saveTheme(choice: ThemeChoice): void {
  try {
    if (choice === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {
    // 저장을 못 해도 지금 화면에는 적용된다
  }
  applyTheme(choice);
}

/** 시스템 설정을 따르는 동안 OS 의 밝기 설정이 바뀌면 바로 반영한다. 정리 함수를 돌려준다 */
export function followSystem(choice: ThemeChoice): () => void {
  if (choice !== "system") return () => {};
  const q = darkQuery();
  const on = () => applyTheme("system");
  q.addEventListener("change", on);
  return () => q.removeEventListener("change", on);
}
