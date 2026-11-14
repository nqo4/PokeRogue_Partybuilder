// 코스트 숫자. 게임처럼 감소 횟수에 따라 색이 다르다: 0회 기본색, 1회 파랑, 2회 노랑
export function CostValue({ cost, reductions }: { cost: number; reductions: number }) {
  const r = Math.min(reductions, 2);
  return (
    <span className={`cost-value cost-r${r}`} title={r ? `코스트 ${reductions}회 감소` : undefined}>
      {cost}
    </span>
  );
}
