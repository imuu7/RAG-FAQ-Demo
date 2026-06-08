import type { Source } from "../api";

interface SourcePanelProps {
  sources: Source[];
}

export default function SourcePanel({ sources }: SourcePanelProps) {
  if (sources.length === 0) return null;

  return (
    <section className="sources">
      <h2 className="sources__title">檢索到的來源段落</h2>
      <ul className="sources__list">
        {sources.map((s, i) => (
          <li key={i} className="source">
            <div className="source__head">
              <span className="source__tag">{s.source ?? "未標註來源"}</span>
              <span className="source__distance" title="餘弦距離,越小越相近">
                距離 {s.distance.toFixed(4)}
              </span>
            </div>
            <p className="source__content">{s.content}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
