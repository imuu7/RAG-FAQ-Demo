"""FastAPI 應用:路由 + CORS + 啟動時 init_db()。"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import ollama_client
from db import get_conn, init_db
from rag import build_prompt, retrieve


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 啟動時建立 schema(此時 DB 已通過 healthcheck)
    init_db()
    yield


app = FastAPI(title="RAG FAQ Demo", lifespan=lifespan)

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
