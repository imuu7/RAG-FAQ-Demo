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
    <section className="compare">
      <div className="compare__col">
        <div className="compare__head">
          <h3 className="compare__title compare__title--keyword">關鍵字搜尋</h3>
          <span
            className={`compare__count ${
              kw > 0 ? "compare__count--hit" : "compare__count--miss"
            }`}
          >
            {kw > 0 ? `✓ ${kw} 筆` : "✕ 0 筆"}
          </span>
        </div>
        <p className="compare__hint">ILIKE 子字串比對,用詞不同就撈不到</p>
        {kw === 0 ? (
          <div className="compare__empty">
            <b>0 筆命中</b>
            <span>沒有任何段落「字面上」含到問題裡的字 —— 關鍵字搜尋落空。</span>
          </div>
        ) : (
          <ul className="compare__list">
            {data.keyword.map((s, i) => (
              <li
                key={i}
                className="source"
                style={{ animationDelay: `${i * 0.07}s` }}
              >
                <div className="source__head">
                  <span className="source__rank">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="source__tag">{s.source ?? "未標註來源"}</span>
                </div>
                <p className="source__content">{s.content}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="compare__col">
        <div className="compare__head">
          <h3 className="compare__title compare__title--semantic">語意搜尋</h3>
          <span
            className={`compare__count ${
              sem > 0 ? "compare__count--hit" : "compare__count--miss"
            }`}
          >
            {sem > 0 ? `✓ ${sem} 筆` : "✕ 0 筆"}
          </span>
        </div>
        <p className="compare__hint">pgvector 餘弦距離,理解語意、不靠字面</p>
        {sem === 0 ? (
          <div className="compare__empty">
            <span>語料庫為空,請先灌入資料。</span>
          </div>
        ) : (
          <ul className="compare__list">
            {data.semantic.map((s, i) => (
              <li
                key={i}
                className={`source ${i === 0 ? "source--best" : ""}`}
                style={{ animationDelay: `${i * 0.07}s` }}
              >
                <div className="source__head">
                  <span className="source__rank">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="source__tag">{s.source ?? "未標註來源"}</span>
                  {i === 0 && (
                    <span className="source__best-badge">★ 最佳匹配</span>
                  )}
                </div>
                <p className="source__content">{s.content}</p>
                <ScoreBar distance={s.distance} best={i === 0} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="compare__summary">
        同一個問題:關鍵字命中 <b>{kw}</b> 筆、語意命中 <b>{sem}</b> 筆。
        {kw === 0 && sem > 0
          ? " 用詞一不同,字面搜尋就落空;語意檢索靠向量理解,仍能找到對的段落。"
          : ""}
      </p>
    </section>
  );
}
