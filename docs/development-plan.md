# Wealthfolio 技術分析 Addon 開發計畫

版本：1.1 ｜ 撰寫日期：2026-09-17 ｜ 狀態：待於目標電腦實作與驗證

## 1. 專案目標與決策摘要

建立供個人使用的 Wealthfolio 技術分析 Addon，於同一頁查看台股與美股的日 K、成交量、趨勢指標與 Pivot 支撐／壓力。第一階段優先重用 Wealthfolio 內建 Yahoo Finance 行情，所有指標在本地計算，圖表採 TradingView Lightweight Charts。

本文件可直接交給另一台電腦的開發者或程式助理使用，不依賴原始對話。這是一份開發規格，並非已完成的程式；目標電腦的作業系統、Wealthfolio 版本與 Yahoo 連線能力尚未實測。

| 項目 | 決策 |
| --- | --- |
| 市場 | 台灣上市、上櫃及美國股票／ETF |
| 第一階段資料源 | 優先讀取 Wealthfolio 內建 Yahoo 行情；通過第 3 節完整性驗證 |
| 資料抽象 | 自訂 `MarketDataProvider`，不與 Wealthfolio 內部同名型別混用 |
| 圖表 | TradingView Lightweight Charts，只負責呈現，不提供行情或指標計算 |
| MVP 週期 | 日 K；可切換顯示最近 3M、6M、1Y、2Y |
| MVP 指標 | Classic Pivot、Fibonacci Pivot、SMA、EMA、Bollinger Bands、RSI |
| 第二階段 | 盤中 OHLCV 與 Session VWAP |
| 操作方式 | 唯讀分析、手動選股、手動更新；持倉選股是可選整合 |
| 不包含 | 下單、買賣建議、策略回測、即時串流、多市場選股器、公開商用發行 |

## 2. MVP 範圍與畫面

### 必須完成

1. 新增「技術分析」Addon 頁面，繁體中文介面。
2. 允許輸入完整 Yahoo 代碼，或選擇市場後輸入本地代碼；將常用股票加入自選清單。
3. 顯示名稱、完整代碼、交易所、幣別、資料來源、最新資料交易日、擷取時間及是否過期。
4. 使用日 K 主圖、成交量副圖、RSI 副圖；支援縮放、平移、十字線與 OHLCV tooltip。
5. 指標可個別開關；設定保存後，重新開啟 Addon 仍保留。
6. 預設 SMA 20／50／200、EMA 20／50、Bollinger 20／2、RSI 14；Pivot 可切換 Classic／Fibonacci。
7. 顯示日 Pivot 數值表與水平線，清楚標出「依據哪個已完成交易日計算」及「適用交易日」。
8. 空值、無效代碼、權限拒絕、網路失敗、限流、資料不足均有可理解的畫面。

### 可選項，不阻擋 MVP

- 從 Wealthfolio 持倉讀取股票清單；沒有權限或宿主版本不支援時，仍可手動選股。
- 保存指標參數與自選清單；MVP 不承諾關閉程式後仍可離線看完整行情。
- 週／月 Pivot、週 K、價格警示與匯出留待後續。

建議畫面順序：股票與市場選擇 → 資料狀態 → 期間／指標控制 → K 線與均線 → 成交量 → RSI → Pivot 表格。

## 3. 首要技術關卡：Yahoo 如何進入 Addon

### 已查證的限制

Wealthfolio 官方文件描述 Addon 為隔離的 TypeScript／React 模組。[Addon 開發總覽](https://wealthfolio.app/docs/addons/)

宿主提供 `ctx.api.network.request`，要求 HTTPS 與已核准主機；直接網路存取、localhost／私有 IP 及重新導向受限制。偏好設定可用宿主 storage，但不應把大量行情快取放入會同步的設定儲存區。[Addon API](https://wealthfolio.app/docs/addons/api-reference/)

`yahoo-finance2` 明確指出無法直接在瀏覽器使用，原因涉及 CORS 與 cookie；其定位為非官方 Yahoo API。因此「把 yahoo-finance2 裝進 Addon 前端就能使用、一定不需額外服務」不可作為本計畫前提。[yahoo-finance2 README](https://github.com/gadicc/yahoo-finance2#using-in-the-browser)

### 按 B → A → C 順序驗證，選一條可行路徑

**第一選擇是 Wealthfolio 內建資料。** Addon 可透過 `ctx.api.quotes.getHistory(assetId)` 讀取資產的歷史報價；assetId 是宿主資產識別碼，不是 Yahoo ticker。先核對每筆來源、OHLCV 及歷史長度，確認符合日 K 與指標需求。此路徑不需自行維護 Yahoo 網路連線，也不需安裝 yahoo-finance2。

讀取歷史不等於任意代碼都可立即查詢。階段 0 必須驗證未持有但已登錄的資產是否可讀，以及未登錄股票的處理方式。若只能讀取宿主已登錄資產，MVP 選股限於這些資產，手動輸入仍須解析到既有 assetId；找不到時提示使用者在宿主加入資產，不自行建立交易或修改設定。

「更新」預設重新讀取宿主已儲存資料，不把讀取時間當行情同步時間。需要強制 Yahoo 同步時，另驗證宿主 `market.sync` 能力、權限與影響；由使用者明確操作並在完成後重讀，失敗不改動既有資料。

| 路徑 | 作法 | 通過條件與取捨 |
| --- | --- | --- |
| A：宿主網路橋接，備援 | 實作小型 Yahoo chart response adapter，透過宿主網路 API 請求 Yahoo | 必須實測台股、美股皆能取得完整日 OHLCV；cookie、回應大小與端點限制需確認。此路徑不直接使用 yahoo-finance2 |
| B：宿主既有 Yahoo 行情，優先 | 檢查目標版本是否能唯讀取得所需標的的 Yahoo 歷史 OHLCV | 只有資料來源可確認、O/H/L/C/V 完整、歷史長度足夠且不必修改資產設定時才能採用；僅有收盤價不能替代 |
| C：獨立 HTTPS adapter | 在相容 Node.js 環境使用 yahoo-finance2，向 Addon 提供標準化行情 | 需要額外部署、認證與維運；不能預設本機 HTTP sidecar 可穿越宿主限制。列為 A/B 失敗後的架構變更 |

以 `2330.TW`、`0050.TW`、`6488.TWO`、`GOOGL`、`VTI` 進行小量探測，記錄 HTTP 狀態、回應欄位、交易所時區、歷史範圍與耗時。候選 chart endpoint 與參數應以實作當下文件／原始碼確認，不承諾長期有效。[Yahoo chart 模組](https://github.com/gadicc/yahoo-finance2/blob/dev/src/modules/chart.ts)

**關卡結論必須寫入 `docs/compatibility.md`。** A/B 未通過時，先完成 mock 資料的畫面與指標，將 live 整合標為阻擋；C 路徑可先做設計與本地測試，外部部署另行決定，不可宣稱已可安裝使用。不以停用沙盒、關閉 TLS 驗證或公共 CORS proxy 解決。

## 4. 技術架構

採用 TypeScript、React、官方 Addon SDK 與 Lightweight Charts；沿用目標 SDK 的建置模板及套件管理工具。以 Vitest 或模板既有測試框架驗證純函式，不為少量日 K 預先建立 worker、資料庫或微服務。

```text
Wealthfolio Addon 頁面
        │
        ├── HostAdapter：生命週期、偏好設定、可選持倉讀取
        │
        └── AnalysisService
              ├── SymbolResolver
              ├── 記憶體快取／同請求合併
              └── MarketDataProvider
                    └── YahooFinanceProvider
                          └── 優先 B：Wealthfolio 歷史報價；A/C 為備援
              │
              └── Normalize + Validate + Session Policy
                    └── IndicatorEngine（純函式）
                          └── ChartAdapter
                                └── Lightweight Charts + 數值表
```

責任邊界：UI 不知道 Yahoo endpoint；指標不做網路請求；圖表不推斷交易日與復權；Provider 不讀取投資組合數量與成本。未來更換資料源時，保留標準資料契約與指標測試。

Lightweight Charts 應打包進 Addon，避免依賴遠端 CDN。依鎖定版本使用其系列與 pane API，保留 NOTICE 與 TradingView 連結。[官方圖表文件](https://tradingview.github.io/lightweight-charts/docs)

### 規劃中的資料契約

以下為本專案自行定義的介面草案，不是宣稱宿主已有這些 API。

```ts
type Market = 'TWSE' | 'TPEX' | 'US';
type Interval = '1d' | '5m'; // 5m 僅預留第二階段，MVP 必須拒絕
type PriceBasis = 'provider-ohlc' | 'adjusted-ohlc';

interface Instrument {
  key: string;                 // 例如 TWSE:2330，禁止跨市場衝突
  symbol: string;              // 字串，保留 0050 前導零
  market: Market;
  exchange: string;
  currency: string;
  timezone: string;            // IANA timezone
  providerSymbol: string;      // Yahoo 格式只存在 provider 邊界
}

interface Bar {
  time: number;                // UTC epoch seconds，非 milliseconds
  tradingDate: string;         // 交易所當地 YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;       // 缺失不等於零
  completion: 'closed' | 'provisional' | 'unknown';
}

interface HistoryRequest {
  instrument: Instrument;
  interval: Interval;
  from: string;                // UTC ISO timestamp，含起點
  to: string;                  // UTC ISO timestamp，不含終點
  priceBasis: PriceBasis;
}

interface HistoryResult {
  bars: Bar[];
  meta: {
    provider: string;
    providerSymbol: string;
    currency: string;
    timezone: string;
    fetchedAt: string;
    latestTradingDate: string | null;
    priceBasis: PriceBasis;
    adjustmentDescription: string;
    delayMinutes: number | null; // null = 未知，不能標成即時
    volumeUnit: 'shares' | 'unknown';
    warnings: string[];
  };
}

interface MarketDataProvider {
  readonly id: string;
  readonly capabilities: {
    intervals: readonly Interval[];
    priceBases: readonly PriceBasis[];
  };
  resolve(input: { symbol: string; market?: Market }): Promise<Instrument>;
  getHistory(request: HistoryRequest): Promise<HistoryResult>;
}
```

不支援的 interval／price basis 必須回傳明確錯誤。錯誤至少區分 `INVALID_SYMBOL`、`AMBIGUOUS_SYMBOL`、`UNSUPPORTED`、`PERMISSION_DENIED`、`RATE_LIMITED`、`NETWORK_ERROR`、`INVALID_DATA`、`NO_DATA`，不得把失敗轉成全零行情。

## 5. 台美股資料規則

### 代碼解析

| 使用者輸入 | 市場資訊 | 預期 Yahoo 代碼 |
| --- | --- | --- |
| 2330 | TWSE | 2330.TW |
| 0050 | TWSE | 0050.TW |
| 6488 | TPEX | 6488.TWO |
| GOOGL | US | GOOGL |
| VTI | US | VTI |

這些是驗收用候選標的，開發時仍需驗證回傳的 instrument metadata。完整 `.TW`／`.TWO` 代碼不得重複加後綴；缺少市場的數字代碼不得一律猜為上市。美股特殊股別符號以可驗證映射處理，不做全域標點替換。持倉中的 asset ID 與交易代碼必須分開。

### 時間、完整性與價格基準

- 台股以 `Asia/Taipei`、美股以交易所提供的 IANA 時區處理，包含美國夏令時間；不能用電腦所在時區決定交易日。
- 日 K 以交易所日期傳給圖表的 BusinessDay。未來盤中 K 才使用 UTC 秒數呈現。
- 以交易所交易日曆與 session 結束時間判定完成狀態，覆蓋休市、提早收盤及跨日。第一階段保守排除當地「今天」的 K 棒，收盤後也待下一個當地日期才納入；其他完整性無法確認的棒標為 unknown，不當作已完成。
- 價格與指標只使用已確認完成的日 K；畫面註明這是日線分析，不宣稱即時報價。
- 歷史資料按時間遞增、去重；衝突重複列須記錄警告。非有限價格、H/L 邏輯錯誤不得進入指標。
- 休市不補零；合法無成交量的零保留，缺失 volume 則為 null；成交量預設顯示股數，未確認單位時標示未知，不能擅自轉「張」。
- MVP 使用 Yahoo 回傳的完整 OHLC 組合（`provider-ohlc`），保存實測的拆股／股息調整說明，不直接稱為完全未復權。
- 不以 `adjclose` 單獨替換 close，留下原 O/H/L。完整復權模式放到後續，需統一調整整組 OHLC 並明確處理成交量。
- 若缺少完整預期交易日，不默默把 20 根棒稱為連續 20 個交易日；顯示缺口。均線／RSI 在缺口後重新暖機，Pivot 不跨越疑似缺失的前一 session。
- 每次載入至少涵蓋顯示區間之前 250 個有效交易日；若不足則延長請求。EMA/RSI 從固定的載入起點計算，再裁切顯示區間，切換 3M／6M 不重新播種。新上市資料不足顯示 N/A。

### 快取與更新

MVP 用記憶體快取，key 包含 provider、symbol、exchange、interval、price basis、日期範圍及 schema version。最多保存 20 檔、每檔約 3 年日 K，採 LRU 淘汰。

建議 TTL 60 分鐘、同一請求合併、最多 2 個並發。手動更新可跳過 TTL，但保留 30 秒冷卻；暫時性錯誤最多重試 2 次，退避並尊重 Retry-After，限流時不得循環重試。以上是本專案保守策略，不代表 Yahoo 提供此額度。

更新失敗可繼續顯示目前記憶體中的舊資料，但需顯示原擷取時間及過期標示。自選清單與指標設定持久化；重新啟動後沒有行情快取是 MVP 的明確限制。

## 6. 指標計算規格

計算使用未四捨五入的數值，顯示時才格式化。所有指標共用同一組價格基準；不足期間的輸出為空值而非 0。不依賴 provider 的技術指標 API。

### Classic Pivot：Traditional 版本

不同平台的 Classic／Traditional 定義可能不同；本專案固定使用下列公式並在說明頁公開。以前一個完整交易日的 H、L、C 計算，適用於下一個交易日。

```text
P  = (H + L + C) / 3
R1 = 2P - L                 S1 = 2P - H
R2 = P + (H - L)            S2 = P - (H - L)
R3 = H + 2(P - L)           S3 = L - 2(H - P)
```

### Fibonacci Pivot

```text
P  = (H + L + C) / 3
R1 = P + 0.382(H - L)       S1 = P - 0.382(H - L)
R2 = P + 0.618(H - L)       S2 = P - 0.618(H - L)
R3 = P + 1.000(H - L)       S3 = P - 1.000(H - L)
```

MVP 只畫最新一組參考水平線，不把同一組 Pivot 當作所有歷史日期的訊號。表格永遠同時顯示依據日與適用日；無法確認下一交易日就明示未確認。將來若做歷史 Pivot，必須逐 session 位移，杜絕用當日 H/L/C 推算當日已知線位。

### SMA／EMA

- SMA(N)：最近 N 個有效 close 的算術平均；第 N 根才有值。
- EMA(N)：`alpha = 2 / (N + 1)`；前 N 根 close 的 SMA 為種子，後續 `EMA_t = alpha × C_t + (1-alpha) × EMA_(t-1)`。
- 預設 SMA 20／50／200、EMA 20／50；N 限制為 2–250 的整數。

### Bollinger Bands

預設 N=20、k=2；中軌是 SMA20，上下軌為 `SMA20 ± 2 × σ20`。σ 使用母體標準差（除以 N，而非 N−1）。一般參數可限制 N=2–250、k=0.1–5。

### RSI

預設 RSI14，採 Wilder 平滑。先用 14 個價格變動的平均漲幅與平均跌幅播種，故至少需要 15 個 close；之後 `avg_t = (avg_(t-1) × (N-1) + current) / N`。

`RS = avgGain / avgLoss`，`RSI = 100 - 100 / (1 + RS)`。若只有漲幅為正、跌幅為零，回傳 100；只有跌幅為正回傳 0；兩者皆為零，本專案約定為 50。圖上標出 30／70 參考線，說明是參考區間而非自動買賣指令。

### 可手算的驗證案例

| 案例 | 預期結果 |
| --- | --- |
| H=110、L=90、C=100，Classic | P=100；R1/2/3=110/120/130；S1/2/3=90/80/70 |
| 同上，Fibonacci | R1/2/3=107.64/112.36/120；S1/2/3=92.36/87.64/80 |
| close=1,2,3,4，SMA3 | 前兩筆無值；其後 2、3 |
| close=1,2,3,4，EMA3 | 第三筆種子 2；第四筆 3 |
| close=1,2,3，BB3/2 | 中軌 2，σ=√(2/3)，上下軌約 3.632993／0.367007 |
| 15 筆固定 close，RSI14 | 首次有效值 50 |
| 15 筆嚴格遞增／遞減 close | RSI14 首次有效值 100／0 |

## 7. 目錄結構

```text
wealthfolio-technical-analysis/
├── manifest.json
├── package.json
├── <套件管理工具的 lockfile>
├── tsconfig.json
├── <官方模板的建置設定>
├── README.md
├── THIRD_PARTY_NOTICES.md
├── src/
│   ├── addon.tsx
│   ├── host/HostAdapter.ts
│   ├── pages/TechnicalAnalysisPage.tsx
│   ├── components/
│   │   ├── SymbolPicker.tsx
│   │   ├── IndicatorControls.tsx
│   │   ├── MarketDataStatus.tsx
│   │   └── PivotTable.tsx
│   ├── market-data/
│   │   ├── types.ts
│   │   ├── MarketDataProvider.ts
│   │   ├── YahooFinanceProvider.ts
│   │   ├── SymbolResolver.ts
│   │   ├── normalizeBars.ts
│   │   ├── sessionPolicy.ts
│   │   ├── cache.ts
│   │   └── transport/        # 只建立實際採用的路徑
│   ├── indicators/
│   │   ├── pivot.ts
│   │   ├── sma.ts
│   │   ├── ema.ts
│   │   ├── bollinger.ts
│   │   └── rsi.ts
│   ├── charts/ChartAdapter.ts
│   ├── services/AnalysisService.ts
│   └── settings/preferences.ts
├── tests/
│   ├── fixtures/            # 小型合成資料、去識別 provider 回應
│   ├── indicators.test.ts
│   ├── provider-contract.test.ts
│   ├── symbols-and-sessions.test.ts
│   └── analysis-flow.test.ts
└── docs/
    ├── compatibility.md
    ├── data-contract.md
    └── acceptance.md
```

不預先建立空的其他 Provider、VWAP 模組或 server 目錄。只有選用 C 路徑時才新增獨立 adapter service。

## 8. 資料流與生命週期

1. 載入 Addon → 讀取偏好 → 呈現上次選擇的市場及股票。
2. `SymbolResolver` 核對代碼與市場；資訊不足就顯示可選市場，不發送猜測後的請求。
3. `AnalysisService` 建立包含暖機範圍的請求，查快取並合併重複工作。
4. Provider 透過已核准 transport 取得資料並附帶 metadata。
5. 正規化 UTC／交易日、驗證 OHLCV、分類完成狀態、檢查缺口與價格基準。
6. 指標引擎在同一份已完成日 K 上計算，再裁切到使用者選擇的可視區間。
7. ChartAdapter 將資料轉為圖表系列；Pivot 表格與線位共用同一計算結果。
8. 快速切換股票時用 request ID 丟棄舊結果；能取消請求則取消，不能取消也不得覆蓋新股票。
9. 更新成功才替換資料並更新 fetchedAt；失敗保留舊資料及失敗狀態。
10. Addon 停用或頁面卸載時，移除圖表、resize observer、事件訂閱與計時器。

## 9. 分階段開發步驟

| 階段 | 工作與交付 | 完成關卡 |
| --- | --- | --- |
| 0：環境與可行性 | 記錄 OS、宿主／SDK／Node／套件版本；建立最小頁面；驗證第 3 節 A/B 路徑 | 台美股真實日 OHLCV 能進入宿主；若失敗，明列 live 阻擋 |
| 1：專案骨架 | 官方模板、manifest、HostAdapter、唯讀權限與設定；mock Provider | 可安裝、開頁、停用，設定重開仍存在 |
| 2：資料層 | SymbolResolver、Yahoo Provider、metadata、session policy、快取與錯誤 | 上市／上櫃／美股／ETF 契約測試通過，無效代碼不誤配 |
| 3：計算層 | 依第 6 節實作所有純函式及手算測試 | 公式、種子、缺值、暖機及日期位移皆通過 |
| 4：圖表與互動 | K 線、量、均線、BB、RSI、Pivot、來源狀態 | mock 與 live 使用同一資料流；切股與縮放正常 |
| 5：整合與交付 | 故障測試、目標機安裝、打包、README、驗收紀錄 | 完成第 10 節；產出套件與可重現建置指引 |

第一個可交付里程碑：一檔台股、一檔美股能呈現日 K 與 SMA20。再完成全部指標，不先追求多市場搜尋服務或盤中功能。

### 在另一台電腦開始時

1. 將本文件放入新專案的 `docs/development-plan.md`。
2. 查看專案既有開發規範；如無專案，以當時官方 Addon 模板初始化。
3. 先填寫 `docs/compatibility.md`：OS、Wealthfolio 版本、SDK、Node、包管理器、chart library、驗證日期。使用相容版本並鎖定 lockfile，不憑本文件猜最新版本。
4. 完成階段 0 並記錄選定 transport，再進行後續整合。
5. README 應提供實際有效的安裝依賴、開發、typecheck、test、build、package 指令。不要把尚未存在的腳本寫成已可使用。
6. 最終交付 source、lockfile、Addon 安裝套件、第三方聲明、安裝／停用方式、限制及驗收紀錄。

## 10. 驗收條件

### 功能與市場

- [ ] `2330.TW`、`0050.TW`、`6488.TWO`、`GOOGL`、`VTI` 逐一實測，名稱／交易所／幣別無錯配。
- [ ] 至少抽查每個市場 3 個已完成交易日，圖表 O/H/L/C/V 與保存的 provider 回應一致。
- [ ] 記錄實際取得的起訖日與根數；SMA200 在歷史充足時有值，不足時明示 N/A。
- [ ] 所有指標可開關；設定及自選清單重開仍存在。
- [ ] K 線、成交量與 RSI 時間軸一致；Pivot 表格與圖線數值一致。

### 計算與資料品質

- [ ] 第 6 節手算 fixtures 全過；另加非對稱 H/L/C 與混合漲跌案例，避免只測過度簡單情境。
- [ ] 純函式比對容差採 `abs(actual-expected) <= 1e-8 × max(1, abs(expected))`。
- [ ] 初始空值、零量、缺量、缺價、重複列、亂序、交易日缺口均有測試。
- [ ] 覆蓋台灣休市、美國夏令時間及提早收盤；電腦時區改變不影響日 K 日期。
- [ ] 未完成／狀態未知的 K 棒不進入 Pivot 或正式日線指標。
- [ ] 拆股前後案例證明未混用 adjusted close 與另一套 OHLC；來源調整規則如不確定會明示。
- [ ] 切換顯示期間不改變重疊日期的 EMA／RSI；改變載入起點造成播種差異時有紀錄。

### 故障與使用體驗

- [ ] 無效代碼、空回應、403、429、timeout、拒絕權限及回應格式變更均有對應狀態。
- [ ] 失敗不產生假零、不清掉仍可用的畫面、不把舊資料標成剛更新。
- [ ] A 股票慢回應不覆蓋已切換的 B 股票；頁面停用後不持續發送請求。
- [ ] 無 live 連線時，明示未連線；mock 模式必須顯著標示，不能作為真實行情驗收。
- [ ] 以目標電腦實測 1,000 根日 K：純計算目標 <100 ms、已有資料的首次圖表呈現目標 <1 秒；記錄硬體及結果，不把網路時間算成計算效能。
- [ ] 視窗縮放、深淺色與連續切股 20 次後，沒有重疊圖表或持續增加的訂閱。

### 交付與權限

- [ ] 型別檢查、必要測試、建置、打包通過，產物在目標 Wealthfolio 安裝與開啟成功。
- [ ] manifest 只宣告採用功能所需權限與實際網域；不申請下單或交易寫入權限。
- [ ] 查詢只傳股票代碼／日期／週期，沒有外送帳戶、持倉數量與成本。
- [ ] 圖表有合適的 TradingView attribution／連結及套件 NOTICE。
- [ ] README 與 acceptance 記錄實測版本、時間、通過項目、限制與未通過項目。

只有 live、計算、圖表及安裝驗收同時通過才能標示 MVP 完成。此計畫的交付本身不代表上述方框已通過。

## 11. 第二階段：盤中資料與 VWAP

第二階段先確認台股及美股各自的盤中資料覆蓋、延遲、保留期間、成交量品質與存取限制，再開放功能；支援日 K 不等於支援可靠盤中 K。

建議先用 5 分鐘 K，只提供一般交易時段 Session VWAP；不同市場可獨立啟用，不需同時宣稱均已支援。美股盤前／盤後先排除，台股盤後交易是否可區分須實測。

```text
TypicalPrice_i = (High_i + Low_i + Close_i) / 3
Bar-based Session VWAP_t = Σ(TypicalPrice_i × Volume_i) / Σ(Volume_i)
```

這是以 K 棒典型價估算的 VWAP，不等同逐筆成交金額除以成交股數的精確 VWAP，UI 必須標示「5 分鐘 K 估算 VWAP」。

開發項目：

1. 在 Provider capabilities 開放已驗證市場的 `5m`，記錄最大可查範圍與延遲。
2. 依交易所 session 分組，每個 session 重設累計；不可按使用者電腦午夜重設。
3. 累積量為零時無值；零量棒不改變既有 VWAP，缺量／缺棒要顯示不完整，不能裝成完整 session。
4. 從當日 session 開始取得資料；若只拿到中段，不稱為全日 VWAP。
5. 即時未完成棒可顯示暫估狀態，但更新同一 timestamp 時替換而非重複累加。
6. 輪詢頻率尊重來源限制；視窗隱藏或休市時停止不必要請求。

驗收 fixture：典型價 100、110，量 10、30，第二筆 VWAP=107.5；下一 session 第一筆重新播種。同時驗證夏令時間、提早收盤、重複更新、零量與盤中缺口。

不以日 K 的累積典型價冒充今日盤中 VWAP。Anchored VWAP、跨日 VWAP 另訂規格。

## 12. 風險與處理

| 風險 | 對策／何時視為阻擋 |
| --- | --- |
| Yahoo 非官方端點變更、限流或認證需求 | Provider 隔離、契約測試、保守快取；無法取得資料就呈現 unavailable，不保證長期免費可用 |
| 宿主沙盒無法完成 Yahoo 連線 | 階段 0 優先驗證；A/B 皆失敗則 live 阻擋，重新評估 HTTPS adapter |
| 宿主與 SDK 文件／版本不一致 | 以目標版本型別與最小實測為準，記錄差異；不憑舊範例猜 API |
| 台股上市／上櫃或美股股別誤配 | 市場＋代碼作識別，驗證 metadata；資訊不足要求選擇 |
| 拆股／除息與復權不一致 | 統一 OHLC 基準並保存說明；完整復權另行驗證 |
| 缺值、時區或休市導致假指標 | session policy、缺口提示、暖機規則與固定 fixtures |
| 新股／下市標的歷史不足或消失 | 真實回傳 N/A／NO_DATA，不能用其他標的或合成值補足 |
| 圖表 library 升版造成 API 差異 | 鎖定版本，ChartAdapter 集中適配，驗證生命週期清理 |
| 發行方式與資料使用條件不相容 | 第一版定位個人工具；公開散布／商用前重新確認資料授權及供應商方案，不視為個人使用即自動取得所有權利 |
| 第二階段盤中資料品質不足 | 依市場逐項開放；VWAP 明確標示估算法與完整性 |

## 13. 後續擴充順序

1. 第二階段：5 分鐘盤中 K 與 Session VWAP。
2. 第三階段：週／月 Pivot、週 K、完整復權模式、資料匯出。
3. 第四階段：額外 MarketDataProvider，例如 Twelve Data、台灣交易所資料或合法授權來源；逐市場驗證方案涵蓋，不能預設同時免費提供台美股。
4. 第五階段：本機價格警示、技術條件篩選、Anchored VWAP。
5. 若新增回測，另設避免前視偏誤、存活者偏誤、交易成本與 corporate actions 的規格，不直接把目前畫面指標視為策略績效。

新增 Provider 先跑同一套契約測試。若需要 fallback，UI 要揭露來源與價格基準改變，不可混接兩個來源的歷史棒而不提示。

## 14. 執行與回報規則

先完成可驗證的小型日線流程，再逐項擴充。每個里程碑回報「已完成、如何驗證、仍受阻的項目與下一步」。可用 mock 繼續獨立工作，但完成狀態須區分 mock、live 與目標機安裝。

保留原有專案及使用者資料；本 Addon 預設唯讀。這份計畫不包含對外部署、商店上架或修改使用者投資交易資料的執行授權。

## 15. 官方參考資料

以下為 2026-09-17 查閱的參考入口；實作時依目標版本重驗。公式、目錄、介面、效能目標與階段劃分均為本計畫的設計決策。

- [Wealthfolio Addon 開發總覽](https://wealthfolio.app/docs/addons/)
- [Wealthfolio Addon API](https://wealthfolio.app/docs/addons/api-reference/)
- [Wealthfolio 官方 Addon 入門原始文件](https://github.com/wealthfolio/wealthfolio/blob/main/docs/addons/addon-getting-started.md)
- [yahoo-finance2 專案與瀏覽器限制](https://github.com/gadicc/yahoo-finance2)
- [yahoo-finance2 chart 模組](https://github.com/gadicc/yahoo-finance2/blob/dev/src/modules/chart.ts)
- [TradingView Lightweight Charts 文件與 attribution](https://tradingview.github.io/lightweight-charts/docs)
- [TradingView 圖表產品比較：圖表不含行情](https://www.tradingview.com/charting-library-docs/latest/getting_started/product-comparison/)
