import type { CompareResponse } from "../api";
import ScoreBar from "./ScoreBar";

interface ComparePanelProps {
  data: CompareResponse;
}

/**
 * 並排呈現「關鍵字搜尋」vs「語意搜尋」,凸顯語意檢索能撈到、關鍵字撈不到。
 * 兩側各標命中數,底部用一句總結點出對比張力。
 */
export default function ComparePanel({ data }: ComparePanelProps) {
  const kw = data.keyword.length;
  const sem = data.semantic.length;

  return (
    <section className="compare mt-6 grid grid-cols-2 gap-[1.1rem]">
      <div className="compare__col flex flex-col">
        <div className="compare__head flex items-center gap-2 mb-[0.3rem]">
          <h3 className="compare__title compare__title--keyword m-0 font-bold text-[1.1rem] text-accent-600">關鍵字搜尋</h3>
          <span
            className={`compare__count ${
              kw > 0 ? "compare__count--hit" : "compare__count--miss"
            } text-[0.72rem] font-bold px-[0.5rem] py-[0.12rem] rounded-[var(--radius-tag)]`}
          >
            {kw > 0 ? `✓ ${kw} 筆` : "✕ 0 筆"}
          </span>
        </div>
        <p className="compare__hint text-[0.74rem] leading-[1.5] text-ink-3">ILIKE 子字串比對,用詞不同就撈不到</p>
        {kw === 0 ? (
          <div className="compare__empty flex flex-col gap-[0.3rem] py-[1.1rem] px-4 text-[0.9rem] leading-[1.6] text-ink-2 bg-surface-sunken border border-dashed border-line-strong rounded-[var(--radius)]">
            <b>0 筆命中</b>
            <span>沒有任何段落「字面上」含到問題裡的字 —— 關鍵字搜尋落空。</span>
          </div>
        ) : (
          <ul className="compare__list list-none m-0 p-0 flex flex-col gap-[0.85rem]">
            {data.keyword.map((s, i) => (
              <li
                key={i}
                className="source relative bg-surface border border-line rounded-[var(--radius)]"
                style={{ animationDelay: `${i * 0.07}s` }}
              >
                <div className="source__head flex items-center gap-[0.55rem] mb-[0.7rem]">
                  <span className="source__rank text-[0.74rem] font-bold text-ink-3">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="source__tag text-[0.76rem] font-bold tracking-[0.02em] text-primary-600 bg-primary-tint px-[0.6rem] py-[0.2rem] rounded-[var(--radius-tag)]">{s.source ?? "未標註來源"}</span>
                </div>
                <p className="source__content m-0 text-[0.98rem] leading-[1.75] text-ink-2">{s.content}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="compare__col flex flex-col">
        <div className="compare__head flex items-center gap-2 mb-[0.3rem]">
          <h3 className="compare__title compare__title--semantic m-0 font-bold text-[1.1rem] text-primary">語意搜尋</h3>
          <span
            className={`compare__count ${
              sem > 0 ? "compare__count--hit" : "compare__count--miss"
            } text-[0.72rem] font-bold px-[0.5rem] py-[0.12rem] rounded-[var(--radius-tag)]`}
          >
            {sem > 0 ? `✓ ${sem} 筆` : "✕ 0 筆"}
          </span>
        </div>
        <p className="compare__hint text-[0.74rem] leading-[1.5] text-ink-3">pgvector 餘弦距離,理解語意、不靠字面</p>
        {sem === 0 ? (
          <div className="compare__empty flex flex-col gap-[0.3rem] py-[1.1rem] px-4 text-[0.9rem] leading-[1.6] text-ink-2 bg-surface-sunken border border-dashed border-line-strong rounded-[var(--radius)]">
            <span>語料庫為空,請先灌入資料。</span>
          </div>
        ) : (
          <ul className="compare__list list-none m-0 p-0 flex flex-col gap-[0.85rem]">
            {data.semantic.map((s, i) => (
              <li
                key={i}
                className={`source ${i === 0 ? "source--best" : ""} relative bg-surface border border-line rounded-[var(--radius)]`}
                style={{ animationDelay: `${i * 0.07}s` }}
              >
                <div className="source__head flex items-center gap-[0.55rem] mb-[0.7rem]">
                  <span className="source__rank text-[0.74rem] font-bold text-ink-3">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="source__tag text-[0.76rem] font-bold tracking-[0.02em] text-primary-600 bg-primary-tint px-[0.6rem] py-[0.2rem] rounded-[var(--radius-tag)]">{s.source ?? "未標註來源"}</span>
                  {i === 0 && (
                    <span className="source__best-badge inline-flex items-center gap-[0.3rem] ml-auto text-[0.68rem] font-bold tracking-[0.08em] uppercase text-on-primary bg-accent px-[0.5rem] py-[0.18rem] rounded-[var(--radius-tag)]">★ 最佳匹配</span>
                  )}
                </div>
                <p className="source__content m-0 text-[0.98rem] leading-[1.75] text-ink-2">{s.content}</p>
                <ScoreBar distance={s.distance} best={i === 0} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="compare__summary py-[0.85rem] px-[1.1rem] text-[0.94rem] leading-[1.6] text-ink-2 bg-primary-tint rounded-[var(--radius)]">
        同一個問題:關鍵字命中 <b>{kw}</b> 筆、語意命中 <b>{sem}</b> 筆。
        {kw === 0 && sem > 0
          ? " 用詞一不同,字面搜尋就落空;語意檢索靠向量理解,仍能找到對的段落。"
          : ""}
      </p>
    </section>
  );
}
