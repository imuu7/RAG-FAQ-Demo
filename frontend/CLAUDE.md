# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> 範圍:`frontend/`(React + Vite + TypeScript)。跨領域脈絡(WSL2、整體架構、後端 API 契約)見 repo 根目錄的 `../CLAUDE.md`,此處不重複。註解與回覆一律繁體中文。

## 指令

```bash
# 重建 + 重啟前端容器(Dockerfile 把程式碼 COPY 進映像並 npm run build,改完一定要 build)
docker compose up -d --build frontend
```

容器是以 **`vite preview` 提供 build 後的靜態檔**(非 dev/HMR)——所以改動要重建容器才看得到。若要本機開發(host,需先載入 nvm 取得 node,見根 CLAUDE.md):`npm install` 後 `npm run dev`,並設 `VITE_PROXY_TARGET=http://localhost:8000`(預設值就是它)。

```bash
npm run build     # tsc 型別檢查 + vite build;build 會因任何型別錯誤而失敗(等同 lint gate)
npm run preview   # 本機預覽 build 結果
```

沒有測試套件、沒有獨立 ESLint。**型別檢查就是品質關卡**:`tsconfig.json` 開了 `strict` + `noUnusedLocals` + `noUnusedParameters`,未使用的變數/參數會讓 `npm run build` 失敗。

## 架構(需讀多檔才懂的點)

**所有後端呼叫集中在 `src/api.ts`**,元件不直接 `fetch`。一律打**相對路徑** `/api/*`,由 `vite.config.ts` 的 proxy(dev 與 preview 都設)轉到後端並 **rewrite 去掉 `/api` 前綴**;目標可由 `VITE_PROXY_TARGET` 覆寫(compose 內設為 `http://backend:8000`,因為容器內 `localhost` 是容器自己)。新增 API 呼叫請加在 `api.ts` 並輸出對應 interface。

**SSE 串流是手刻解析,不是 EventSource**:`askQuestionStream()` 用 `fetch` + `ReadableStream` 讀串流(因為 `EventSource` 不支援 POST)。解析方式:以 `\n\n` 切事件、逐行讀 `event:` / `data:`,再依事件型別(`sources`/`token`/`error`/`done`)回呼。對應後端 `/ask/stream` 的契約(先 sources 再逐 token),改其中一邊要兩邊一起改。

**狀態都在 `App.tsx`**,元件都是 presentational(props in)。兩個頁籤共用同一個 `loading`/`error`:
- `ask` 頁:串流——`onToken` 持續 append 到 `answer` 字串,`onDone`/`onError` 收尾;`asked` 旗標控制答案區是否出現;`loading` 時顯示閃爍游標。
- `compare` 頁:一次性 `compareQuestion()`,結果交給 `ComparePanel` 並排呈現(關鍵字側無 `distance`)。
- `AskBox` 以 `placeholder` prop 區分兩頁的提示語;Enter 送出、Shift+Enter 換行。

**樣式**:無 UI 框架、無 CSS-in-JS。全部集中在 `src/index.css`,class 採 BEM 風(`.block__element--modifier`)。改版面就改這支。

**入口**:`main.tsx` → `App.tsx`;`index.html` 的 `<title>` 也是履歷主題,改主題時別漏。
