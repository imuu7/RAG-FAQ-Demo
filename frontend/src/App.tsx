import { useState } from "react";
import AskBox from "./components/AskBox";
import SourcePanel from "./components/SourcePanel";
import ComparePanel from "./components/ComparePanel";
import {
  askQuestionStream,
  compareQuestion,
  type Source,
  type CompareResponse,
} from "./api";

type Tab = "ask" | "compare";

export default function App() {
  const [tab, setTab] = useState<Tab>("ask");

  // 問答(串流)狀態
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [asked, setAsked] = useState(false);

  // 搜尋對比狀態
  const [compareData, setCompareData] = useState<CompareResponse | null>(null);

  const [error, setError] = useState<string | null>(null);

  const handleAsk = async (question: string) => {
    setLoading(true);
    setError(null);
    setAnswer("");
    setSources([]);
    setAsked(true);

    await askQuestionStream(question, {
      onSources: (s) => setSources(s),
      onToken: (t) => setAnswer((prev) => prev + t),
      onDone: () => setLoading(false),
      onError: (detail) => {
        setError(detail);
        setLoading(false);
      },
    });
  };

  const handleCompare = async (question: string) => {
    setLoading(true);
    setError(null);
    setCompareData(null);
    try {
      const res = await compareQuestion(question);
      setCompareData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "查詢失敗");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="app">
      <header className="app__header">
        <h1>與我的履歷對話</h1>
        <p className="app__subtitle">
          用自然語言詢問游永慶的技能與經歷 —— 本地 pgvector 語意檢索 + Ollama
          生成,答案逐字浮現,並附上實際檢索到的履歷段落與相似度。
        </p>
      </header>

      <nav className="tabs">
        <button
          className={`tabs__btn ${tab === "ask" ? "tabs__btn--active" : ""}`}
          onClick={() => setTab("ask")}
        >
          問答
        </button>
        <button
          className={`tabs__btn ${tab === "compare" ? "tabs__btn--active" : ""}`}
          onClick={() => setTab("compare")}
        >
          搜尋對比
        </button>
      </nav>

      {tab === "ask" ? (
        <>
          <AskBox
            onAsk={handleAsk}
            loading={loading}
            placeholder="輸入你的問題,例如:他有資料庫效能調校的經驗嗎?"
          />

          {error && <div className="app__error">發生錯誤:{error}</div>}

          {asked && (
            <>
              <section className="answer">
                <h2 className="answer__title">答案</h2>
                <p className="answer__body">
                  {answer}
                  {loading && <span className="answer__cursor">▍</span>}
                </p>
              </section>
              <SourcePanel sources={sources} />
            </>
          )}
        </>
      ) : (
        <>
          <AskBox
            onAsk={handleCompare}
            loading={loading}
            placeholder="輸入一個用詞與履歷不同的問題,例如:他會帶團隊嗎?做過雲端嗎?"
          />

          {error && <div className="app__error">發生錯誤:{error}</div>}

          {compareData && <ComparePanel data={compareData} />}
        </>
      )}
    </main>
  );
}
