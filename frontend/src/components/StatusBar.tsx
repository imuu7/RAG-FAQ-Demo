import { useEffect, useState } from "react";
import { checkHealth, type HealthResponse } from "../api";

/** 開機時打一次 /health,以指示燈顯示 DB / Ollama 是否在線,並標出使用的模型。 */
export default function StatusBar() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    checkHealth()
      .then((h) => alive && setHealth(h))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  const dotClass = (ok: boolean | undefined) => {
    if (failed) return "statusbar__dot--off";
    if (ok === undefined) return "statusbar__dot--wait";
    return ok ? "statusbar__dot--on" : "statusbar__dot--off";
  };

  const label = (ok: boolean | undefined) => {
    if (failed) return "離線";
    if (ok === undefined) return "連線中";
    return ok ? "在線" : "離線";
  };

  return (
    <div className="statusbar flex flex-wrap items-center gap-y-2 gap-x-[1.1rem] mt-6 py-[0.7rem] px-4 bg-surface border border-line rounded-[var(--radius)] shadow-[var(--shadow-sm)] text-[0.74rem]">
      <span className="statusbar__item inline-flex items-center gap-[0.45rem] text-ink-2 tracking-[0.03em]">
        <span className={`statusbar__dot ${dotClass(health?.db)}`} />
        pgvector {label(health?.db)}
      </span>
      <span className="statusbar__item inline-flex items-center gap-[0.45rem] text-ink-2 tracking-[0.03em]">
        <span className={`statusbar__dot ${dotClass(health?.ollama)}`} />
        Ollama {label(health?.ollama)}
      </span>
      <span className="statusbar__sep flex-1 min-w-0" />
      <span className="statusbar__tag text-ink-3 tracking-[0.04em]">
        嵌入 <b>bge-m3</b> · 生成 <b>qwen2.5:7b</b>
      </span>
    </div>
  );
}
