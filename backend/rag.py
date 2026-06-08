"""RAG 核心邏輯:向量檢索 + 組 prompt。"""

from db import get_conn


def _to_vector_literal(vec: list[float]) -> str:
    """把 Python list 轉成 pgvector 可接受的字串字面值,如 '[0.1,0.2,...]'。

    這樣就不必額外安裝 pgvector 的 psycopg adapter,直接以 %s::vector 帶入。
    """
    return "[" + ",".join(str(x) for x in vec) + "]"


def retrieve(question_vec: list[float], k: int = 4) -> list[dict]:
    """以餘弦距離(<=>,越小越相近)取出最相關的 top-k 段落。

    回傳 [{content, source, distance}, ...]。
    """
    vec_literal = _to_vector_literal(question_vec)
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT content, source, embedding <=> %s::vector AS distance
            FROM docs
            ORDER BY distance
            LIMIT %s;
            """,
            (vec_literal, k),
        )
        rows = cur.fetchall()

    return [
        {"content": content, "source": source, "distance": float(distance)}
        for (content, source, distance) in rows
    ]


def build_prompt(question: str, contexts: list[dict]) -> str:
    """把 top-k 原文組成 context 區塊,指示 LLM 只依提供內容作答並標註出處。"""
    context_block = "\n\n".join(
        f"[來源:{c['source']}]\n{c['content']}" for c in contexts
    )
    return f"""你是一個企業內部 FAQ 客服助理。請「只根據以下提供的參考資料」回答使用者問題。

規則:
1. 只能依據參考資料作答,不可自行臆測或補充資料以外的內容。
2. 回答時請在句末標註你依據的來源標籤(例如:(來源:員工手冊))。
3. 若參考資料中找不到答案,請明確說「根據現有資料,我無法回答這個問題」,不要編造。
4. 使用繁體中文回答。

===== 參考資料開始 =====
{context_block}
===== 參考資料結束 =====

使用者問題:{question}

請作答:"""
