import { useState } from "react";
import AskBox from "./components/AskBox";
import SourcePanel from "./components/SourcePanel";
import { askQuestion, type AskResponse } from "./api";

export default function App() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AskResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAsk = async (question: string) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await askQuestion(question);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "查詢失敗");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="app">
      <header className="app__header">
        <h1>RAG 智慧問答 Demo</h1>
        <p className="app__subtitle">
          本地 pgvector 語意檢索 + Ollama 生成,答案下方附上實際檢索到的來源段落與相似度。
        </p>
      </header>

      <AskBox onAsk={handleAsk} loading={loading} />

      {error && <div className="app__error">發生錯誤:{error}</div>}

      {result && (
        <>
          <section className="answer">
            <h2 className="answer__title">答案</h2>
            <p className="answer__body">{result.answer}</p>
          </section>
          <SourcePanel sources={result.sources} />
        </>
      )}
    </main>
  );
}
