"""FastAPI 應用:路由 + CORS + 啟動時 init_db()。"""

import json
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

import ollama_client
from db import get_conn, init_db
from rag import build_prompt, keyword_search, retrieve, retrieve_all


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 啟動時建立 schema(此時 DB 已通過 healthcheck)
    init_db()
    yield


app = FastAPI(title="與我的履歷對話 · RAG Demo", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AskRequest(BaseModel):
    question: str


class Source(BaseModel):
    content: str
    source: str | None = None
    distance: float


class AskResponse(BaseModel):
    answer: str
    sources: list[Source]


@app.post("/ask", response_model=AskResponse)
def ask(req: AskRequest) -> AskResponse:
    question = req.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="question 不可為空")

    # RAG pipeline:embed → retrieve → build_prompt → generate
    try:
        question_vec = ollama_client.embed(question)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Embedding 失敗:{e}")

    sources = retrieve(question_vec, k=4)
    prompt = build_prompt(question, sources)

    try:
        answer = ollama_client.generate(prompt)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"生成失敗:{e}")

    return AskResponse(answer=answer.strip(), sources=sources)


@app.post("/ask/stream")
async def ask_stream(req: AskRequest) -> StreamingResponse:
    """與 /ask 相同的 RAG 流程,但以 SSE 串流回傳:先送 sources,再逐 token 送答案。"""
    question = req.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="question 不可為空")

    # sources 在 retrieve 後就確定,可在串流答案前先送出
    try:
        question_vec = ollama_client.embed(question)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Embedding 失敗:{e}")

    sources = retrieve(question_vec, k=4)
    prompt = build_prompt(question, sources)

    def sse(event: str, data: dict | str) -> str:
        payload = data if isinstance(data, str) else json.dumps(data, ensure_ascii=False)
        return f"event: {event}\ndata: {payload}\n\n"

    async def event_stream():
        # 1) 先送來源,前端可立刻渲染 SourcePanel
        yield sse("sources", {"sources": sources})
        # 2) 逐 token 串答案
        try:
            async for token in ollama_client.generate_stream(prompt):
                yield sse("token", {"text": token})
        except Exception as e:
            yield sse("error", {"detail": f"生成失敗:{e}"})
            return
        # 3) 結束事件
        yield sse("done", {})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


class CompareSemanticSource(BaseModel):
    content: str
    source: str | None = None
    distance: float


class CompareKeywordSource(BaseModel):
    content: str
    source: str | None = None


class CompareResponse(BaseModel):
    keyword: list[CompareKeywordSource]
    semantic: list[CompareSemanticSource]


@app.post("/compare", response_model=CompareResponse)
def compare(req: AskRequest) -> CompareResponse:
    """同一問題並排比較關鍵字搜尋 vs 語意搜尋(不經 LLM,純檢索對照)。"""
    question = req.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="question 不可為空")

    keyword = keyword_search(question, k=4)

    try:
        question_vec = ollama_client.embed(question)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Embedding 失敗:{e}")
    semantic = retrieve(question_vec, k=4)

    return CompareResponse(keyword=keyword, semantic=semantic)


class GraphNode(BaseModel):
    id: int
    content: str
    source: str | None = None
    distance: float
    hit: bool  # 是否為本次 top-k 命中


class GraphResponse(BaseModel):
    question: str
    k: int
    nodes: list[GraphNode]


@app.post("/graph", response_model=GraphResponse)
def graph(req: AskRequest, k: int = 4) -> GraphResponse:
    """全語料語意地圖:回傳 query 對所有段落的餘弦距離,前 k 筆標記為命中(hit)。

    純檢索、不經 LLM;前端用來畫「Embedding 星圖」(query 置中、全語料放射)。
    """
    question = req.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="question 不可為空")

    try:
        question_vec = ollama_client.embed(question)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Embedding 失敗:{e}")

    rows = retrieve_all(question_vec)  # 已依距離排序,前 k 筆即命中
    nodes = [GraphNode(**row, hit=(i < k)) for i, row in enumerate(rows)]
    return GraphResponse(question=question, k=k, nodes=nodes)


@app.get("/health")
def health() -> dict:
    """確認 DB 與 Ollama 連線狀態(demo 時好用)。"""
    db_ok = False
    try:
        with get_conn() as conn, conn.cursor() as cur:
            cur.execute("SELECT 1;")
            cur.fetchone()
        db_ok = True
    except Exception:
        db_ok = False

    ollama_ok = ollama_client.ping()
    status = "ok" if (db_ok and ollama_ok) else "degraded"
    return {"status": status, "db": db_ok, "ollama": ollama_ok}
