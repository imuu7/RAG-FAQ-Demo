# RAG 智慧問答全端 Demo(WSL2 + NVIDIA GPU)

一個小而完整、本地可一鍵跑起的全端 **RAG(檢索增強生成)** 問答應用。
使用者問問題 → 後端把問題轉成向量 → 用 pgvector 從 FAQ 文件庫找出語意最相近的段落 → 連同問題交給本地 LLM 生成答案 → 回傳「**答案 + 檢索到的來源段落與相似度分數**」。前端同時顯示答案與來源,證明這是真正的 RAG,而非單純聊天機器人。

語料為繁體中文企業 FAQ(特休遞延、加班費、報帳流程、停車場時間…)。

## 架構

```
┌─────────────┐      /api 代理      ┌──────────────┐
│  前端 React  │ ─────────────────▶ │ 後端 FastAPI  │
│  Vite (5173) │                    │   (8000)     │
└─────────────┘                    └───┬──────┬───┘
                                       │      │
                          embedding/   │      │  cosine 檢索
                          generate     │      │  <=>
                                       ▼      ▼
                            ┌──────────────┐ ┌────────────────────┐
                            │ Ollama (WSL) │ │ PostgreSQL+pgvector │
                            │  GPU 加速     │ │  docs(vector(1024)) │
                            │  11434       │ │      (5432)         │
                            └──────────────┘ └────────────────────┘
```

- 三個容器(`db` / `backend` / `frontend`)跑在 WSL2 的 Docker Engine 上。
- **Ollama 原生跑在 WSL2**(不在 compose 內),以 CUDA 吃 RTX 4070 SUPER 的 GPU。
- 容器透過 `host.docker.internal:11434` 連 Ollama(由 backend 的 `extra_hosts: host-gateway` 提供)。
- Ollama 必須綁 `OLLAMA_HOST=0.0.0.0`,否則只聽 127.0.0.1,容器連不到。

### 技術棧

| 層 | 選型 |
|---|---|
| 前端 | React + Vite + TypeScript |
| 後端 | Python FastAPI(自帶 `/docs` OpenAPI) |
| 資料庫 | PostgreSQL 16 + pgvector(`pgvector/pgvector:pg16`) |
| Embedding | Ollama `bge-m3`(1024 維,繁中檢索品質佳) |
| LLM 生成 | Ollama `qwen2.5:7b`(繁中佳,適合 12GB VRAM) |
| 編排 | Docker Compose |

### 資料模型

單一資料表 `docs(id, content, source, embedding vector(1024))`。檢索用餘弦距離運算子 `<=>`(`ORDER BY embedding <=> $query LIMIT k`,預設 k=4),距離越小越相近。`init_db()` 啟動時跑 `CREATE EXTENSION IF NOT EXISTS vector`。

### API 契約

- `POST /ask { "question": "..." }` → `{ "answer": "...", "sources": [{ "content", "source", "distance" }] }`
  pipeline:`embed(question)` → `retrieve()` → `build_prompt()` → `generate()`。
- `GET /health` → 回 DB 與 Ollama 連線狀態。

## 前置需求(WSL2 內)

```bash
nvidia-smi              # 應看到 RTX 4070 SUPER(約 12282 MiB)
ollama list             # 應有 bge-m3 與 qwen2.5:7b
# Ollama 須以 0.0.0.0 監聽(systemd 加 Environment="OLLAMA_HOST=0.0.0.0" 後 restart)
```

一次性拉模型(若尚未):

```bash
ollama pull bge-m3 && ollama pull qwen2.5:7b
```

> 程式碼務必放在 WSL 檔案系統(`~/rag-faq-demo`),不要放 `/mnt/...`(Windows 磁碟),否則 Vite HMR 與 Docker bind-mount 會嚴重變慢。

## 啟動步驟

```bash
# 1. 拉起整套(db → backend → frontend)
docker compose up --build          # 加 -d 可背景執行

# 2. 灌入示範 FAQ 語料(容器起來後)
docker compose exec backend python seed_data.py

# 3. 健康檢查
curl http://localhost:8000/health
```

開瀏覽器(Windows 可直接連,WSL2 會自動轉發 localhost):

- 前端:<http://localhost:5173>
- 後端 OpenAPI 文件:<http://localhost:8000/docs>

## 驗證 RAG 真的有效

關鍵驗收:問一個**用詞與原文不同**的問題,確認仍能撈到正確段落。

> 原文:「未休完的特休假可以遞延至次年度使用…」
> 提問:「沒休完的假會不見嗎?」

預期:SourcePanel 列出「員工手冊-請假」那條、距離合理,且答案正確並標註出處。

確認有吃 GPU(而非 CPU):

```bash
ollama ps   # PROCESSOR 欄應顯示 GPU
```

## 檢查 DB / pgvector

```bash
docker compose exec db psql -U rag -d ragdb
# 進到 psql 後:
\dx                       -- 確認 vector 擴充已安裝
\d docs                   -- 確認 embedding 欄為 vector(1024)
SELECT count(*) FROM docs;
\q
```

## 環境變數

複製 `.env.example` 成 `.env` 後依環境調整(`.env` 已被 `.gitignore` 排除)。主要變數:

| 變數 | 說明 |
|---|---|
| `DATABASE_URL` | 容器間用服務名 `db` 當 host;後端若原生在 WSL 跑改 `localhost` |
| `OLLAMA_HOST` | 容器內 `http://host.docker.internal:11434`;原生跑改 `http://localhost:11434` |
| `EMBED_MODEL` / `EMBEDDING_DIM` / `GEN_MODEL` | 預設 `bge-m3` / `1024` / `qwen2.5:7b`(改 embedding 模型須同步調整維度並重建 docs 表) |
| `VITE_PROXY_TARGET` | 前端 `/api` 代理目標;compose 內指向 `http://backend:8000` |

## 效能加分項(可選)

資料量大時線性掃描會變慢,可在 `docs.embedding` 上建 HNSW 近似最近鄰索引:

```sql
CREATE INDEX ON docs USING hnsw (embedding vector_cosine_ops);
```

並用 `EXPLAIN ANALYZE` 對比建索引前後的查詢計畫。
