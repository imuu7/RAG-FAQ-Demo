// API 型別定義與呼叫,對應後端 /ask、/ask/stream、/compare 契約。

export interface Source {
  content: string;
  source: string | null;
  distance: number;
}

export interface AskResponse {
  answer: string;
  sources: Source[];
}

// 關鍵字搜尋結果不含 distance(純子字串比對,無相似度)
export interface KeywordSource {
  content: string;
  source: string | null;
}

export interface CompareResponse {
  keyword: KeywordSource[];
  semantic: Source[];
}

async function parseError(resp: Response): Promise<string> {
  let detail = `HTTP ${resp.status}`;
  try {
    const body = await resp.json();
    if (body?.detail) detail = body.detail;
  } catch {
    // 忽略解析失敗,沿用預設訊息
  }
  return detail;
}

export async function askQuestion(question: string): Promise<AskResponse> {
  const resp = await fetch("/api/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });

  if (!resp.ok) throw new Error(await parseError(resp));
  return (await resp.json()) as AskResponse;
}

export async function compareQuestion(
  question: string
): Promise<CompareResponse> {
  const resp = await fetch("/api/compare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });

  if (!resp.ok) throw new Error(await parseError(resp));
  return (await resp.json()) as CompareResponse;
}

interface StreamHandlers {
  onSources: (sources: Source[]) => void;
  onToken: (text: string) => void;
  onDone: () => void;
  onError: (detail: string) => void;
}

/**
 * 以 SSE 串流問答:先收到 sources 事件、再逐 token 收到答案。
 * 用 fetch + ReadableStream 手動解析 SSE(EventSource 不支援 POST)。
 */
export async function askQuestionStream(
  question: string,
  handlers: StreamHandlers
): Promise<void> {
  const resp = await fetch("/api/ask/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });

  if (!resp.ok || !resp.body) {
    handlers.onError(await parseError(resp));
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const dispatch = (rawEvent: string) => {
    let event = "message";
    const dataLines: string[] = [];
    for (const line of rawEvent.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    }
    if (dataLines.length === 0) return;
    const data = dataLines.join("\n");

    try {
      const parsed = JSON.parse(data);
      if (event === "sources") handlers.onSources(parsed.sources as Source[]);
      else if (event === "token") handlers.onToken(parsed.text as string);
      else if (event === "error") handlers.onError(parsed.detail as string);
      else if (event === "done") handlers.onDone();
    } catch {
      // 忽略無法解析的事件
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE 事件以空白行(\n\n)分隔
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const rawEvent = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      if (rawEvent.trim()) dispatch(rawEvent);
    }
  }
}
