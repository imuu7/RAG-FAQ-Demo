export type Theme = "light" | "dark";

interface ThemeToggleProps {
  theme: Theme;
  onToggle: () => void;
}

export default function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const dark = theme === "dark";
  return (
    <button
      className="theme-toggle shrink-0 inline-flex items-center gap-[0.45rem] min-h-[44px] py-[0.4rem] px-[0.7rem] text-[0.72rem] tracking-[0.08em] text-ink-2 bg-surface border border-line-strong rounded-full cursor-pointer"
      onClick={onToggle}
      aria-label={dark ? "切換到亮色模式" : "切換到暗色模式"}
      title={dark ? "切換到亮色模式" : "切換到暗色模式"}
    >
      <span className="theme-toggle__icon text-[0.95rem] leading-none">{dark ? "☀" : "☾"}</span>
      {dark ? "亮色" : "暗色"}
    </button>
  );
}
