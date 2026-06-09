"""灌入示範語料:游永慶的履歷與工作經歷,逐條算 embedding 後 INSERT。

把履歷切成細粒度片段(每筆一個重點,利於檢索),每筆 {content, source}。
可獨立執行:python seed_data.py
重跑前會先清空 docs,避免重複資料。
"""

from db import get_conn, init_db
from ollama_client import embed
from rag import _to_vector_literal

# 語料 = 履歷與工作經歷;source 為出處標籤,content 為原文片段
DOCS: list[dict] = [
    # 個人簡介
    {
        "source": "個人簡介",
        "content": "游永慶,全端工程師,約 5 年開發經驗。前端以 Angular(RxJS、TypeScript)為主力,擅長元件化架構、SPA 與響應式設計,同時具備紮實的後端與資料庫實戰。",
    },

    # 工作經歷 — 鼎漢國際(2022/8–2025/9,資訊分析師,實際擔任全端)
    {
        "source": "鼎漢國際 · 專案概述",
        "content": "在鼎漢國際工程顧問,獨立負責整個縣市政府標案的交通數據分析平台,從 Angular 前端、Python Flask API 到 PostgreSQL 資料庫,從需求到上線一手交付。",
    },
    {
        "source": "鼎漢國際 · 資料庫效能優化",
        "content": "設計 PostgreSQL 索引與資料分區(Partitioning)策略,處理數百台設備、每 5 秒一筆、保存 2 年、累積數十億筆的時序資料,將核心報表查詢從 900 秒優化至 60 秒,約提速 15 倍。",
    },
    {
        "source": "鼎漢國際 · Redis 快取",
        "content": "導入 Redis 作為快取與訊息佇列,降低熱點查詢對資料庫的負載,改善高併發情境下的 API 回應速度與服務穩定性。",
    },
    {
        "source": "鼎漢國際 · API 與推播",
        "content": "以 Python Flask(Service Layer 架構)打造 RESTful API,並串接 LINE Messaging API 做系統異常即時推播,讓團隊第一時間掌握異常。",
    },
    {
        "source": "鼎漢國際 · Docker 自動化部署",
        "content": "在 Proxmox 虛擬化環境用 Docker + Shell Script 建立自動化部署流程,將每次上線時間從 20 分鐘縮短到 2 分鐘,降低約 90% 並減少部署失誤。",
    },
    {
        "source": "鼎漢國際 · Angular 前端",
        "content": "以 Angular(元件化架構 + RxJS + TypeScript)開發分析平台前端,搭配 Lazy Loading 路由切分模組與按需載入,改善首屏載入速度與程式碼可維護性。",
    },

    # 工作經歷 — 福興數位(2025/9–2025/12,PHP 後端)
    {
        "source": "福興數位 · 概述",
        "content": "在福興數位以短期專案合作,負責 Laravel 後端 API 開發與多雲基礎設施維運。",
    },
    {
        "source": "福興數位 · 多雲 CDN",
        "content": "規劃並部署多雲 CDN 架構(AWS CloudFront、華為、騰訊),優化回源與快取規則,將源站流量降低約 95%。",
    },
    {
        "source": "福興數位 · 快取與佇列",
        "content": "導入 Redis 快取(含 TTL 過期策略)與 Laravel Queue 非同步處理,減輕資料庫負載並提升吞吐量。",
    },
    {
        "source": "福興數位 · Nginx 與資安",
        "content": "建置 Nginx 反向代理並導入 Cloudflare WAF、訪問控制與 HTTPS 憑證,完成域名/DNS 切換與線路遷移。",
    },

    # 工作經歷 — 向邑數位(2020/12–2022/1,專案開發)
    {
        "source": "向邑數位 · 前端接案",
        "content": "在向邑數位接案,最多同時並行約 4 個客戶專案。前端使用 Vue.js、React、Next.js、jQuery、Tailwind CSS,依需求快速切換技術棧並準時交付。",
    },
    {
        "source": "向邑數位 · 後端與爬蟲",
        "content": "以 Laravel 建構後端 API;用 Python 開發爬蟲蒐集 IG/Twitter、歷史股價、地籍與電商資料;串接 LINE Messaging API 開發 LineBot(Rich Menu、LIFF)。",
    },

    # 技術棧
    {
        "source": "技術棧 · 語言與前端",
        "content": "主力程式語言為 PHP、Python、TypeScript;前端以 Angular、RxJS 為主力,熟悉 Vue.js、React,曾用 Next.js、jQuery。",
    },
    {
        "source": "技術棧 · 後端與資料庫",
        "content": "後端框架 Laravel、Flask;資料庫主力 PostgreSQL、Redis、SQLAlchemy,熟悉 MySQL、MariaDB。",
    },
    {
        "source": "技術棧 · 雲端與部署",
        "content": "雲端與部署:Nginx、Docker、Docker Compose、Shell Script,接觸過 Proxmox、AWS CloudFront、Cloudflare、AWS S3。",
    },

    # 學歷
    {
        "source": "學歷",
        "content": "國立高雄第一科技大學 資訊管理學系 學士(2016–2020)。",
    },
]


def seed() -> None:
    # 確保表存在(若獨立執行而未經 backend 啟動)
    init_db()

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("TRUNCATE docs RESTART IDENTITY;")
        for i, doc in enumerate(DOCS, 1):
            vec = embed(doc["content"])
            cur.execute(
                "INSERT INTO docs (content, source, embedding) "
                "VALUES (%s, %s, %s::vector);",
                (doc["content"], doc["source"], _to_vector_literal(vec)),
            )
            print(f"  [{i}/{len(DOCS)}] 已灌入:{doc['source']}")
        conn.commit()

    print(f"完成,共灌入 {len(DOCS)} 筆履歷語料。")


if __name__ == "__main__":
    seed()
