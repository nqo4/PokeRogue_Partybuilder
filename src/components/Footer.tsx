import type { Dex } from "../lib/dex";

export function Footer({ dex }: { dex: Dex | null }) {
  const src = dex?.data.source;
  return (
    <footer className="footer muted">
      <p>
        포켓몬 데이터 출처:{" "}
        <a href="https://github.com/Sandstormer/PokeRogue-Dex" target="_blank" rel="noreferrer">
          PokeRogue-Dex
        </a>{" "}
        (AGPL-3.0{src ? `, 게임 ${src.gameVersion}, 커밋 ${src.commit.slice(0, 7)}` : ""}) · 진화·바이옴·트레이너 데이터와 게임 규칙:{" "}
        <a href="https://github.com/pagefaultgames/pokerogue" target="_blank" rel="noreferrer">
          pagefaultgames/pokerogue
        </a>{" "}
        (AGPL-3.0)
      </p>
      <p>
        이 사이트는 팬이 만든 비공식 도구이며 포켓로그 개발팀과 관련이 없습니다. 포켓몬 관련 명칭의 권리는
        Nintendo · Creatures · GAME FREAK 에 있습니다.
      </p>
    </footer>
  );
}
