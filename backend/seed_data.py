"""灌入示範 FAQ 語料:逐條算 embedding 後 INSERT。

可獨立執行:python seed_data.py
重跑前會先清空 docs,避免重複資料。
"""

from db import get_conn, init_db
from ollama_client import embed
from rag import _to_vector_literal

# 10–20 條繁中 FAQ;source 為出處標籤,content 為原文
FAQS: list[dict] = [
    {
        "source": "員工手冊-請假",
        "content": "當年度未休完的特休假可以遞延至次年度使用,但需在次年度結束前休畢,逾期未休的部分公司將折算工資發給。",
    },
    {
        "source": "員工手冊-加班",
        "content": "平日加班前兩小時以時薪 1.34 倍計算,第三小時起以 1.67 倍計算;休息日加班另有更高倍率,實際以勞基法規定為準。",
    },
    {
        "source": "財務制度-報帳",
        "content": "報帳流程為:於差旅或採購後 14 天內,在報帳系統填寫單據並上傳發票,經主管簽核後送財務,財務審核通過約 7 個工作天內撥款至薪資帳戶。",
    },
    {
        "source": "行政公告-停車場",
        "content": "公司地下停車場開放時間為週一至週五上午 7 點至晚上 10 點,假日不開放。員工需申請車證並感應進出,訪客請於一樓櫃台登記。",
    },
    {
        "source": "員工手冊-到職",
        "content": "新進員工試用期為三個月,試用期間享有勞健保與特休按比例計算,試用期通過後年資自到職日起算。",
    },
    {
        "source": "資訊安全政策",
        "content": "公司筆電一律須開啟硬碟加密與螢幕鎖定,密碼至少 12 碼且每 90 天更換一次,嚴禁將公司機密資料上傳至個人雲端硬碟。",
    },
    {
        "source": "福利制度-健檢",
        "content": "公司每年提供一次免費健康檢查,滿 40 歲員工加做進階項目。健檢預約由人資統一發信,員工可於指定合作醫院自選時段。",
    },
    {
        "source": "員工手冊-遠距",
        "content": "全職員工每週最多可申請兩天遠距工作,需事先於系統提出並經主管核准;遠距期間仍須維持正常上線時間與即時回覆。",
    },
    {
        "source": "福利制度-年終",
        "content": "年終獎金依公司營運狀況與個人考績發放,通常於農曆年前一週隨一月薪資匯入,計算基準為本薪而非含津貼的月總額。",
    },
    {
        "source": "行政公告-會議室",
        "content": "會議室採線上系統預約,單次最長兩小時,逾時未報到 15 分鐘系統將自動釋出。大型會議室(可容納 20 人以上)需主管層級帳號才能預約。",
    },
    {
        "source": "員工手冊-離職",
        "content": "員工離職須於離職日前依年資提前提出書面申請:未滿一年提前十日、一年以上三年未滿提前二十日、三年以上提前三十日,並完成工作交接與資產歸還。",
    },
    {
        "source": "福利制度-教育訓練",
        "content": "公司提供每人每年最高三萬元的教育訓練補助,可用於與職務相關的課程或證照考試,需檢附完訓證明與收據向人資申請核銷。",
    },
    {
        "source": "行政公告-郵件收發",
        "content": "公司包裹與掛號信件由一樓收發室代收,到件後系統會發通知信,員工請於三個工作天內領取,逾期未領的私人包裹收發室不負保管責任。",
    },
    {
        "source": "員工手冊-病假",
        "content": "普通傷病假一年內未超過三十日部分,工資折半發給;住院傷病假與普通傷病假合計兩年內不得超過一年。請病假超過三日須檢附診斷證明。",
    },
    {
        "source": "資訊服務-帳號",
        "content": "忘記公司系統密碼可至內部 IT 服務入口自助重設,或撥打分機 8000 由 IT 協助;連續輸入錯誤五次帳號將鎖定 30 分鐘。",
    },
]


def seed() -> None:
    # 確保表存在(若獨立執行而未經 backend 啟動)
    init_db()

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("TRUNCATE docs RESTART IDENTITY;")
        for i, faq in enumerate(FAQS, 1):
            vec = embed(faq["content"])
            cur.execute(
                "INSERT INTO docs (content, source, embedding) "
                "VALUES (%s, %s, %s::vector);",
                (faq["content"], faq["source"], _to_vector_literal(vec)),
            )
            print(f"  [{i}/{len(FAQS)}] 已灌入:{faq['source']}")
        conn.commit()

    print(f"完成,共灌入 {len(FAQS)} 條 FAQ。")


if __name__ == "__main__":
    seed()
