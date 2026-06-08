"""資料庫連線與 schema 建立。

讀環境變數 DATABASE_URL,提供:
- get_conn():取得一條 psycopg 連線(呼叫端負責關閉,通常用 with)。
- init_db():啟動時建立 pgvector 擴充與 docs 表。
"""

import os

import psycopg

# 容器間以服務名 db 當 host(不是 localhost)
DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://rag:ragpass@db:5432/ragdb"
)

# docs 表的 embedding 維度,需與 EMBED_MODEL 對應:
# - bge-m3 → 1024 維(預設,繁中檢索品質較佳)
# - nomic-embed-text → 768 維
# 由環境變數 EMBEDDING_DIM 控制,改模型時一併調整並重建 docs 表。
EMBEDDING_DIM = int(os.environ.get("EMBEDDING_DIM", "1024"))


def get_conn() -> psycopg.Connection:
    """取得一條新的資料庫連線。"""
    return psycopg.connect(DATABASE_URL)


def init_db() -> None:
    """啟動時執行:啟用 vector 擴充並建立 docs 表(已存在則略過)。"""
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
        cur.execute(
            f"""
            CREATE TABLE IF NOT EXISTS docs (
              id        serial PRIMARY KEY,
              content   text NOT NULL,
              source    text,
              embedding vector({EMBEDDING_DIM})
            );
            """
        )
        conn.commit()
