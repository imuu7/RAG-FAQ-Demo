import type { Source } from "../api";
import ScoreBar from "./ScoreBar";

interface SourcePanelProps {
  sources: Source[];
}

export default function SourcePanel({ sources }: SourcePanelProps) {
  if (sources.length === 0) return null;

  return (
    <section className="sources mt-2">
      <div className="section-head flex items-baseline justify-between gap-4 mt-8 mb-4">
        <p className="eyebrow" style={{ margin: 0 }}>
          檢索到的來源段落
        </p>
        <span className="section-head__count text-[0.74rem] text-ink-3 tracking-[0.04em]">
          {sources.length} 段 · 依相似度排序
        </span>
      </div>
      <ul className="sources__list list-none m-0 p-0 flex flex-col gap-[0.85rem]">
        {sources.map((s, i) => (
          <li
            key={i}
            className={`source ${i === 0 ? "source--best" : ""} relative bg-surface border border-line rounded-[var(--radius)]`}
            style={{ animationDelay: `${i * 0.07}s` }}
          >
            <div className="source__head flex items-center gap-[0.55rem] mb-[0.7rem]">
              <span className="source__rank text-[0.74rem] font-bold text-ink-3">{String(i + 1).padStart(2, "0")}</span>
              <span className="source__tag text-[0.76rem] font-bold tracking-[0.02em] text-primary-600 bg-primary-tint px-[0.6rem] py-[0.2rem] rounded-[var(--radius-tag)]">{s.source ?? "未標註來源"}</span>
              {i === 0 && <span className="source__best-badge inline-flex items-center gap-[0.3rem] ml-auto text-[0.68rem] font-bold tracking-[0.08em] uppercase text-on-primary bg-accent px-[0.5rem] py-[0.18rem] rounded-[var(--radius-tag)]">★ 最佳匹配</span>}
            </div>
            <p className="source__content m-0 text-[0.98rem] leading-[1.75] text-ink-2">{s.content}</p>
            <ScoreBar distance={s.distance} best={i === 0} />
          </li>
        ))}
      </ul>
    </section>
  );
}
