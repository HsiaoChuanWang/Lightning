## 架構

```text
Lightning/
├─ api/                         # 部署至 Vercel 的 Serverless Functions
│  ├─ describe-image.js
│  └─ vectors.js
├─ server/                      # 僅供本機開發使用的 API 伺服器
│  └─ dev-server.js
├─ src/
│  ├─ assets/                   # 圖片、圖示及全域樣式
│  ├─ components/
│  │  ├─ common/                # 跨頁面共用元件
│  │  └─ ui-components/         # 基礎 UI 元件
│  ├─ layouts/                  # 路由共用版型
│  ├─ lib/                      # 第三方服務初始化
│  ├─ router/                   # Vue Router 設定
│  ├─ stores/                   # Pinia 狀態
│  ├─ types/                    # 可明確匯入的 TypeScript 型別
│  ├─ utils/                    # 共用函式與頁面守衛
│  ├─ views/                    # 路由頁面及其專屬元件
│  ├─ App.vue
│  └─ main.ts
├─ .env.local                   # 本機環境變數，不納入版控或部署
├─ env.d.ts                     # Vite 型別宣告
├─ index.html
├─ package.json
├─ vite.config.ts
└─ vercel.json
```

## API

`/api/describe-image` 使用 Gemini 根據圖片產生描述
`/api/vectors` 產生文字向量供相似度計算使用

`api/` 正式部署到 Vercel 後，Vercel 會執行 `api/` 裡的程式來呼叫 Gemini API。
`server/dev-server.js` 啟動本機後端，接收 Vue 前端的請求並呼叫 Gemini API。
