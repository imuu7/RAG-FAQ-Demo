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

**版面是 Claude-chat 式 `.shell`**:左 `Sidebar`(三分頁垂直導覽 + 提問紀錄)+ 右對話區。對話區由本地小元件 `ChatPane` 切兩種版型——未提問時 hero/輸入框/範例垂直置中;提問後結果區上方捲動、`AskBox` 貼底(兩種版型各渲染一份 `AskBox`,送出即重掛=清空輸入)。`active` 旗標決定切換(`asked` / `compareData||loading` / `graphAsked`)。窄螢幕(<860px)Sidebar 轉抽屜,靠 `.shell` 上的 `data-sidebar-open` 控制。

**狀態都在 `App.tsx`**,元件都是 presentational(props in)。三分頁共用同一個 `loading`/`error`(星圖另有 `graphLoading`):
- `ask` 頁:串流——`onToken` 持續 append 到 `answer` 字串,`onDone`/`onError` 收尾;`asked` 旗標控制答案區是否出現;`loading` 時顯示閃爍游標。
- `compare` 頁:一次性 `compareQuestion()`,結果交給 `ComparePanel` 並排呈現(關鍵字側無 `distance`)。
- `graph` 頁:`fetchGraph()` 畫圖與 `askQuestionStream()` 串流答案並行。
- **提問紀錄**:`history` state 持久化到 `localStorage`(key `resume-chat-history`,以 q+tab 去重、上限 30、新的在前);三個 handler 各呼叫 `addHistory`,點紀錄用 `runOnTab(q, tab)` 切分頁並重跑。
- `AskBox` 以 `placeholder` prop 區分各頁提示語;Enter 送出、Shift+Enter 換行;送出鈕是 `.askbox__field` 右下角的紙飛機 icon,空字串時 disabled。

**樣式**:**Tailwind CSS v4**(`@tailwindcss/vite`,**跳過 preflight**)+ 混合式。markup 用 utility 處理版面/間距/字體/顏色/邊框;`src/index.css` 保留 CSS 變數設計系統與 utility 無法無損表達者(玻璃 `backdrop-filter`、多層陰影、`color-mix()`、星雲漸層、全部 `@keyframes`、偽元素、`clamp()`、全部 RWD `@media`)。顏色經 `@theme inline` 把 runtime 變數對應成 Tailwind token,故 `bg-*`/`text-*`/`border-*` 隨 `[data-theme]` 自動切換、markup 無需亮暗雙值;部分 BEM class 名保留於元素上,讓玻璃群組/動畫仍命中。改樣式:可乾淨對應者改 markup utility、保留效果改 `index.css`。`.askbox__btn`/`.askbox__spinner`/`.app__error` 因跨元件共用整段留 CSS。

**入口**:`main.tsx` → `App.tsx`;`index.html` 的 `<title>` 也是履歷主題,改主題時別漏。
