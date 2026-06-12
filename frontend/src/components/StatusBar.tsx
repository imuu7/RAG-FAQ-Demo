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
    <div className="statusbar">
      <span className="statusbar__item">
        <span className={`statusbar__dot ${dotClass(health?.db)}`} />
        pgvector {label(health?.db)}
      </span>
      <span className="statusbar__item">
        <span className={`statusbar__dot ${dotClass(health?.ollama)}`} />
        Ollama {label(health?.ollama)}
      </span>
      <span className="statusbar__sep" />
      <span className="statusbar__tag">
        嵌入 <b>bge-m3</b> · 生成 <b>qwen2.5:7b</b>
      </span>
    </div>
  );
}
