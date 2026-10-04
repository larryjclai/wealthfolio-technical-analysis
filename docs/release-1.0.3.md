## v1.0.3 — Sparkle 圖示與行情提示改善

- 側欄 Technical Analysis 圖示改為 Phosphor Sparkle。
- 行情失敗與資料提示整合至右上角三角驚嘆號，點擊即可查看詳細內容。
- 補充近 52 週高低點的說明：代表位於全年高低區間底部／頂部的 15%，不代表已創新低／新高；計算方式維持不變。
- 整理 README，將計算細節與開發發布流程移至獨立文件。

下載附件 `addon.zip`，在 Wealthfolio「設定 → 擴充功能 → 從檔案安裝」匯入更新。需使用 Wealthfolio 3.8.0 或更新版本；既有追蹤設定與提醒歷史保留，不增加權限。

Sparkle 圖示的大小與 duotone 樣式由 Wealthfolio 側欄統一控制，套件無法單獨指定 `size={32}`。

驗證：79 項測試、TypeScript 型別檢查與建置通過；封裝版本與內容一致。
