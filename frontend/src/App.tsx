import { useEffect, useState, type ReactNode } from "react";
import AskBox from "./components/AskBox";
import SourcePanel from "./components/SourcePanel";
import ComparePanel from "./components/ComparePanel";
import ExampleChips from "./components/ExampleChips";
import SkeletonList from "./components/SkeletonList";
import EmbeddingGraph from "./components/EmbeddingGraph";
import ErrorBoundary from "./components/ErrorBoundary";
import GalaxyBackground from "./components/GalaxyBackground";
import Sidebar, { type Tab, type HistoryItem } from "./components/Sidebar";
import { type Theme } from "./components/ThemeToggle";
import {
  askQuestionStream,
  compareQuestion,
  fetchGraph,
  type Source,
  type CompareResponse,
  type GraphResponse,
} from "./api";

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

const HISTORY_KEY = "resume-chat-history";
const HISTORY_LIMIT = 30;

// 對話區共用的標題(empty 態垂直置中顯示)
function Hero() {
  return (
    <header className="hero">
      <p className="eyebrow">RAG · 語意檢索問答</p>
      <h1>
        與<span className="accent">我的履歷</span>對話
      </h1>
      <p className="hero__subtitle">
        用自然語言詢問游永慶的技能與經歷 —— 本地 <code>pgvector</code>{" "}
        語意檢索 + <code>Ollama</code>{" "}
        生成,答案逐字浮現,並附上實際檢索到的履歷段落與相似度分數。
      </p>
    </header>
  );
}

// 右側對話區版型:未提問→置中起始態;已提問→上方捲動結果 + 下方貼底輸入框
function ChatPane({
  active,
  results,
  examples,
  askbox,
  error,
}: {
  active: boolean;
  results: ReactNode;
  examples: ReactNode;
  askbox: ReactNode;
  error: ReactNode;
}) {
  if (!active) {
    return (
      <section className="chat chat--empty">
        <div className="chat__center">
          <Hero />
          {error}
          {askbox}
          {examples}
        </div>
      </section>
    );
  }
  return (
    <section className="chat chat--active">
      <div className="chat__scroll">
        {error}
        {results}
      </div>
      <div className="chat__composer">{askbox}</div>
    </section>
  );
}

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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // 提問歷史(localStorage 持久化)
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      return raw ? (JSON.parse(raw) as HistoryItem[]) : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch {
      // 忽略 localStorage 不可用的情況
    }
  }, [history]);

  const addHistory = (q: string, t: Tab) => {
    setHistory((prev) => {
      const ts = prev.length ? prev[0].ts + 1 : 1; // 避免依賴 Date.now,單調遞增即可
      const deduped = prev.filter((it) => !(it.q === q && it.tab === t));
      return [{ q, tab: t, ts }, ...deduped].slice(0, HISTORY_LIMIT);
    });
  };

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
    addHistory(question, "ask");

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
    addHistory(question, "compare");
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
    addHistory(question, "graph");

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

  // 依分頁分派提問(歷史重跑共用)
  const runOnTab = (q: string, t: Tab) => {
    if (t === "ask") handleAsk(q);
    else if (t === "compare") handleCompare(q);
    else handleGraph(q);
  };

  const handleSelectTab = (t: Tab) => {
    setTab(t);
    setSidebarOpen(false);
  };

  const handlePickHistory = (item: HistoryItem) => {
    setTab(item.tab);
    setSidebarOpen(false);
    runOnTab(item.q, item.tab);
  };

  const errorBox = error ? (
    <div className="app__error">⚠ 發生錯誤:{error}</div>
  ) : null;

  return (
    <>
      <GalaxyBackground />

      <button
        className="sidebar-toggle"
        onClick={() => setSidebarOpen((o) => !o)}
        aria-label="開關側邊欄"
      >
        ☰
      </button>

      <div className="shell" data-sidebar-open={sidebarOpen}>
        <div
          className="shell__backdrop"
          onClick={() => setSidebarOpen(false)}
        />

        <Sidebar
          tab={tab}
          onSelectTab={handleSelectTab}
          history={history}
          onPickHistory={handlePickHistory}
          onClearHistory={() => setHistory([])}
          theme={theme}
          onToggleTheme={() =>
            setTheme((t) => (t === "dark" ? "light" : "dark"))
          }
        />

        {tab === "ask" && (
          <ChatPane
            active={asked}
            error={errorBox}
            askbox={
              <AskBox
                onAsk={handleAsk}
                loading={loading}
                placeholder="輸入你的問題,例如:他有資料庫效能調校的經驗嗎?"
              />
            }
            examples={
              !error && (
                <ExampleChips
                  questions={ASK_EXAMPLES}
                  onPick={handleAsk}
                  lead="試著問一個「用詞和履歷不一樣」的問題,看語意檢索怎麼找到對的段落:"
                />
              )
            }
            results={
              <div className="workspace">
                <section className="answer workspace__main">
                  <p className="eyebrow">生成回答</p>
                  <p className="answer__body">
                    {answer}
                    {loading && <span className="answer__cursor">▍</span>}
                  </p>
                </section>

                <div className="workspace__side">
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
                </div>
              </div>
            }
          />
        )}

        {tab === "compare" && (
          <ChatPane
            active={Boolean(compareData) || loading || Boolean(error)}
            error={errorBox}
            askbox={
              <AskBox
                onAsk={handleCompare}
                loading={loading}
                placeholder="輸入一個用詞與履歷不同的問題,例如:他會帶團隊嗎?做過雲端嗎?"
              />
            }
            examples={
              <ExampleChips
                questions={COMPARE_EXAMPLES}
                onPick={handleCompare}
                lead="同一個問題,左邊用關鍵字(字面)搜尋、右邊用語意搜尋,看誰撈得到:"
              />
            }
            results={
              loading ? (
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
              ) : compareData ? (
                <ComparePanel data={compareData} />
              ) : null
            }
          />
        )}

        {tab === "graph" && (
          <ChatPane
            active={graphAsked}
            error={errorBox}
            askbox={
              <AskBox
                onAsk={handleGraph}
                loading={graphLoading}
                placeholder="輸入問題,看它落在履歷向量空間的哪裡,並同時生成答案"
              />
            }
            examples={
              !error && (
                <ExampleChips
                  questions={ASK_EXAMPLES}
                  onPick={handleGraph}
                  lead="問一個問題,看它在履歷的語意向量空間裡離哪些段落最近,答案同時生成:"
                />
              )
            }
            results={
              <div className="workspace workspace--graph">
                <section className="answer workspace__main">
                  <p className="eyebrow">生成回答</p>
                  <p className="answer__body">
                    {graphAnswer}
                    {graphLoading && <span className="answer__cursor">▍</span>}
                  </p>
                </section>

                <div className="workspace__side">
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
                </div>
              </div>
            }
          />
        )}
      </div>
    </>
  );
}
