FROM node:20-slim

WORKDIR /app

# 先裝相依以利快取
COPY package.json ./
RUN npm install

COPY . .

# 建置靜態檔
RUN npm run build

EXPOSE 5173

# 以 vite preview 提供靜態檔,並沿用 vite.config.ts 的 /api 代理
# (proxy 目標由 compose 注入的 VITE_PROXY_TARGET 指向 backend 容器)
CMD ["npm", "run", "preview"]
