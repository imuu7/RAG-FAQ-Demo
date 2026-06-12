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
    <div className={`scorebar ${best ? "scorebar--best" : ""}`}>
      <div className="scorebar__track">
        <div className="scorebar__fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="scorebar__meta">
        <span className="scorebar__pct">相似度 {pct}%</span>
        <span className="scorebar__dist">cos 距離 {distance.toFixed(4)}</span>
      </div>
    </div>
  );
}
