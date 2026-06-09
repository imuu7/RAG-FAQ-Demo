import type { CompareResponse } from "../api";

interface ComparePanelProps {
  data: CompareResponse;
}

/**
 * 並排呈現「關鍵字搜尋」vs「語意搜尋」,凸顯語意檢索能撈到、關鍵字撈不到。
 */
export default function ComparePanel({ data }: ComparePanelProps) {
  return (
    <section className="compare">
      <div className="compare__col">
        <h3 className="compare__title compare__title--keyword">關鍵字搜尋</h3>
        <p className="compare__hint">ILIKE 子字串比對,用詞不同就撈不到</p>
        {data.keyword.length === 0 ? (
          <p className="compare__empty">沒有任何段落含到問題裡的字 —— 關鍵字搜尋落空。</p>
        ) : (
          <ul className="compare__list">
            {data.keyword.map((s, i) => (
              <li key={i} className="source">
                <div className="source__head">
                  <span className="source__tag">{s.source ?? "未標註來源"}</span>
                </div>
                <p className="source__content">{s.content}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="compare__col">
        <h3 className="compare__title compare__title--semantic">語意搜尋</h3>
        <p className="compare__hint">pgvector 餘弦距離,理解語意、不靠字面</p>
        {data.semantic.length === 0 ? (
          <p className="compare__empty">語料庫為空,請先灌入資料。</p>
        ) : (
          <ul className="compare__list">
            {data.semantic.map((s, i) => (
              <li key={i} className="source">
                <div className="source__head">
                  <span className="source__tag">{s.source ?? "未標註來源"}</span>
                  <span
                    className="source__distance"
                    title="餘弦距離,越小越相近"
                  >
                    距離 {s.distance.toFixed(4)}
                  </span>
                </div>
                <p className="source__content">{s.content}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
