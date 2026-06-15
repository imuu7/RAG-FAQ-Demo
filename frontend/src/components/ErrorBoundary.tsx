import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * 攔截子樹的渲染錯誤,避免單一元件(如 EmbeddingGraph)崩潰把整頁拖成白屏。
 * 攔到時就地顯示錯誤訊息,方便回報與除錯。
 */
export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("元件崩潰:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          className="app__error flex items-center gap-[0.55rem] mt-[1.4rem] py-[0.85rem] px-[1.1rem] bg-danger-tint text-danger rounded-[var(--radius)] text-[0.95rem]"
          style={{
            flexDirection: "column",
            alignItems: "flex-start",
            gap: "0.6rem",
          }}
        >
          <strong>⚠ 星圖渲染發生錯誤(已攔截,其他功能不受影響)</strong>
          <pre
            style={{
              margin: 0,
              maxWidth: "100%",
              overflowX: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontSize: "0.8rem",
              color: "inherit",
              background: "transparent",
              border: "none",
              padding: 0,
            }}
          >
            {this.state.error.message}
          </pre>
          <button
            className="askbox__btn"
            type="button"
            onClick={() => this.setState({ error: null })}
          >
            重試
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
