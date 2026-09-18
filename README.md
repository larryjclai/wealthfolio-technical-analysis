# Wealthfolio Technical Analysis Addon 📈

[![Wealthfolio Addon](https://img.shields.io/badge/Wealthfolio-Addon-blue.svg)](https://github.com/wealthfolio/wealthfolio)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue?style=flat-square)](https://www.typescriptlang.org/)

這是一個專為 [Wealthfolio](https://github.com/wealthfolio/wealthfolio) 設計的開源技術分析擴充套件（Technical Analysis Addon）。

主要協助個人投資者將當前持倉的**台股**與**美股**展開為表格式儀表板，即時監控現價、中長期關鍵均線關卡、RSI、52 週高低區間定位，並提供情境快篩功能，方便進行中長期的投資判斷與風險控管。

---

## ✨ 核心特色 (Key Features)

### 1. 📊 持倉技術分析總覽表格 (Holdings Technical Overview)
* 自動讀取您在 Wealthfolio 記錄的所有有效帳戶證券持倉（包含台股與美股）。
* 自動去重並非同步抓取 Yahoo Finance 最新 2 年日 K 資料進行即時計算。
* 清楚呈現：**現價**、**今日漲跌幅**、**MA20 (月線)**、**MA60 (季線)**、**MA120 (半年線)**、**MA240 (年線)**、**RSI (14)**、**52 週高低定位區間條**以及**當前技術訊號**。
* 支援所有欄位一鍵排序（由大到小 / 由小到大）。

### 2. 🇹🇼 台股 100% 全繁體中文名稱支援 (TWSE / TPEX Traditional Chinese Names)
* 內建**臺灣證券交易所 (TWSE)** 與**證券櫃檯買賣中心 (TPEX)** 官方資料庫（收錄 12,856 筆標的）。
* 本地 0ms 極速比對：無論是上市個股（如 `2330` → **台積電**）、熱門 ETF（`0050` → **元大台灣50**、`00878` → **國泰永續高股息**、`00919` → **群益台灣精選高息**），還是上櫃股票（`8069` → **元太**），皆直接呈現清晰的繁體中文名稱。
* **上櫃股票自動對齊**：自動區分上市（`.TW`）與上櫃（`.TWO`），解決 Yahoo Finance 上櫃股票報價查詢問題。

### 3. 🔍 9 種技術面情境快篩 (Technical Screener)
可一鍵篩選出達成特定關鍵條件的持倉標的：
* 🚨 **跌破季線 (MA60)**：中期轉弱警示。
* ⚠️ **跌破年線 (MA240)**：長線走空警示。
* 🚀 **站上年線 (MA240)**：長線走多翻多訊號。
* 🔴 **RSI 超買 (>70)**：短期過熱風險。
* 🟢 **RSI 超賣 (<30)**：超跌反彈機會。
* 📉 **接近 52 週最低點 (前 15%)**：尋找價值支撐。
* 📈 **接近 52 週最高點 (前 15%)**：強勢突破標的。
* 🛡️ **觸及布林下軌 (Lower Band)**：極端超賣支撐區。
* ⚡ **觸及布林上軌 (Upper Band)**：強勢壓力挑戰區。

### 4. 📈 互動式 K 線與多重指標圖表 (Interactive Candlestick Chart)
* 點擊總覽表格中的任一持倉，無縫切換至該股票的完整互動式日 K 線圖表（基於 TradingView Lightweight Charts）。
* 支援動態切換：
  * **均線系統**：SMA (20, 60, 120, 240) / EMA (12, 26)
  * **布林通道**：Bollinger Bands (20, 2)
  * **相對強弱指標**：RSI (14) 獨立副圖
  * **關鍵關卡樞紐點**：Classic / Fibonacci Pivot Points (R3~S3) 關卡表
* 點擊左上角「返回總覽」隨時無縫返回持倉清單。

---

## 📥 安裝說明 (Installation)

1. 前往本專案的 [Releases](../../releases) 頁面下載最新版本的 `addon.zip`。
2. 開啟 **[Wealthfolio](https://github.com/wealthfolio/wealthfolio)** 應用程式。
3. 進入左下角 **設定 (Settings) → 擴充功能 (Addons)**。
4. 點擊右上角的 **「+」→「從檔案安裝 (Install from file)」**。
5. 選擇下載的 `addon.zip`，檢閱權限核准後即可立即啟用！

---

## 🛠️ 開發與建置 (Development & Build)

本專案使用 React 19、TypeScript、Tailwind CSS、Vite 以及 `@wealthfolio/addon-sdk`。

### 1. 安裝相依套件
```bash
pnpm install
# 或
npm install
```

### 2. 執行型別檢查與單元測試
```bash
npm run type-check
npm run test
```

### 3. 建置與打包為 Wealthfolio 外掛
```bash
npm run bundle
```
打包完成後將於根目錄產生符合 Wealthfolio 規範的 `addon.zip`。

---

## 🔒 權限聲明 (Permissions Required)

本套件僅要求運作所必需的最小權限：
* `accounts:getAll`：讀取使用者的投資帳戶清單以獲取關聯持倉。
* `portfolio:getHoldings`：讀取持倉標的代碼與數量以展開技術分析。
* `network:request`：透過 Wealthfolio 安全代理伺服器向 Yahoo Finance (`query1.finance.yahoo.com`, `query2.finance.yahoo.com`) 獲取公開市場日 K 歷史數據。

---

## 📄 開源授權 (License)

本專案基於 [MIT License](LICENSE) 條款開源發布。

感謝 [Wealthfolio](https://github.com/wealthfolio/wealthfolio) 提供優秀且隱私優先的個人資產管理平台！
