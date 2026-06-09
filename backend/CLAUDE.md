# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> 範圍:`backend/`(FastAPI)。跨領域脈絡(WSL2、Ollama 原生跑在 host 吃 GPU、embedding 維持 `bge-m3`/1024 而非 spec 的 nomic、整體啟動流程)見 repo 根目錄的 `../CLAUDE.md`,此處不重複。註解與回覆一律繁體中文。

## 指令

```bash
# 重建 + 重啟後端容器(Dockerfile 是 COPY 程式碼進映像、無 bind-mount,改完一定要 build)
docker compose up -d --build backend

# 灌入履歷語料(會先 TRUNCATE docs,可重複執行)
docker compose exec backend python seed_data.py

# 看後端日誌 / 進容器
docker compose logs -f backend
docker compose exec backend sh

# 健康檢查與手測路由
curl http://localhost:8000/health
curl -s -X POST http://localhost:8000/ask -H 'Content-Type: application/json' -d '{"question":"他有資料庫效能調校的經驗嗎?"}'
curl -s -N -X POST http://localhost:8000/ask/stream -H 'Content-Type: application/json' -d '{"question":"..."}'   # -N 不緩衝,才看得到 SSE 逐筆
```

沒有測試套件、沒有 linter。要原生(非容器)跑後端時,需設 `OLLAMA_HOST=http://localhost:11434` 與 `DATABASE_URL=...@localhost:5432/...`(容器內預設的 `db` / `host.docker.internal` 在 host 上無效),再 `uvicorn main:app --reload`。

## 架構(需讀多檔才懂的點)

**模組職責**:`main.py` 路由與 SSE 組裝 → `rag.py` 檢索與組 prompt → `ollama_client.py` 呼叫 Ollama → `db.py` 連線與建表。`seed_data.py` 為獨立可執行的語料載入器。

**向量不經 pgvector adapter**:`rag._to_vector_literal()` 把 `list[float]` 轉成 `"[0.1,0.2,...]"` 字串,再以 `%s::vector` 帶入 SQL。因此 `seed_data.py` 會 import 這個底線開頭的「私有」函式——這是刻意共用,不要為了「封裝」而改掉,否則得另裝 pgvector 的 psycopg 型別轉接器。

**schema 由環境變數決定維度**:`db.init_db()` 用 `EMBEDDING_DIM`(預設 1024)建 `docs.embedding vector(N)`。`EMBEDDING_DIM` 必須與 `EMBED_MODEL`(`ollama_client`)對應。換 embedding 模型 = 改這兩個 env + DROP/重建 `docs` + 重新 seed,否則維度不符會插入失敗。

**`init_db()` 在兩處呼叫**:app 啟動的 lifespan、以及 `seed_data.seed()` 開頭——後者讓「容器從沒正常啟動過」時也能單獨 seed 把表建起來。它只 `CREATE ... IF NOT EXISTS`,不會動既有資料。

**同步 vs 非同步**:`embed()` / `generate()` 是同步 `httpx`(`/ask`、`/compare` 用同步 `def`,FastAPI 自動丟 threadpool)。`generate_stream()` 是 async generator(`httpx.AsyncClient.stream` 逐行讀 Ollama NDJSON),只給 async 的 `/ask/stream` 用。新增串流相關邏輯走 async 那條。

**SSE 契約(`/ask/stream`)**:`main.sse(event, data)` 產生 `event: <type>\ndata: <json>\n\n`。事件順序:先 `sources`(整包 sources)→ 多筆 `token`(`{text}`)→ `done`;生成例外則送 `error`(`{detail}`)後結束。`sources` 在串流前就由 `retrieve()` 算好,所以前端能先渲染來源、答案再逐字補上。回應帶 `X-Accel-Buffering: no` 避免反向代理緩衝。

**`/compare` 不經 LLM**:純檢索對照。`rag.keyword_search()` 把問題**逐字**包成 `%字%` 再 `WHERE content ILIKE ANY(%s)`(繁中無詞界,逐字子字串比對最穩);語意側沿用 `retrieve()`。回傳兩組結果型別不同(關鍵字無 `distance`)。

**Prompt 角色**:`rag.build_prompt()` 把 LLM 設定為「游永慶的履歷問答助手」,只依提供的履歷片段作答、句末標來源標籤、查無則回「履歷未提及」。改語料主題時這裡要一起改。

**設定來源**:所有連線參數都讀環境變數且帶「容器內預設值」(`DATABASE_URL` 指向服務名 `db`、`OLLAMA_HOST` 指向 `host.docker.internal`),由 `docker-compose.yml` 注入。CORS 只放行 `http://localhost:5173` / `127.0.0.1:5173`。
