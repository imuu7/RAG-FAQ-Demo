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


def retrieve_all(question_vec: list[float]) -> list[dict]:
    """回傳 query 對「全部」docs 的餘弦距離(不 LIMIT),依距離排序。

    供 /graph 畫全語料星雲;rows 已依距離排序,呼叫端取前 k 筆即本次命中。
    多回一個 id 當前端節點的唯一鍵。回傳 [{id, content, source, distance}, ...]。
    """
    vec_literal = _to_vector_literal(question_vec)
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, content, source, embedding <=> %s::vector AS distance
            FROM docs
            ORDER BY distance;
            """,
            (vec_literal,),
        )
        rows = cur.fetchall()

    return [
        {"id": id_, "content": content, "source": source, "distance": float(distance)}
        for (id_, content, source, distance) in rows
    ]


def keyword_search(question: str, k: int = 4) -> list[dict]:
    """傳統關鍵字搜尋:把問題拆成單字,用 ILIKE 任一比對(子字串)。

    繁中不需斷詞器,直接以單字做子字串比對最穩。回傳 [{content, source}, ...]。
    用於 /compare,與語意搜尋並排對照,凸顯「關鍵字撈不到、語意撈得到」。
    """
    # 取問題中的非空白字元當關鍵字(去重、保序),包成 %字%
    seen: set[str] = set()
    patterns: list[str] = []
    for ch in question:
        if ch.strip() and ch not in seen:
            seen.add(ch)
            patterns.append(f"%{ch}%")

    if not patterns:
        return []

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT content, source
            FROM docs
            WHERE content ILIKE ANY(%s)
            LIMIT %s;
            """,
            (patterns, k),
        )
        rows = cur.fetchall()

    return [{"content": content, "source": source} for (content, source) in rows]


def build_prompt(question: str, contexts: list[dict]) -> str:
    """把 top-k 履歷片段組成 context 區塊,指示 LLM 扮演履歷問答助手。"""
    context_block = "\n\n".join(
        f"[來源:{c['source']}]\n{c['content']}" for c in contexts
    )
    return f"""你是「游永慶的履歷問答助手」。請「只根據以下提供的履歷內容」,回答訪客關於游永慶技能與經歷的問題。

規則:
1. 只能依據履歷內容作答,不可自行臆測或補充履歷以外的內容。
2. 回答時請在句末標註你依據的來源標籤(例如:(來源:鼎漢國際 · 資料庫效能優化))。
3. 若履歷內容中找不到答案,請明確說「履歷未提及」,不要編造。
4. 使用繁體中文回答,語氣專業、簡潔。

===== 履歷內容開始 =====
{context_block}
===== 履歷內容結束 =====

訪客問題:{question}

請作答:"""
