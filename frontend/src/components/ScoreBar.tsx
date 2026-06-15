interface ScoreBarProps {
  distance: number;
  best?: boolean;
}

/**
 * 把餘弦距離視覺化成相似度條。
 * pgvector `<=>` 是餘弦距離 ∈ [0,2];餘弦相似度 = 1 - distance,夾到 [0,1]。
 */
export default function ScoreBar({ distance, best = false }: ScoreBarProps) {
  const sim = Math.max(0, Math.min(1, 1 - distance));
  const pct = Math.round(sim * 100);

  return (
    <div className={`scorebar ${best ? "scorebar--best" : ""} mt-[0.85rem]`}>
      <div className="scorebar__track h-1.5 bg-surface-sunken rounded-full overflow-hidden">
        <div className="scorebar__fill h-full rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <div className="scorebar__meta flex items-baseline justify-between mt-[0.4rem] text-[0.74rem]">
        <span className="scorebar__pct font-bold text-ink">相似度 {pct}%</span>
        <span className="scorebar__dist text-ink-3 tracking-[0.02em]">cos 距離 {distance.toFixed(4)}</span>
      </div>
    </div>
  );
}
