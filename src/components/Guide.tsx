// 처음 하는 사람을 위한 역할·용어 설명. 추천 기준은 src/config/classic.json 과 같게 유지한다.
import classic from "../config/classic.json";
import { ROLE_NAMES } from "../lib/classic/candidate";

const ROLES: { key: keyof typeof ROLE_NAMES; what: string; how: string; examples: string }[] = [
  {
    key: "fast",
    what: "상대보다 먼저 공격해서 맞기 전에 쓰러뜨리는 포켓몬. 피해를 덜 받으니 회복 아이템을 아낄 수 있습니다.",
    how: `스피드 ${classic.fast.minSpeed} 이상이면서 공격이나 특공이 ${classic.fast.minOffense} 이상, 또는 자기 타입과 같은 선공기(위력 ${classic.fast.priorityMinPower} 이상)를 배우는 경우`,
    examples: "팬텀, 후딘, 개굴닌자, 드래펄트",
  },
  {
    key: "sweeper",
    what: "혼자서 여러 웨이브를 정리하는 에이스. 능력치를 올린 뒤 계속 쓰러뜨립니다.",
    how: `종족값 ${classic.sweeper.legendBst} 이상의 고화력·고스피드 포켓몬, 칼춤·용의춤·나비춤·껍질깨기 같은 랭크업 기술, 또는 특성·패시브 시너지(모래날림+모래헤치기, 돌머리+이판사판 등)`,
    examples: "용의춤 한카리아스, 껍질깨기 파르셀, 모래헤치기 마기라스",
  },
  {
    key: "multi",
    what: "보스의 실드를 여러 번 깎거나, 더블배틀에서 상대 둘을 한 번에 공격하는 포켓몬.",
    how: `위력 ${classic.multi.spreadMinPower} 이상의 광역기(파도타기, 지진 등), 또는 자기 타입 연속기·스킬링크·테크니션 연속기`,
    examples: "분화 그란돈, 스킬링크 연속기 포켓몬",
  },
  {
    key: "tank",
    what: "공격을 버티면서 시간을 버는 포켓몬. 파티의 약점 타입을 받아 줍니다.",
    how: `HP×방어 또는 HP×특방이 ${classic.tank.minBulkProduct.toLocaleString()} 이상. 회복기가 있으면 더 높게 봅니다`,
    examples: "크레세리아, 레지아이스, 맘복치",
  },
  {
    key: "support",
    what: "상대를 방해하거나 아군을 돕는 포켓몬. 위액으로 보스 특성을 지우거나, 빛의장막으로 피해를 줄입니다.",
    how: "위액·하품·빛의장막·리플렉터·도발·전기자석파 같은 기술, 또는 위협·짓궂은마음·재생력 같은 특성",
    examples: "그랑블루(위협), 짓궂은마음 포켓몬",
  },
];

const TERMS: [string, string][] = [
  ["코스트", "스타팅 포켓몬마다 정해진 값. 클래식은 파티 코스트 합이 10 이하여야 합니다."],
  ["코스트 감소", "사탕으로 코스트를 줄이는 것. 1회에 1씩 줄고, 1 이하에서는 절반씩(1 → 0.5 → 0.25) 줄어듭니다."],
  ["패시브", "사탕으로 해금하는 추가 특성. 원래 특성과 함께 항상 켜져 있어서 특성이 두 개인 셈입니다."],
  ["알기술", "알을 부화시켜 해금하는 기술 4개. 4번째는 레어 알기술로 해금이 더 어렵습니다."],
  ["이로치 티어·럭", "색이 다른 포켓몬은 1~3티어가 있고, 티어만큼 럭이 오릅니다. 파티 럭 합이 높으면 상점에 좋은 아이템이 더 잘 나옵니다."],
  ["개체치(IV)", "능력치마다 0~31인 숨은 값. 6V는 여섯 개가 모두 31이라는 뜻입니다. 스타터의 개체치는 진화·메가진화 후에도 그대로 이어집니다."],
  ["성격", "능력치 하나를 10% 올리고 하나를 10% 내립니다. 물리형은 고집·명랑, 특수형은 조심·겁쟁이가 기본입니다."],
  ["물리형 / 특수형", "공격 종족값이 더 높으면 물리형, 특공이 더 높으면 특수형입니다. 물리기는 공격, 특수기는 특공으로 피해가 정해집니다."],
  ["자속(자속 보정)", "포켓몬 자신의 타입과 같은 타입의 기술을 쓰면 위력이 1.5배가 됩니다."],
  ["선공기", "우선도가 높아서 스피드와 상관없이 먼저 나가는 기술 (아쿠아제트, 기습 등)."],
  ["광역기", "상대 전체(또는 필드 전체)를 공격하는 기술 (파도타기, 지진 등). 더블배틀에서 강합니다."],
  ["랭크업", "칼춤처럼 능력치를 단계적으로 올리는 기술. 2단계면 2배가 됩니다."],
  ["보스 실드", "보스 포켓몬의 HP 막대에 있는 칸. 칸마다 나눠서 깎아야 하므로 연속기가 유리합니다."],
  ["폼 변화", "메가진화·거다이맥스·기타 폼 변화. 보유 현황에서 어둡게 보이는 형태는 아직 잡지 못한 형태입니다."],
  ["클래식 클리어", "클래식 모드를 그 포켓몬과 함께 끝까지 깬 횟수. 이 사이트는 0회인 포켓몬 위주로 파티를 짭니다."],
];

export function Guide() {
  return (
    <section className="guide">
      <h2>파티 역할</h2>
      <p className="muted small">
        추천 파티는 아래 역할 중 <b>선공형이나 스위퍼를 최소 1마리</b> 넣고, 나머지로 약점을 보완하도록 짭니다.
      </p>
      <div className="guide-roles">
        {ROLES.map((r) => (
          <article key={r.key} className="guide-card">
            <h3>
              <span className={`role role-${r.key}`}>{ROLE_NAMES[r.key]}</span>
            </h3>
            <p>{r.what}</p>
            <p className="small">
              <span className="label">판정 기준</span> {r.how}
            </p>
            <p className="small muted">
              <span className="label">예</span> {r.examples}
            </p>
          </article>
        ))}
      </div>

      <h2>용어</h2>
      <dl className="glossary">
        {TERMS.map(([t, d]) => (
          <div key={t}>
            <dt>{t}</dt>
            <dd>{d}</dd>
          </div>
        ))}
      </dl>

      <h2>상성표 읽는 법</h2>
      <p className="small">
        추천 카드의 "받는 데미지 상성표"는 각 공격 타입을 받았을 때의 배율입니다. <span className="mult m-weak">2</span>·
        <span className="mult m-quad">4</span>는 약점, <span className="mult m-resist">½</span>은 반감,{" "}
        <span className="mult m-immune">0</span>은 무효입니다. 두꺼운지방·복슬복슬·피뢰침처럼 받는 피해를 바꾸는 특성과
        패시브도 반영되어 있습니다. 약점인 포켓몬이 많고 받아 줄 포켓몬이 적은 타입은 빨간 줄로 표시됩니다.
      </p>
    </section>
  );
}
