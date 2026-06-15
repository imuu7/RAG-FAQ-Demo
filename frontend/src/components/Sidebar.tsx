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
    <aside className="sidebar">
      <div className="sidebar__brand">
        <b>游永慶</b> · RÉSUMÉ ARCHIVE
      </div>

      <nav className="sidenav">
        {TAB_ORDER.map((t) => (
          <button
            key={t}
            className={`sidenav__btn ${tab === t ? "sidenav__btn--active" : ""}`}
            onClick={() => onSelectTab(t)}
          >
            {TAB_META[t].label}
          </button>
        ))}
      </nav>

      <div className="sidebar__history">
        <div className="sidebar__history-head">
          <p className="eyebrow" style={{ margin: 0 }}>
            提問紀錄
          </p>
          {history.length > 0 && (
            <button className="sidebar__clear" onClick={onClearHistory}>
              清除
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <p className="sidebar__empty">尚無提問紀錄</p>
        ) : (
          <ul className="history">
            {history.map((item) => (
              <li key={`${item.tab}-${item.ts}`}>
                <button
                  className="history__item"
                  onClick={() => onPickHistory(item)}
                  title={item.q}
                >
                  <span
                    className={`history__mark history__mark--${item.tab}`}
                  >
                    {TAB_META[item.tab].mark}
                  </span>
                  <span className="history__q">{item.q}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="sidebar__footer">
        <StatusBar />
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
    </aside>
  );
}
