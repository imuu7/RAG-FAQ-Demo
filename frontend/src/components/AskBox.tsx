import { useState } from "react";

interface AskBoxProps {
  onAsk: (question: string) => void;
  loading: boolean;
  placeholder?: string;
}

export default function AskBox({ onAsk, loading, placeholder }: AskBoxProps) {
  const [text, setText] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = text.trim();
    if (!q || loading) return;
    onAsk(q);
  };

  return (
    <form onSubmit={submit} className="askbox flex flex-col gap-[0.8rem]">
      <div className="askbox__field relative">
        <textarea
          className="askbox__input w-full pt-4 pr-[3.1rem] pb-4 pl-[1.05rem] text-[1.02rem] leading-[1.6] text-ink bg-surface border border-line-strong rounded-[var(--radius)] resize-y shadow-[var(--shadow-sm)] placeholder:text-ink-3 focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-tint)]"
          placeholder={placeholder ?? "輸入你的問題…"}
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
        <button
          className="askbox__btn"
          type="submit"
          disabled={loading || !text.trim()}
          aria-label={loading ? "查詢中" : "送出"}
        >
          {loading ? (
            <span className="askbox__spinner" />
          ) : (
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              aria-hidden="true"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* 紙飛機(送出) */}
              <path d="M22 2L11 13" />
              <path d="M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          )}
        </button>
      </div>
    </form>
  );
}
