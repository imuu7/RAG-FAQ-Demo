import { useEffect, useState } from "react";
import AskBox from "./components/AskBox";
import SourcePanel from "./components/SourcePanel";
import ComparePanel from "./components/ComparePanel";
import ExampleChips from "./components/ExampleChips";
import StatusBar from "./components/StatusBar";
import SkeletonList from "./components/SkeletonList";
import EmbeddingGraph from "./components/EmbeddingGraph";
import ErrorBoundary from "./components/ErrorBoundary";
import ThemeToggle, { type Theme } from "./components/ThemeToggle";
import GalaxyBackground from "./components/GalaxyBackground";
import {
  askQuestionStream,
  compareQuestion,
  fetchGraph,
  type Source,
  type CompareResponse,
  type GraphResponse,
} from "./api";

type Tab = "ask" | "compare" | "graph";

// 範例提問刻意「用詞和履歷不同」,凸顯語意檢索的價值
const ASK_EXAMPLES = [
  "他有資料庫效能調校的經驗嗎?",
  "會帶團隊或管理專案嗎?",
  "熟悉哪些前端與後端技術?",
  "做過雲端或 DevOps 相關的事嗎?",
];

const COMPARE_EXAMPLES = [
  "他會帶團隊嗎?",
  "做過雲端嗎?",
  "有沒有處理過效能問題?",
  "學歷背景是什麼?",
];

export default function App() {
  // 深色模式:初值沿用 index.html 開機腳本已寫入的 data-theme
  const [theme, setTheme] = useState<Theme>(
    () => (document.documentElement.dataset.theme as Theme) || "light"
  );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("theme", theme);
    } catch {
      // 忽略 localStorage 不可用的情況
    }
  }, [theme]);

  const [tab, setTab] = useState<Tab>("ask");

  // 問答(串流)狀態
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [asked, setAsked] = useState(false);

  // 搜尋對比狀態
  const [compareData, setCompareData] = useState<CompareResponse | null>(null);

  // Embedding 星圖狀態(地圖 + 串流答案並存)
  const [graphData, setGraphData] = useState<GraphResponse | null>(null);
  const [graphAnswer, setGraphAnswer] = useState("");
  const [graphLoading, setGraphLoading] = useState(false);
  const [graphAsked, setGraphAsked] = useState(false);

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

  const handleGraph = async (question: string) => {
    setGraphLoading(true);
    setError(null);
    setGraphAnswer("");
    setGraphData(null);
    setGraphAsked(true);

    // 畫圖(全語料距離)與串流答案並行——圖通常先到,答案逐字補上
    fetchGraph(question)
      .then(setGraphData)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "星圖載入失敗")
      );

    await askQuestionStream(question, {
      onSources: () => {},
      onToken: (t) => setGraphAnswer((prev) => prev + t),
      onDone: () => setGraphLoading(false),
      onError: (detail) => {
        setError(detail);
        setGraphLoading(false);
      },
    });
  };

  return (
    <>
      <GalaxyBackground />
      <main className="app">
      <header className="masthead">
        <div className="masthead__bar">
          <span className="masthead__filing">
            <b>游永慶</b> · RÉSUMÉ ARCHIVE
          </span>
          <ThemeToggle
            theme={theme}
            onToggle={() =>
              setTheme((t) => (t === "dark" ? "light" : "dark"))
            }
          />
        </div>

        <p className="eyebrow">RAG · 語意檢索問答</p>
        <h1>
          與<span className="accent">我的履歷</span>對話
        </h1>
        <p className="masthead__subtitle">
          用自然語言詢問游永慶的技能與經歷 —— 本地 <code>pgvector</code>{" "}
          語意檢索 + <code>Ollama</code>{" "}
          生成,答案逐字浮現,並附上實際檢索到的履歷段落與相似度分數。
        </p>

        <StatusBar />
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
        <button
          className={`tabs__btn ${tab === "graph" ? "tabs__btn--active" : ""}`}
          onClick={() => setTab("graph")}
        >
          Embedding 星圖
        </button>
      </nav>

      {tab === "ask" && (
        <>
          <AskBox
            onAsk={handleAsk}
            loading={loading}
            placeholder="輸入你的問題,例如:他有資料庫效能調校的經驗嗎?"
          />

          {error && <div className="app__error">⚠ 發生錯誤:{error}</div>}

          {!asked && !error && (
            <ExampleChips
              questions={ASK_EXAMPLES}
              onPick={handleAsk}
              lead="試著問一個「用詞和履歷不一樣」的問題,看語意檢索怎麼找到對的段落:"
            />
          )}

          {asked && (
            <>
              <section className="answer">
                <p className="eyebrow">生成回答</p>
                <p className="answer__body">
                  {answer}
                  {loading && <span className="answer__cursor">▍</span>}
                </p>
              </section>

              {sources.length > 0 ? (
                <SourcePanel sources={sources} />
              ) : loading ? (
                <section className="sources">
                  <div className="section-head">
                    <p className="eyebrow" style={{ margin: 0 }}>
                      檢索到的來源段落
                    </p>
                  </div>
                  <SkeletonList count={3} />
                </section>
              ) : null}
            </>
          )}
        </>
      )}

      {tab === "compare" && (
        <>
          <AskBox
            onAsk={handleCompare}
            loading={loading}
            placeholder="輸入一個用詞與履歷不同的問題,例如:他會帶團隊嗎?做過雲端嗎?"
          />

          {error && <div className="app__error">⚠ 發生錯誤:{error}</div>}

          {!compareData && !loading && !error && (
            <ExampleChips
              questions={COMPARE_EXAMPLES}
              onPick={handleCompare}
              lead="同一個問題,左邊用關鍵字(字面)搜尋、右邊用語意搜尋,看誰撈得到:"
            />
          )}

          {loading && (
            <section className="compare">
              <div className="compare__col">
                <div className="compare__head">
                  <h3 className="compare__title compare__title--keyword">
                    關鍵字搜尋
                  </h3>
                </div>
                <SkeletonList count={2} />
              </div>
              <div className="compare__col">
                <div className="compare__head">
                  <h3 className="compare__title compare__title--semantic">
                    語意搜尋
                  </h3>
                </div>
                <SkeletonList count={2} />
              </div>
            </section>
          )}

          {compareData && !loading && <ComparePanel data={compareData} />}
        </>
      )}

      {tab === "graph" && (
        <>
          <AskBox
            onAsk={handleGraph}
            loading={graphLoading}
            placeholder="輸入問題,看它落在履歷向量空間的哪裡,並同時生成答案"
          />

          {error && <div className="app__error">⚠ 發生錯誤:{error}</div>}

          {!graphAsked && !error && (
            <ExampleChips
              questions={ASK_EXAMPLES}
              onPick={handleGraph}
              lead="問一個問題,看它在履歷的語意向量空間裡離哪些段落最近,答案同時生成:"
            />
          )}

          {graphAsked && (
            <>
              <section className="answer">
                <p className="eyebrow">生成回答</p>
                <p className="answer__body">
                  {graphAnswer}
                  {graphLoading && <span className="answer__cursor">▍</span>}
                </p>
              </section>

              {graphData ? (
                <ErrorBoundary>
                  <EmbeddingGraph data={graphData} theme={theme} />
                </ErrorBoundary>
              ) : (
                <div className="graph-wrap graph-loading">
                  <span className="askbox__spinner" />
                  正在計算 query 對全語料的向量距離…
                </div>
              )}
            </>
          )}
        </>
      )}

      <footer className="app__footer">
        本地全端 RAG Demo · <b>FastAPI</b> + <b>pgvector</b> + <b>Ollama</b> ·
        三容器跑在 WSL2,Ollama 走 host GPU 推論
      </footer>
    </main>
    </>
  );
}
