import StatusBar from "./StatusBar";
import ThemeToggle, { type Theme } from "./ThemeToggle";

export type Tab = "ask" | "compare" | "graph";

export interface HistoryItem {
  q: string;
  tab: Tab;
  ts: number;
}

// 分頁的顯示名稱與歷史清單用的短標記
const TAB_META: Record<Tab, { label: string; mark: string }> = {
  ask: { label: "問答", mark: "問" },
  compare: { label: "搜尋對比", mark: "對比" },
  graph: { label: "Embedding 星圖", mark: "星" },
};

const TAB_ORDER: Tab[] = ["ask", "compare", "graph"];

interface SidebarProps {
  tab: Tab;
  onSelectTab: (tab: Tab) => void;
  history: HistoryItem[];
  onPickHistory: (item: HistoryItem) => void;
  onClearHistory: () => void;
  theme: Theme;
  onToggleTheme: () => void;
}

export default function Sidebar({
  tab,
  onSelectTab,
  history,
  onPickHistory,
  onClearHistory,
  theme,
  onToggleTheme,
}: SidebarProps) {
  return (
    <aside className="sidebar shrink-0 h-full flex flex-col bg-surface border-r border-line">
      <div className="sidebar__brand shrink-0 pt-[1.3rem] px-[1.25rem] pb-[1.1rem] text-[0.72rem] tracking-[0.16em] uppercase text-ink-3 border-b border-line">
        <b>游永慶</b> · RÉSUMÉ ARCHIVE
      </div>

      <nav className="sidenav shrink-0 flex flex-col gap-1 py-[0.9rem] px-3">
        {TAB_ORDER.map((t) => (
          <button
            key={t}
            className={`sidenav__btn ${tab === t ? "sidenav__btn--active" : ""} flex items-center min-h-[44px] py-[0.65rem] px-[0.9rem] text-left font-medium text-[0.98rem] text-ink-2 bg-transparent border border-transparent rounded-[var(--radius-sm)] cursor-pointer`}
            onClick={() => onSelectTab(t)}
          >
            {TAB_META[t].label}
          </button>
        ))}
      </nav>

      <div className="sidebar__history flex-1 min-h-0 overflow-y-auto pt-[0.4rem] px-3 pb-4 border-t border-line">
        <div className="sidebar__history-head flex items-center justify-between mt-[0.7rem] mx-1 mb-[0.6rem]">
          <p className="eyebrow" style={{ margin: 0 }}>
            提問紀錄
          </p>
          {history.length > 0 && (
            <button className="sidebar__clear text-[0.7rem] text-ink-3 bg-transparent border-none cursor-pointer" onClick={onClearHistory}>
              清除
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <p className="sidebar__empty m-0 py-[0.4rem] px-[0.3rem] text-[0.85rem] leading-[1.6] text-ink-3">尚無提問紀錄</p>
        ) : (
          <ul className="history list-none m-0 p-0 flex flex-col gap-[0.15rem]">
            {history.map((item) => (
              <li key={`${item.tab}-${item.ts}`}>
                <button
                  className="history__item flex items-center gap-2 w-full py-2 px-[0.55rem] text-left text-ink-2 bg-transparent border-none rounded-[var(--radius-sm)] cursor-pointer"
                  onClick={() => onPickHistory(item)}
                  title={item.q}
                >
                  <span
                    className={`history__mark history__mark--${item.tab} shrink-0 text-[0.62rem] font-bold tracking-[0.02em] py-[0.14rem] px-[0.36rem] rounded-[var(--radius-tag)]`}
                  >
                    {TAB_META[item.tab].mark}
                  </span>
                  <span className="history__q truncate text-[0.86rem]">{item.q}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="sidebar__footer shrink-0 flex flex-col items-start gap-[0.8rem] py-[0.9rem] px-[0.85rem] border-t border-line">
        <StatusBar />
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
    </aside>
  );
}
