# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 溝通語言

使用繁體中文與我溝通，包含所有說明、回覆與程式碼註解。

## 遇到不確定時

遇到不確定的地方不要猜，請直接問我。

## 說明文件一律用 HTML 呈現

需要產出說明文件時，一律改用 HTML 檔（`.html`）呈現，不要用 Markdown（`.md`）等純文字格式。HTML 檔需可直接用瀏覽器開啟閱讀。此規則不適用於 `CLAUDE.md` 本身與既有 `.md` 檔。

## Current state

This repo currently contains **only the build spec** (`BUILD_PROMPT.md`, written in Chinese). None of the application code described below exists yet — it must be generated from that spec. When implementing, treat `BUILD_PROMPT.md` as the source of truth for structure, schema, and acceptance criteria. This is not yet a git repo (`git init` will be needed).

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

A small but complete, locally-runnable full-stack **RAG (retrieval-augmented generation)** Q&A demo. Flow: user question → backend embeds it → pgvector cosine search over a FAQ corpus → top-k passages + question handed to a local LLM → response returns **answer + retrieved source passages with similarity scores**. The frontend shows the answer *and* its sources, proving real retrieval rather than a plain chatbot. The seed corpus is Traditional-Chinese FAQ content.

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

### Layout (target)
`backend/` (FastAPI): `main.py` (routes + CORS + `init_db()` on startup), `db.py` (connection + schema via `psycopg`), `rag.py` (`retrieve()`, `build_prompt()`), `ollama_client.py` (`embed()` → `/api/embeddings`, `generate()` → `/api/generate`), `seed_data.py` (standalone-runnable corpus loader).
`frontend/` (React + Vite + TS): `src/App.tsx`, `src/api.ts` (`AskResponse` interface, `askQuestion()`), `src/components/AskBox.tsx`, `src/components/SourcePanel.tsx`. `vite.config.ts` proxies `/api` → `http://localhost:8000` and sets `host: true` (so a Windows browser can reach it).

### API contract
- `POST /ask {question}` → `{answer, sources: [{content, source, distance}]}`. Pipeline: `embed(question)` → `retrieve()` → `build_prompt()` → `generate()`. `build_prompt()` must instruct the LLM to answer **only from provided context, cite the source, and say it doesn't know if absent**.
- `GET /health` → DB and Ollama connectivity status.

## Common commands

Prerequisites (verify before running): `nvidia-smi` shows the RTX 4070 SUPER (~12282 MiB); `ollama list` shows both `bge-m3` and `qwen2.5:7b`; Ollama is listening on `0.0.0.0`.

```bash
# pull models (one-time, on WSL host)
ollama pull bge-m3 && ollama pull qwen2.5:7b

# bring up the full stack
docker compose up --build           # add -d to detach

# seed the FAQ corpus (after containers are up)
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

The key acceptance test: ask a question whose **wording differs from the source text** (spec example — source says "特休假可遞延", ask "沒休完的假會不見嗎?") and confirm the correct passage is retrieved with a sensible distance and a correct answer. Use `ollama ps` and check the **PROCESSOR column shows GPU** to confirm the GPU is actually used, not CPU.
