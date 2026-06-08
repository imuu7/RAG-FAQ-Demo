import { useState } from "react";

interface AskBoxProps {
  onAsk: (question: string) => void;
  loading: boolean;
}

export default function AskBox({ onAsk, loading }: AskBoxProps) {
  const [text, setText] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = text.trim();
    if (!q || loading) return;
    onAsk(q);
  };

  return (
    <form onSubmit={submit} className="askbox">
      <textarea
        className="askbox__input"
        placeholder="輸入你的問題,例如:沒休完的假會不見嗎?"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          // Enter 送出,Shift+Enter 換行
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit(e);
          }
        }}
        rows={3}
        disabled={loading}
      />
      <button className="askbox__btn" type="submit" disabled={loading}>
        {loading ? "查詢中…" : "送出"}
      </button>
    </form>
  );
}
