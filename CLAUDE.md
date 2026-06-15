# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 溝通語言

使用繁體中文與我溝通，包含所有說明、回覆與程式碼註解。

## 遇到不確定時

遇到不確定的地方不要猜，請直接問我。

## 說明文件一律用 HTML 呈現

需要產出說明文件時，一律改用 HTML 檔（`.html`）呈現，不要用 Markdown（`.md`）等純文字格式。HTML 檔需可直接用瀏覽器開啟閱讀。此規則不適用於 `CLAUDE.md` 本身與既有 `.md` 檔。

## Current state

The full stack is **implemented and verified end-to-end** — all three containers build and run, the resume corpus seeds, and the acceptance tests pass. `BUILD_PROMPT.md` (Chinese) remains the original build spec, but the live code is now the source of truth; where the two diverge, the code wins (see *embedding model* note below). This is a git repo.

**Theme:** the project was retargeted from a generic enterprise-FAQ demo to **"與我的履歷對話"** — a RAG Q&A bot over 游永慶's résumé. Two showcase features were added on top of the base `/ask`: SSE streaming (`/ask/stream`) and keyword-vs-semantic search comparison (`/compare`).

**Spec vs. code divergence to know about:** the updated `BUILD_PROMPT.md` reverts the embedding model to `nomic-embed-text` (768-dim), but the code deliberately stays on `bge-m3` (1024-dim) per the user's explicit decision and the earlier zh-retrieval evaluation. Don't "fix" the code to match the spec on this point.

**Already provisioned on this machine (don't redo):** GPU (`nvidia-smi` → RTX 4070 SUPER, ~12282 MiB), both Ollama models pulled and Ollama listening on `0.0.0.0:11434`, Docker Engine + Compose running with the user in the `docker` group, and the spec's recommended skills installed (see *Local toolchain* below).

## Local toolchain (this machine)

- **Node is installed via nvm only** — `node`/`npm`/`npx` are **NOT on the default PATH**. Any shell that needs them (e.g. running `npx` to add/update skills) must first load nvm:
  ```bash
  export NVM_DIR="$HOME/.nvm" && \. "$NVM_DIR/nvm.sh" && nvm use default >/dev/null
  ```
  (The project itself doesn't need host Node — the frontend builds inside the `node:20` container. nvm Node is only for the host `npx`/skills tooling.)
- **skills.sh skills are installed globally** under `~/.agents/skills/`, symlinked into `~/.claude/skills/`. Install with `npx --yes skills@latest add <owner/repo> --skill <name> -g -y`. The `PromptScript ... does not support global skill installation` line in the output is for an unrelated agent target — Claude Code still gets the symlink, so it's harmless. Newly added skills only load on the **next** Claude Code session.
- Installed skills: `ollama` (Ollama/embeddings/RAG), `fastapi-python`, `vercel-react-best-practices`, `frontend-design`, `shadcn`, `tdd`.

## What this project is

A small but complete, locally-runnable full-stack **RAG (retrieval-augmented generation)** Q&A demo: **"與我的履歷對話"** — chat with 游永慶's résumé. Flow: user question → backend embeds it → pgvector cosine search over the **résumé corpus** → top-k passages + question handed to a local LLM → response returns **answer + retrieved source passages with similarity scores**. The frontend shows the answer *and* its sources, proving real retrieval rather than a plain chatbot. The seed corpus is Traditional-Chinese résumé/work-experience fragments (個人簡介 / 鼎漢國際 / 福興數位 / 向邑數位 / 技術棧 / 學歷).

The frontend is a **Claude-chat-style shell**: a left **Sidebar** (vertical nav for the three views + a `localStorage`-persisted 提問紀錄 history list) and a right **conversation area** (`ChatPane`, see *Layout* below). The three views are **問答** (streaming answer via SSE + SourcePanel), **搜尋對比** (side-by-side keyword vs. semantic retrieval, no LLM), and **Embedding 星圖** (force-directed view of the query vs. the whole corpus in embedding space, `react-force-graph-2d`).

### Visual design (dual theme, Liquid Glass)

One CSS-variable design system in `src/index.css` (BEM classes, no UI framework). Cards use **Liquid Glass** (frosted blur + edge highlight) whose intensity is theme-switched via `--glass-blur` / `--glass-hi` — same classes, different feel per theme. `ThemeToggle` writes `data-theme` on `<html>` (persisted to `localStorage`; FOUC guard in `index.html`); the UI labels the modes **亮色 / 暗色**.
- **暗色** — deep-space galaxy: pure-CSS animated nebula + parallax starfield (`GalaxyBackground`), nebula-purple/indigo palette.
- **亮色** — "晴空玻璃": sky-blue gradient backdrop reusing the *same* `GalaxyBackground` nebula as drifting color clouds (stars hidden) so the frosted glass has something to blur; high `saturate()` + glassmorphism shadows keep the glass legible on a light background. Indigo `#4f5bd5` primary × sky-blue `#4f8ad5` accent.

`GalaxyBackground` / `.galaxy` are internal code names for the background layer (used in both themes); the user-facing toggle never says "銀河". Theme also drives the 星圖 canvas palette — `EmbeddingGraph` switches its node colors on the `theme` prop, so changing a theme's primary/accent means updating that hard-coded color set too.

## Runtime architecture (the non-obvious parts)

Three Docker containers (`db`, `backend`, `frontend`) run inside **WSL2**, while **Ollama runs natively in WSL2 (not in Compose)** so it can use the host NVIDIA GPU via CUDA.

- **Containers reach Ollama via `http://host.docker.internal:11434`**, enabled by `extra_hosts: ["host.docker.internal:host-gateway"]` on the backend service. Ollama itself **must bind `OLLAMA_HOST=0.0.0.0`** (default 127.0.0.1 is unreachable from containers).
- If the backend is instead run natively in WSL (outside Compose), switch `OLLAMA_HOST` to `http://localhost:11434`.
- **Backend waits for DB health** before starting (`depends_on: db: condition: service_healthy`), so `init_db()` never races an unready Postgres.
- **Inter-container DB host is the service name `db`**, not localhost: `DATABASE_URL=postgresql://rag:ragpass@db:5432/ragdb`.
- **Code must live on the WSL filesystem** (`~/rag-faq-demo`), never under `/mnt/...` (Windows disk) — cross-filesystem kills Vite HMR and Docker bind-mount performance.

### Models (sized for 12GB VRAM)
- Embedding: `bge-m3` → **1024-dim** vectors (the `vector(1024)` column dimension is tied to this model; controlled by the `EMBEDDING_DIM` env var). Switched from the spec's original `nomic-embed-text` (768-dim) because its Traditional-Chinese semantic discrimination was too weak — it failed the key acceptance test (paraphrased query "沒休完的假會不見嗎?"). See `docs/issue-embedding-zh.html` for the full evaluation. Changing the embedding model means re-setting `EMBEDDING_DIM`, dropping & recreating `docs`, and re-seeding.
- Generation: `qwen2.5:7b` (good Traditional Chinese). Don't pick models that overflow 12GB into shared/CPU memory (e.g. 32b) or speed collapses.

### Data model
Single table `docs(id serial, content text, source text, embedding vector(1024))`. Retrieval uses cosine distance operator `<=>` (`ORDER BY embedding <=> $query LIMIT k`, default k=4); smaller distance = more similar. `init_db()` runs `CREATE EXTENSION IF NOT EXISTS vector` on startup. Optional perf win: HNSW index `CREATE INDEX ON docs USING hnsw (embedding vector_cosine_ops)`.

### Layout
`backend/` (FastAPI): `main.py` (routes `/ask`, `/ask/stream`, `/compare`, `/health` + CORS + `init_db()` on startup), `db.py` (connection + schema via `psycopg`), `rag.py` (`retrieve()`, `keyword_search()`, `build_prompt()`), `ollama_client.py` (`embed()` → `/api/embeddings`, `generate()` → `/api/generate`, `generate_stream()` → async NDJSON streaming), `seed_data.py` (standalone-runnable résumé corpus loader, `DOCS` list).
`frontend/` (React + Vite + TS): `src/App.tsx` (the `.shell` two-column layout, active-tab + streaming + theme + 提問紀錄 state, plus the local `ChatPane` wrapper; `runOnTab(q, tab)` dispatches a question to the matching tab handler and is reused for history re-run), `src/index.css` (single-file CSS-variable design system — see *Visual design* above), `src/api.ts` (`askQuestion()`, `askQuestionStream()` SSE, `compareQuestion()`, `fetchGraph()` + interfaces), `src/components/` — `Sidebar.tsx` (nav + history list + StatusBar/ThemeToggle footer; owns the `Tab`/`HistoryItem` types), `AskBox.tsx` (`placeholder` prop; send button is a paper-plane **icon inside `.askbox__field`**, bottom-right, disabled when empty), `SourcePanel.tsx`, `ComparePanel.tsx`, `EmbeddingGraph.tsx` (force-graph 星圖, theme-aware), `GalaxyBackground.tsx` (themed background layer), `ThemeToggle.tsx`, plus `ScoreBar` / `ExampleChips` / `StatusBar` / `SkeletonList` / `ErrorBoundary`. `vite.config.ts` proxies `/api` → `http://localhost:8000` and sets `host: true` (so a Windows browser can reach it).

**Layout (`ChatPane`, the non-obvious part):** the right column has two modes driven by a per-tab `active` flag (`asked` / `compareData||loading` / `graphAsked`). **Empty** = hero (h1/副標) + `AskBox` + `ExampleChips` vertically centered. **Active** = results scroll region on top + a bottom-docked composer (`AskBox` again — it's rendered in *both* modes, so submitting clears the typed text by remounting). 提問紀錄 persists to `localStorage` key `resume-chat-history` (dedup by q+tab, cap 30, newest-first); clicking an entry switches tab and re-runs via `runOnTab`. On screens < 860px the Sidebar collapses to a hamburger-driven drawer (`data-sidebar-open` on `.shell`).

Both Dockerfiles **COPY code into the image** (no bind-mounts in compose) — after editing `backend/` or `frontend/`, rebuild with `docker compose up -d --build backend frontend`.

### API contract
- `POST /ask {question}` → `{answer, sources: [{content, source, distance}]}`. Pipeline: `embed(question)` → `retrieve()` → `build_prompt()` → `generate()`. `build_prompt()` makes the LLM a "游永慶的履歷問答助手": answer **only from the provided résumé context, cite the source tag, and say「履歷未提及」if absent**.
- `POST /ask/stream {question}` → SSE (`text/event-stream`). Same pipeline as `/ask` but streamed: one `sources` event first (full JSON), then per-`token` events, then `done`; `error` event on failure. Backend uses `generate_stream()`; frontend parses SSE manually via `fetch` + `ReadableStream` (EventSource can't POST).
- `POST /compare {question}` → `{keyword: [{content, source}], semantic: [{content, source, distance}]}`. Retrieval-only, **no LLM**. Keyword path is per-character `ILIKE ANY` substring matching (Chinese has no word boundaries); semantic path reuses `retrieve()`.
- `GET /health` → DB and Ollama connectivity status.

## Common commands

Prerequisites (verify before running): `nvidia-smi` shows the RTX 4070 SUPER (~12282 MiB); `ollama list` shows both `bge-m3` and `qwen2.5:7b`; Ollama is listening on `0.0.0.0`.

```bash
# pull models (one-time, on WSL host)
ollama pull bge-m3 && ollama pull qwen2.5:7b

# bring up the full stack
docker compose up --build           # add -d to detach

# seed the résumé corpus (after containers are up)
docker compose exec backend python seed_data.py

# inspect DB / pgvector
docker compose exec db psql -U rag -d ragdb
#   \dx            -- confirm vector extension
#   \d docs        -- confirm embedding is vector(1024)
#   SELECT count(*) FROM docs;

# health check
curl http://localhost:8000/health
```

Frontend: `http://localhost:5173`. Backend OpenAPI docs: `http://localhost:8000/docs`.

## Verifying RAG actually works

The key acceptance test: ask a question whose **wording differs from the source text** (résumé says「將核心報表查詢從 900 秒優化至 60 秒」, ask「他有資料庫效能調校的經驗嗎?」) and confirm the correct passage (「鼎漢國際 · 資料庫效能優化」) is retrieved with a sensible distance and a correct answer. The 搜尋對比 tab is the clearest demo: ask wording-mismatched questions (「他會帶團隊嗎?」「做過雲端嗎?」) and watch keyword retrieval miss while semantic retrieval lands. Use `ollama ps` and check the **PROCESSOR column shows GPU** to confirm the GPU is actually used, not CPU.
