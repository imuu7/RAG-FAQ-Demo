import type { Source } from "../api";
import ScoreBar from "./ScoreBar";

interface SourcePanelProps {
  sources: Source[];
}

export default function SourcePanel({ sources }: SourcePanelProps) {
  if (sources.length === 0) return null;

  return (
    <section className="sources">
      <div className="section-head">
        <p className="eyebrow" style={{ margin: 0 }}>
          檢索到的來源段落
        </p>
        <span className="section-head__count">
          {sources.length} 段 · 依相似度排序
        </span>
      </div>
      <ul className="sources__list">
        {sources.map((s, i) => (
          <li
            key={i}
            className={`source ${i === 0 ? "source--best" : ""}`}
            style={{ animationDelay: `${i * 0.07}s` }}
          >
            <div className="source__head">
              <span className="source__rank">{String(i + 1).padStart(2, "0")}</span>
              <span className="source__tag">{s.source ?? "未標註來源"}</span>
              {i === 0 && <span className="source__best-badge">★ 最佳匹配</span>}
            </div>
            <p className="source__content">{s.content}</p>
            <ScoreBar distance={s.distance} best={i === 0} />
          </li>
        ))}
      </ul>
    </section>
  );
}
