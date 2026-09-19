import React, { useEffect, useState, useCallback, useRef } from 'react';
import { HostAdapter } from '../host/HostAdapter';
import { SymbolResolver } from '../market-data/SymbolResolver';
import { YahooFinanceProvider } from '../market-data/YahooFinanceProvider';
import { analyzeStock, StockAnalysis, SignalType, filterBySignals, AnalysisInput } from '../indicators/analysis';
import { HoldingsTable } from '../components/HoldingsTable';
import { ScreenerBar } from '../components/ScreenerBar';

interface Props {
  host: HostAdapter;
  headerActions?: React.ReactNode;
  onNavigateToChart?: (symbol: string, market: string) => void;
}

const HoldingsOverviewPage: React.FC<Props> = ({ host, onNavigateToChart, headerActions }) => {
  const generation = useRef(0);
  const [failures, setFailures] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [analyses, setAnalyses] = useState<StockAnalysis[]>([]);
  const [activeFilters, setActiveFilters] = useState<SignalType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0, symbol: '' });

  const loadHoldings = useCallback(async () => {
    const requestId = ++generation.current;
    const failed: string[] = [];
    const notices: string[] = [];
    setFailures([]);
    setWarnings([]);
    setProgress({ current: 0, total: 0, symbol: '' });
    setLoading(true);
    setError(null);
    setAnalyses([]);

    try {
      // 1. Fetch all holdings from user's portfolio
      const holdings = await host.getAllHoldings();
      if (requestId !== generation.current) return;

      if (holdings.length === 0) {
        setLoading(false);
        return;
      }

      // 2. Resolve Yahoo symbols for each holding
      const resolver = new SymbolResolver();
      const provider = new YahooFinanceProvider(host);

      const holdingInfos = holdings.flatMap(h => {
        try {
          const resolved = resolver.resolveFromHolding(h);
          return { holding: h, ...resolved };
        } catch (error) { failed.push(`${h.instrument?.symbol || '未知標的'}：${String(error)}`); return []; }
      });

      // Deduplicate by providerSymbol (same stock might be in multiple accounts)
      const uniqueSymbols = new Map<string, typeof holdingInfos[0]>();
      for (const info of holdingInfos) {
        const existing = uniqueSymbols.get(info.providerSymbol);
        if (existing) {
          // Merge quantities for same symbol across accounts
          existing.holding = {
            ...existing.holding,
            quantity: (existing.holding.quantity || 0) + (info.holding.quantity || 0),
            marketValue: {
              local: (existing.holding.marketValue?.local || 0) + (info.holding.marketValue?.local || 0),
              base: (existing.holding.marketValue?.base || 0) + (info.holding.marketValue?.base || 0),
            },
          } as any;
        } else {
          uniqueSymbols.set(info.providerSymbol, { ...info });
        }
      }

      const symbols = Array.from(uniqueSymbols.keys());
      setProgress({ current: 0, total: symbols.length, symbol: '' });

      // 3. Fetch history for each symbol and analyze
      const results: StockAnalysis[] = [];

      for (let i = 0; i < symbols.length; i++) {
        if (requestId !== generation.current) return;
        const sym = symbols[i];
        const info = uniqueSymbols.get(sym)!;
        setProgress({ current: i + 1, total: symbols.length, symbol: info.displayName ? `${info.displayName} (${info.holding.instrument?.symbol || sym})` : (info.holding.instrument?.symbol || sym) });

        try {
          const instrument = await resolver.resolve({ symbol: sym, market: info.market });
          const historyResult = await provider.getHistory({
            instrument,
            interval: '1d',
            from: new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString(),
            to: new Date().toISOString(),
            priceBasis: 'provider-ohlc',
          });

          if (requestId !== generation.current) return;
          notices.push(...historyResult.meta.warnings.map(w => `${sym}：${w}`));
          const market = info.market || (info.currency === 'TWD' ? (sym.endsWith('.TWO') ? 'TPEX' : 'TWSE') : 'US');

          const analysisInput: AnalysisInput = {
            bars: historyResult.bars,
            symbol: info.holding.instrument?.symbol || sym.replace(/\.(TW|TWO)$/, ''),
            displayName: info.displayName || sym,
            market,
            quantity: info.holding.quantity || 0,
            marketValue: info.holding.marketValue?.local || 0,
            week52High: historyResult.meta.fiftyTwoWeekHigh ?? null,
            week52Low: historyResult.meta.fiftyTwoWeekLow ?? null,
          };

          const analysis = analyzeStock(analysisInput);
          results.push(analysis);

          // Update UI progressively
          setAnalyses([...results]);
        } catch (e) {
          if (requestId !== generation.current) return;
          failed.push(`${sym}：${String(e)}`);
        }

        // Small delay between requests to avoid rate limiting
        if (i < symbols.length - 1) {
          await new Promise(r => setTimeout(r, 350));
        }
      }

      if (requestId !== generation.current) return;
      setFailures(failed);
      setWarnings(notices);
      setAnalyses(results);
    } catch (e: any) {
      if (requestId !== generation.current) return;
      setError(e.message || '載入持倉資料時發生錯誤');
    } finally {
      if (requestId === generation.current) setLoading(false);
    }
  }, [host]);

  useEffect(() => {
    void loadHoldings();
    return () => { generation.current++; };
  }, [loadHoldings]);

  const handleToggleFilter = (signal: SignalType) => {
    setActiveFilters(prev =>
      prev.includes(signal)
        ? prev.filter(s => s !== signal)
        : [...prev, signal]
    );
  };

  const handleSelectStock = (symbol: string, market: string) => {
    if (onNavigateToChart) {
      onNavigateToChart(symbol, market);
    }
  };

  const filteredAnalyses = filterBySignals(analyses, activeFilters);

  // Count signals
  const totalSignals = analyses.reduce((sum, a) => sum + a.signals.length, 0);
  const bullishCount = analyses.filter(a => a.signals.some(s => s.sentiment === 'bullish')).length;
  const bearishCount = analyses.filter(a => a.signals.some(s => s.sentiment === 'bearish')).length;

  return (
    <div className="p-4 sm:p-6 bg-zinc-950 text-zinc-100 min-h-screen font-sans">
      <div className="max-w-full mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">持倉技術分析</h1>
            <p className="text-sm text-zinc-400 mt-1">
              {analyses.length > 0
                ? `${analyses.length} 檔持倉 · ${totalSignals} 個訊號（${bullishCount} 多方 / ${bearishCount} 空方）`
                : loading ? '載入中…' : '尚無可顯示的分析'}
            </p>
          </div>
          <div className="flex items-center gap-2">
          {onNavigateToChart && <button onClick={() => onNavigateToChart('2330', 'TWSE')} className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm">查詢股票</button>}
          <button
            onClick={loadHoldings}
            disabled={loading}
            className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-300 hover:bg-zinc-700 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {loading ? '同步中...' : '重新整理'}
          </button>{headerActions}</div>
        </div>

        <details className="mb-4 text-xs text-zinc-400"><summary className="cursor-pointer w-fit py-2">行情與指標說明</summary>
        <p className="text-xs text-zinc-400 mt-2 max-w-prose">價格為最新日 K，可能延遲；漲跌為相對前一筆有效日 K。20 日區間支撐／壓力採最新交易日前的低／高點，是短期參考，並非所有市場通用的支撐壓力標準。休市沿用最近交易日。</p>
        <p className="text-xs text-zinc-400 mt-2 max-w-prose">區間支撐／壓力看前 20 日最低／最高價；MA20（SMA20）看最近 20 日收盤平均，包含最新日 K，未收盤時會變動。</p>
        </details>
        {failures.length > 0 && <div role="alert" className="mb-4 text-sm text-amber-300">有 {failures.length} 檔暫無可用行情。請核對代碼與市場，網路錯誤可重新整理重試：<ul>{failures.map((failure, i) => <li key={i}>{failure}</li>)}</ul></div>}
        {warnings.length > 0 && <details className="mb-4 text-sm text-zinc-400"><summary>行情注意事項（{warnings.length}）</summary><ul>{warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul></details>}
        {/* Loading progress */}
        {loading && progress.total > 0 && (
          <div className="mb-6 p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-zinc-400">
                正在分析 <span className="text-zinc-200 font-medium">{progress.symbol}</span>
              </span>
              <span className="text-xs text-zinc-400">{progress.current} / {progress.total}</span>
            </div>
            <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-950/30 border border-red-900/50 rounded-xl text-red-400 text-sm">
            錯誤: {error}
          </div>
        )}

        {/* Screener filters */}
        {analyses.length > 0 && (
          <div className="mb-4">
            <ScreenerBar
              activeFilters={activeFilters}
              onToggle={handleToggleFilter}
              analyses={analyses}
            />
          </div>
        )}

        {/* Filter status */}
        {activeFilters.length > 0 && (
          <div className="mb-4 text-xs text-zinc-400">
            篩選結果: 顯示 {filteredAnalyses.length} / {analyses.length} 檔
          </div>
        )}

        {/* Holdings table */}
        {loading && analyses.length === 0 ? <p role="status" className="text-zinc-400 py-8">正在載入持倉與行情…</p> : <HoldingsTable
          analyses={filteredAnalyses}
          onSelectStock={handleSelectStock}
          filtered={activeFilters.length > 0}
        />}
      </div>
    </div>
  );
};

export default HoldingsOverviewPage;
