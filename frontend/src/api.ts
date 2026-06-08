// API 型別定義與呼叫,對應後端 POST /ask 的契約。

export interface Source {
  content: string;
  source: string | null;
  distance: number;
}

export interface AskResponse {
  answer: string;
  sources: Source[];
}

export async function askQuestion(question: string): Promise<AskResponse> {
  const resp = await fetch("/api/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });

  if (!resp.ok) {
    let detail = `HTTP ${resp.status}`;
    try {
      const body = await resp.json();
      if (body?.detail) detail = body.detail;
    } catch {
      // 忽略解析失敗,沿用預設訊息
    }
    throw new Error(detail);
  }

  return (await resp.json()) as AskResponse;
}
