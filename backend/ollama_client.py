"""Ollama 用戶端:呼叫本地 Ollama 的 embeddings 與 generate 端點。

OLLAMA_HOST 由環境變數讀取:
- 後端在容器內跑時,預設 http://host.docker.internal:11434
- 後端若改成原生在 WSL 跑,請設成 http://localhost:11434
"""

import os

import httpx

OLLAMA_HOST = os.environ.get(
    "OLLAMA_HOST", "http://host.docker.internal:11434"
).rstrip("/")

EMBED_MODEL = os.environ.get("EMBED_MODEL", "bge-m3")
GEN_MODEL = os.environ.get("GEN_MODEL", "qwen2.5:7b")

# 生成可能較慢(7b 模型),給寬鬆 timeout
_TIMEOUT = httpx.Timeout(120.0, connect=10.0)


def embed(text: str) -> list[float]:
    """把文字轉成向量(bge-m3 為 1024 維)。"""
    resp = httpx.post(
        f"{OLLAMA_HOST}/api/embeddings",
        json={"model": EMBED_MODEL, "prompt": text},
        timeout=_TIMEOUT,
    )
    resp.raise_for_status()
    return resp.json()["embedding"]


def generate(prompt: str) -> str:
    """以 LLM 生成答案(非串流,一次回傳完整字串)。"""
    resp = httpx.post(
        f"{OLLAMA_HOST}/api/generate",
        json={"model": GEN_MODEL, "prompt": prompt, "stream": False},
        timeout=_TIMEOUT,
    )
    resp.raise_for_status()
    return resp.json()["response"]


def ping() -> bool:
    """檢查 Ollama 是否連得到(供 /health 用)。"""
    try:
        resp = httpx.get(f"{OLLAMA_HOST}/api/tags", timeout=5.0)
        resp.raise_for_status()
        return True
    except Exception:
        return False
