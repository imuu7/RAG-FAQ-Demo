# Prompt:建構並部署「與我的履歷對話」RAG 問答機器人(B 案 — 全程 WSL2 + NVIDIA GPU)

> 用途:在 **WSL2(Ubuntu)** 裡、於 `~/rag-faq-demo` 開啟一個**全新 Claude Code session**,把以下整段內容貼進去即可從零建構並在本地(WSL)跑起整個專案。所有元件都跑在 WSL2,Ollama 透過 **NVIDIA RTX 4070 SUPER** 的 CUDA 加速。
>
> 硬體基準:**顯卡專用 VRAM 12GB**(模型大小對這個數字抓)、系統 RAM 32GB(同時跑容器與建置很充裕)。內容只談專案本身,不含任何面試/履歷脈絡。

---

## 一、目標

在 WSL2 的 `~/rag-faq-demo`(全新獨立資料夾,將作為新的 Git repo)建立一個**小而完整、本地可一鍵跑起**的全端 **「與我的履歷對話」問答機器人**:把「游永慶」的履歷與工作經歷做成語料,訪客(例如招募方)用自然語言詢問他的技能與經歷,系統以 RAG 撈出最相關的經歷片段、生成答案並附出處。

流程:使用者輸入問題 → 後端把問題轉成向量 → 用 pgvector 從**履歷語料庫**找出語意最相近的段落 → 連同問題交給本地 LLM 生成答案 → 回傳「**答案 + 檢索到的來源段落與相似度分數**」。前端顯示答案並列出來源,證明這是真正的 RAG,而非單純聊天機器人。

> 主題亮點:這個 demo 本身就是一份**互動式作品集**——招募方玩 demo 時,玩的就是「認識這個人」。語意搜尋的價值也很明顯:對方用自己的話問,履歷用不同詞寫,正好展示語意檢索勝過關鍵字。

## 二、技術棧

| 層 | 選型 | 備註 |
|---|---|---|
| 前端 | React + Vite + TypeScript | API 回應以 interface 定義型別 |
| 後端 | Python FastAPI | 自帶 OpenAPI 文件(`/docs`) |
| 資料庫 | PostgreSQL 16 + pgvector | 官方映像 `pgvector/pgvector:pg16` |
| Embedding | Ollama `nomic-embed-text`(768 維,約 0.3GB) | 本地、免費 |
| LLM 生成 | Ollama `qwen2.5:7b`(Q4 約 4.7GB) | 繁中佳;12GB VRAM 跑得順。想更省可改 `3b`,想更好品質可試 `14b`(約 9GB,較緊) |
| 編排 | Docker Compose | 在 WSL2 內的 Docker Engine 上跑 |
| 執行環境 | **WSL2(Ubuntu)** | 三個容器 + Ollama 全部跑在 WSL2,Ollama 吃 GPU |

**Ollama 跑法(B 案)**:**原生裝在 WSL2 Ubuntu 裡**(不是 Windows 主機、也不放進 compose),以 CUDA 用到 4070 SUPER 的 12GB VRAM。啟動時綁 `0.0.0.0`,容器再透過 `http://host.docker.internal:11434` 連它。
**模型大小準則**:對著 **12GB 專用 VRAM** 抓;別選會溢出到「共用記憶體/CPU」的大模型(如 32b),否則速度會崩。

## 三、WSL2 + GPU 環境前置(開工前先確認)

1. **Windows 端**裝最新 NVIDIA 顯卡驅動(目前 560.94 已支援 WSL CUDA)——它會把 CUDA 帶進 WSL,**WSL 內不要再裝任何 Linux 顯卡驅動**。
2. **WSL2 + Ubuntu**:`wsl --install`,或以 `wsl -l -v` 確認現有發行版是 **版本 2**。
3. **在 WSL 內驗證 GPU 已通**:執行 `nvidia-smi` 應列出 **RTX 4070 SUPER、約 12282 MiB**(看不到就先處理驅動,別往下做)。
4. **在 WSL 內裝 Docker Engine**(建議,純 Linux 環境最乾淨、與 Ollama 同一個發行版,網路最單純):
   `curl -fsSL https://get.docker.com | sh` → `sudo usermod -aG docker $USER` → 重開 shell。
   (也可用 Docker Desktop + WSL integration,但 Ollama 跨發行版的網路較麻煩,建議全部收在同一個 Ubuntu 內。)
5. **在 WSL 內裝 Ollama**:`curl -fsSL https://ollama.com/install.sh | sh`。
6. **讓 Ollama 對容器開放並 pull 模型**:
   - 以 `OLLAMA_HOST=0.0.0.0 ollama serve` 啟動;或 `sudo systemctl edit ollama` 加一行 `Environment="OLLAMA_HOST=0.0.0.0"` 後 `sudo systemctl restart ollama`。**沒綁 0.0.0.0 容器會連不到**(預設只聽 127.0.0.1)。
   - `ollama pull nomic-embed-text`
   - `ollama pull qwen2.5:7b`
   - `ollama list` 確認兩者都在。

## 四、專案結構

```
rag-faq-demo/                    # 放在 WSL 檔案系統(~/rag-faq-demo),不要放 /mnt/e
├─ docker-compose.yml          # postgres(pgvector) + backend + frontend
├─ README.md                   # 架構圖、啟動步驟、ollama 指令
├─ .env.example                # OLLAMA_HOST、DATABASE_URL 等
├─ .gitignore
├─ backend/
│  ├─ Dockerfile
│  ├─ requirements.txt         # fastapi, uvicorn, psycopg[binary], httpx, pydantic
│  ├─ main.py                  # FastAPI app + 路由 + CORS
│  ├─ db.py                    # 連線 + schema 建立(CREATE EXTENSION vector)
│  ├─ rag.py                   # retrieve()、build_prompt() 等核心邏輯
│  ├─ ollama_client.py         # 呼叫 Ollama /api/embeddings 與 /api/generate
│  └─ seed_data.py             # 灌入示範 FAQ + 算 embedding 入庫
└─ frontend/
   ├─ Dockerfile
   ├─ index.html
   ├─ vite.config.ts           # dev proxy 或 VITE_API_URL
   ├─ package.json
   └─ src/
      ├─ App.tsx               # 問答介面主元件
      ├─ api.ts                # fetch /ask + 型別定義
      └─ components/
         ├─ AskBox.tsx         # 輸入框 + 送出
         └─ SourcePanel.tsx    # 顯示檢索到的來源段落 + 距離分數
```

## 五、建構步驟

### 1. 資料庫 schema(`backend/db.py`)
連線用 `psycopg`(讀環境變數 `DATABASE_URL`),提供 `init_db()` 在啟動時執行:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS docs (
  id        serial PRIMARY KEY,
  content   text NOT NULL,
  source    text,                 -- 來源標籤(哪份文件/哪一條),供前端顯示出處
  embedding vector(768)           -- nomic-embed-text 維度
);
```

### 2. Ollama 用戶端(`backend/ollama_client.py`)
- `embed(text) -> list[float]`:`POST {OLLAMA_HOST}/api/embeddings`,body `{"model":"nomic-embed-text","prompt": text}`,回傳 `embedding`。
- `generate(prompt) -> str`:`POST {OLLAMA_HOST}/api/generate`,body `{"model":"qwen2.5:7b","prompt": prompt,"stream": false}`,回傳 `response`。
- `OLLAMA_HOST` 由環境變數讀取,容器內預設 `http://host.docker.internal:11434`(若後端改成原生在 WSL 跑,改用 `http://localhost:11434`)。

### 3. RAG 核心(`backend/rag.py`)
- `retrieve(question_vec, k=4)`:
  ```sql
  SELECT content, source, embedding <=> %s AS distance
  FROM docs ORDER BY distance LIMIT %s;
  ```
  (`<=>` = 餘弦距離,越小越相近)
- `build_prompt(question, contexts)`:把 top-k 履歷片段組成 context 區塊,指示 LLM **扮演「游永慶的履歷問答助手」,用繁體中文、只根據提供的履歷內容回答關於他技能與經歷的問題;履歷未提到的就說「履歷未提及」、不要編造**,並標註出處。

### 4. 後端路由(`backend/main.py`)
- 掛 `CORSMiddleware`,允許前端來源(`http://localhost:5173`)。
- `POST /ask { question }` → `embed(question)` → `retrieve()` → `build_prompt()` → `generate()` → 回傳:
  ```json
  { "answer": "...", "sources": [{"content":"...","source":"...","distance":0.12}] }
  ```
- `GET /health` → 確認 DB 與 Ollama 連線狀態(demo 時好用)。
- 啟動時呼叫 `init_db()`。

### 5. 示範語料(`backend/seed_data.py`)——語料 = 我的履歷與工作經歷

把履歷切成**細粒度片段**(每筆一個重點,利於檢索),每筆 `{content, source}`,逐筆 `embed()` 後 INSERT。可獨立執行 `python seed_data.py`。以下為**現成種子內容**(取自本人 `resume.html`,可直接用):

```python
DOCS = [
    # 個人簡介
    {"source": "個人簡介", "content": "游永慶,全端工程師,約 5 年開發經驗。前端以 Angular(RxJS、TypeScript)為主力,擅長元件化架構、SPA 與響應式設計,同時具備紮實的後端與資料庫實戰。"},

    # 工作經歷 — 鼎漢國際(2022/8–2025/9,資訊分析師,實際擔任全端)
    {"source": "鼎漢國際 · 專案概述", "content": "在鼎漢國際工程顧問,獨立負責整個縣市政府標案的交通數據分析平台,從 Angular 前端、Python Flask API 到 PostgreSQL 資料庫,從需求到上線一手交付。"},
    {"source": "鼎漢國際 · 資料庫效能優化", "content": "設計 PostgreSQL 索引與資料分區(Partitioning)策略,處理數百台設備、每 5 秒一筆、保存 2 年、累積數十億筆的時序資料,將核心報表查詢從 900 秒優化至 60 秒,約提速 15 倍。"},
    {"source": "鼎漢國際 · Redis 快取", "content": "導入 Redis 作為快取與訊息佇列,降低熱點查詢對資料庫的負載,改善高併發情境下的 API 回應速度與服務穩定性。"},
    {"source": "鼎漢國際 · API 與推播", "content": "以 Python Flask(Service Layer 架構)打造 RESTful API,並串接 LINE Messaging API 做系統異常即時推播,讓團隊第一時間掌握異常。"},
    {"source": "鼎漢國際 · Docker 自動化部署", "content": "在 Proxmox 虛擬化環境用 Docker + Shell Script 建立自動化部署流程,將每次上線時間從 20 分鐘縮短到 2 分鐘,降低約 90% 並減少部署失誤。"},
    {"source": "鼎漢國際 · Angular 前端", "content": "以 Angular(元件化架構 + RxJS + TypeScript)開發分析平台前端,搭配 Lazy Loading 路由切分模組與按需載入,改善首屏載入速度與程式碼可維護性。"},

    # 工作經歷 — 福興數位(2025/9–2025/12,PHP 後端)
    {"source": "福興數位 · 概述", "content": "在福興數位以短期專案合作,負責 Laravel 後端 API 開發與多雲基礎設施維運。"},
    {"source": "福興數位 · 多雲 CDN", "content": "規劃並部署多雲 CDN 架構(AWS CloudFront、華為、騰訊),優化回源與快取規則,將源站流量降低約 95%。"},
    {"source": "福興數位 · 快取與佇列", "content": "導入 Redis 快取(含 TTL 過期策略)與 Laravel Queue 非同步處理,減輕資料庫負載並提升吞吐量。"},
    {"source": "福興數位 · Nginx 與資安", "content": "建置 Nginx 反向代理並導入 Cloudflare WAF、訪問控制與 HTTPS 憑證,完成域名/DNS 切換與線路遷移。"},

    # 工作經歷 — 向邑數位(2020/12–2022/1,專案開發)
    {"source": "向邑數位 · 前端接案", "content": "在向邑數位接案,最多同時並行約 4 個客戶專案。前端使用 Vue.js、React、Next.js、jQuery、Tailwind CSS,依需求快速切換技術棧並準時交付。"},
    {"source": "向邑數位 · 後端與爬蟲", "content": "以 Laravel 建構後端 API;用 Python 開發爬蟲蒐集 IG/Twitter、歷史股價、地籍與電商資料;串接 LINE Messaging API 開發 LineBot(Rich Menu、LIFF)。"},

    # 技術棧
    {"source": "技術棧 · 語言與前端", "content": "主力程式語言為 PHP、Python、TypeScript;前端以 Angular、RxJS 為主力,熟悉 Vue.js、React,曾用 Next.js、jQuery。"},
    {"source": "技術棧 · 後端與資料庫", "content": "後端框架 Laravel、Flask;資料庫主力 PostgreSQL、Redis、SQLAlchemy,熟悉 MySQL、MariaDB。"},
    {"source": "技術棧 · 雲端與部署", "content": "雲端與部署:Nginx、Docker、Docker Compose、Shell Script,接觸過 Proxmox、AWS CloudFront、Cloudflare、AWS S3。"},

    # 學歷
    {"source": "學歷", "content": "國立高雄第一科技大學 資訊管理學系 學士(2016–2020)。"},
]
```
> 想擴充,可把 `interview-prep.html` 的問答重點(各專案細節、團隊協作經驗等)再加成更多片段。

### 6. 前端(`frontend/src/`)
- `api.ts`:定義 `AskResponse` interface(`answer`、`sources[]`),`askQuestion(question)` 以 `fetch` 打 `POST /ask`。
- `App.tsx`:輸入框送出 → 顯示 loading → 顯示答案 → 下方 `SourcePanel` 列出來源段落與 `distance`。
- `AskBox.tsx` / `SourcePanel.tsx`:拆成小元件,全程 TypeScript 型別。
- `vite.config.ts`:dev proxy `/api` → `http://localhost:8000`,並設 `host: true` 以便從 Windows 瀏覽器連入。

### 7. 容器化
- `backend/Dockerfile`:python:3.12-slim → 裝 requirements → `uvicorn main:app --host 0.0.0.0 --port 8000`。
- `frontend/Dockerfile`:node:20 build → 以 vite preview 或 nginx 提供靜態檔。
- `docker-compose.yml`:三個服務 `db`(`pgvector/pgvector:pg16`,掛 volume)、`backend`(依賴 db、傳入 `DATABASE_URL` 與 `OLLAMA_HOST`、**`extra_hosts: ["host.docker.internal:host-gateway"]`**)、`frontend`(對外 5173)。
  - `host-gateway` 在 WSL 的 Docker Engine 上同樣有效,容器即可用 `host.docker.internal:11434` 連到 WSL 主機上的 Ollama。
- `.env.example` 列出所有環境變數;`.gitignore` 排除 `.env`、`node_modules`、`__pycache__`。

### 8. PostgreSQL + pgvector 部署(容器,展開細節)

PostgreSQL 以**容器**部署(與整套架構一致,不在 WSL 原生安裝)。用 `pgvector/pgvector:pg16` 映像——它在官方 Postgres 上**已預先編好 pgvector 擴充**,你只要在 `init_db()` 跑 `CREATE EXTENSION IF NOT EXISTS vector;` 即可啟用,不必自己編譯。

**`docker-compose.yml` 的 `db` 服務:**
```yaml
db:
  image: pgvector/pgvector:pg16
  environment:
    POSTGRES_USER: rag
    POSTGRES_PASSWORD: ragpass
    POSTGRES_DB: ragdb
  ports:
    - "5432:5432"          # 方便用 psql/DBeaver 連入除錯;不需對外可拿掉
  volumes:
    - pgdata:/var/lib/postgresql/data   # 資料持久化,重啟不掉
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U rag -d ragdb"]
    interval: 5s
    timeout: 3s
    retries: 10
```
檔案最後加上具名 volume:
```yaml
volumes:
  pgdata:
```

**`backend` 服務要等 DB 健康再啟動**(避免一起來時 DB 還沒就緒):
```yaml
backend:
  depends_on:
    db:
      condition: service_healthy
  environment:
    DATABASE_URL: postgresql://rag:ragpass@db:5432/ragdb
    OLLAMA_HOST: http://host.docker.internal:11434
  extra_hosts:
    - "host.docker.internal:host-gateway"
```

**連線字串(`DATABASE_URL`)**:`postgresql://rag:ragpass@db:5432/ragdb`——容器間用**服務名 `db`** 當 host(不是 localhost)。

**部署順序**:`docker compose up -d --build` → DB 先起、跑 `pg_isready` 健康檢查 → backend 等到健康才啟動 → 啟動時 `init_db()` 建 `vector` 擴充與 `docs` 表 → 再跑 seed。

**驗證 PostgreSQL + pgvector 正常**:
```bash
docker compose exec db psql -U rag -d ragdb
# 進到 psql 後:
\dx                 -- 應看到 vector 擴充已安裝
\d docs             -- 應看到 docs 表,embedding 欄型別為 vector(768)
SELECT count(*) FROM docs;
\q
```
> 機密提醒:`POSTGRES_PASSWORD` 這類值正式上應放 `.env`(已被 `.gitignore` 排除),範例值僅供本地。

### 9. 進階展示功能 A:關鍵字 vs 語意搜尋對比(最能證明 RAG 價值)

目的:同一個問題,並排呈現**傳統關鍵字搜尋** vs **pgvector 語意搜尋**,讓訪客一眼看到「語意撈得到、關鍵字撈不到」。

**後端**:新增 `POST /compare { question }`,回傳兩組檢索結果(**不經 LLM,純比較**):
```python
# 關鍵字搜尋:把問題拆成詞,用 ILIKE 任一比對(繁中不需斷詞器,子字串比對最穩)
#   SELECT content, source FROM docs
#   WHERE content ILIKE ANY(%s)        -- %s = ['%詞1%','%詞2%', ...]
#   LIMIT 4;
# 語意搜尋:沿用 retrieve(),embedding <=> 問題向量 ORDER BY distance LIMIT 4
```
回傳:
```json
{
  "keyword":  [{"source": "...", "content": "..."}],
  "semantic": [{"source": "...", "content": "...", "distance": 0.12}]
}
```
**前端**:一個「搜尋對比」頁籤(或並排兩欄,左=關鍵字、右=語意),同一問題同時送。**示範問句**:問「**他會帶團隊嗎?**」「**做過雲端嗎?**」這種用詞跟履歷不同的問題——關鍵字欄常常空白或不相關,語意欄正確撈出對應經歷。

> 為什麼用 `ILIKE` 而非全文檢索:繁中要做 `to_tsvector` 需斷詞器(如 pg_jieba),週末版用 `ILIKE` 子字串比對即可,而且「關鍵字撈不到、語意撈得到」的對比反而更鮮明。

### 10. 進階展示功能 B:串流回答(逐字輸出,體感像 ChatGPT)

目的:答案逐字浮現,而非等整段生成完才出現。

**後端**:新增 `POST /ask/stream`,流程同 `/ask`,但把生成段改成串流:
```python
# 1) 先 embed + retrieve 取得 sources(串流前就已確定)
# 2) 呼叫 Ollama generate 時 body 加 "stream": true,
#    用 httpx.AsyncClient.stream 逐行讀 NDJSON,取每行的 "response" 增量
# 3) 以 FastAPI StreamingResponse(media_type="text/event-stream")回傳 SSE:
#    先送一筆 sources 事件(整包 JSON)→ 再逐 token 送 → 最後送 done
```
要點:`sources` 在 retrieve 後就確定,**先送 sources、再串答案 token**,前端可立刻顯示來源、答案再逐字補上。

**前端**:用 `fetch` + `ReadableStream`(或 `EventSource`)讀 SSE——收到 `sources` 先渲染 SourcePanel,收到 `token` 就 append 到答案區。保留原本非串流的 `/ask` 當 fallback。

> Ollama 串流格式:`/api/generate` 設 `"stream": true` 時回傳多行 JSON,每行有 `response`(該段文字)與 `done`(布林)。後端把這些 `response` 轉發即可。

## ★ WSL 三大注意事項(務必遵守)

1. **程式碼放 WSL 檔案系統**(`~/rag-faq-demo`),**不要**放在 `/mnt/e/...`(Windows 磁碟)。跨檔案系統會讓 Vite HMR 與 Docker bind-mount 嚴重變慢。
2. **Ollama 一定要綁 `OLLAMA_HOST=0.0.0.0`**,否則只聽 127.0.0.1,容器內連不到。
3. **容器連 Ollama 走 `host.docker.internal:11434`**,搭配 compose 的 `extra_hosts: host.docker.internal:host-gateway`(Linux Docker Engine 也支援)。

## 六、啟動與部署

### 本地啟動(在 WSL 內)
1. 確認:`nvidia-smi` 看得到 4070 SUPER(約 12282 MiB)、`ollama list` 有兩個模型、Ollama 以 `0.0.0.0` 監聽。
2. 在 `~/rag-faq-demo` 內 `docker compose up --build`,等三個容器起來。
3. 灌資料:`docker compose exec backend python seed_data.py`。
4. 開瀏覽器(Windows 直接連即可,WSL2 會自動把 localhost 轉發):前端 `http://localhost:5173`、後端文件 `http://localhost:8000/docs`。

### 部署成可點網址(之後再補,非核心)
Ollama 為本地 GPU 服務,雲端部署較重。兩條路:
- **① 帶 GPU 的雲主機**:租一台有 NVIDIA GPU 的雲主機,裝 Ollama + pull 模型,整套 `docker compose up`。
- **② 換雲端 LLM 再部署**:把 `ollama_client.py` 抽換成雲端 API(embedding + generation),前後端部署到 Render/Railway,DB 用託管 Postgres(需支援 pgvector)。
先以本地能展示為主,部署列為後續。

## 七、效能加分項(可選)
資料量大時「跟每筆比距離」會變慢(等同無索引的全表掃描)。在 `docs.embedding` 上建 **HNSW 向量索引**,把線性掃描變成近似最近鄰查詢:
```sql
CREATE INDEX ON docs USING hnsw (embedding vector_cosine_ops);
```
並用 `EXPLAIN ANALYZE` 對比建索引前後的查詢計畫,把結果記進 README,展示對向量檢索效能優化的理解。

## 八、建議的技能(兩類,別混淆)

本專案會用到**兩種不同的「技能」**:A 類是 [skills.sh](https://www.skills.sh) 的外掛、要 `npx` 安裝,注入框架最佳實踐以**提升產出程式碼品質**;B 類是 Claude Code 內建的工作流程技能、以 `/技能名` 呼叫,負責**跑/驗/審**。

### A. 框架知識技能(skills.sh,需 `npx` 安裝)

精選 3 個對應三大支柱即可,別貪多(技能會佔 context):

| 技能 | 來源代號 | 對上 |
|---|---|---|
| **ollama** ★最貼題 | `@balloob/llm-skills/ollama` | Ollama 連線、embeddings、RAG、streaming、連線除錯 |
| **fastapi-python** | `mindrally/skills`(skill `fastapi-python`) | 後端 FastAPI async 最佳實踐 |
| **React 最佳實踐** | 約 `vercel-labs/agent-skills`(名稱以 `npx skills find react` 確認) | 前端 React 模式 |

可選:`frontend-design`(anthropics,UI 設計)、`shadcn`(UI 元件)、`supabase-postgres-best-practices`(`supabase/agent-skills`,PG 優化——但 Postgres 本就是強項,非必裝)。

> 安裝指令以各技能在 skills.sh 的頁面顯示為準(慣例 `npx skillsadd <owner/repo>`,vercel 工具為 `npx skills add <repo> --skill <name>`),CLI 版本不一,直接複製最保險。skills.sh 上**沒有** Docker / WSL / 獨立 RAG 的專屬技能(RAG 已涵蓋在 ollama 技能裡)。

### B. 工作流程技能(Claude Code 內建,以 `/技能名` 呼叫)

| 技能 | 用途 | 必要性 |
|---|---|---|
| `/run` | 把整套 compose 拉起、開前端,確認服務真的跑起來 | 核心 |
| `/verify` | 端到端實測 RAG(問非原文用詞 → 撈對段落 → 附出處;`ollama ps` 確認有吃 GPU) | 核心 |
| `/fewer-permission-prompts` | 掃常用唯讀指令加 allowlist,減少 docker/pip/npm 反覆跳權限詢問 | 強烈建議 |
| `/code-review` | 一次審前端 TS + 後端 Python 的 diff | 強烈建議 |
| `/security-review` | 對外部署前審 API、CORS、DB 連線、`.env` 機密 | 視情況(部署階段) |
| `/init` | 新 repo 收尾產 `CLAUDE.md`,記錄結構與啟動方式 | 視情況(可選) |

> 寫 React / FastAPI / pgvector 的**程式碼本身不需要任何技能**(Claude 直接寫);框架由 build 步驟的 `pip` / `npm` 安裝。

## 九、完成驗收(end-to-end)

1. WSL 內 `nvidia-smi` 列出 **RTX 4070 SUPER(約 12282 MiB)**。
2. `ollama list` 顯示 `nomic-embed-text` 與 `qwen2.5:7b`;問一題後 `ollama ps` 的 **PROCESSOR 欄顯示 GPU**(代表確實用到顯卡,而非 CPU)。
3. `docker compose up --build` 後三個容器正常運作;`curl http://localhost:8000/health` 回 DB 與 Ollama 皆 OK。
4. `docker compose exec backend python seed_data.py` 後,`SELECT count(*) FROM docs` 有資料且 `embedding` 非空。
5. 前端問一個**招募方式、用詞與原文不同**的問題(例:履歷寫「將報表查詢從 900 秒優化至 60 秒」,問「他有資料庫效能調校的經驗嗎?」)→ 撈出該段經歷、生成正確答案,SourcePanel 顯示來源(如「鼎漢國際 · 資料庫效能優化」)與距離分數。
6.(加分項)psql 跑 `EXPLAIN ANALYZE SELECT ... ORDER BY embedding <=> ...`,對比建 HNSW 索引前後的執行計畫。
