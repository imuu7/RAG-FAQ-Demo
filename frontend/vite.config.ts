import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// 前端只打相對路徑 /api/*,由 dev server / preview server 代理到後端。
// 代理目標可由環境變數覆寫:
//   - 在 host 上跑 vite dev:預設 http://localhost:8000 即可
//   - 在 Docker 容器內跑 preview:compose 會設成 http://backend:8000
//     (容器內 localhost 是容器自己,連不到後端容器)
const apiTarget = process.env.VITE_PROXY_TARGET || "http://localhost:8000";

const proxy = {
  "/api": {
    target: apiTarget,
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api/, ""),
  },
};

// host: true 讓 Windows 瀏覽器能連入 WSL 內的 server
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { host: true, port: 5173, proxy },
  preview: { host: true, port: 5173, proxy },
});
