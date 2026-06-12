export type Theme = "light" | "dark";

interface ThemeToggleProps {
  theme: Theme;
  onToggle: () => void;
}

export default function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const dark = theme === "dark";
  return (
    <button
      className="theme-toggle"
      onClick={onToggle}
      aria-label={dark ? "切換到亮色模式" : "切換到深色模式"}
      title={dark ? "切換到亮色模式" : "切換到深色模式"}
    >
      <span className="theme-toggle__icon">{dark ? "☀" : "☾"}</span>
      {dark ? "亮色" : "深色"}
    </button>
  );
}
