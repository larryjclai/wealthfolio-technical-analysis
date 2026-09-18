import React, { useEffect, useState, useCallback } from 'react';
import { HostAdapter } from '../host/HostAdapter';
import { SymbolResolver } from '../market-data/SymbolResolver';
import { YahooFinanceProvider } from '../market-data/YahooFinanceProvider';
import { analyzeStock, StockAnalysis, SignalType, filterBySignals, AnalysisInput } from '../indicators/analysis';
import { HoldingsTable } from '../components/HoldingsTable';
import { ScreenerBar } from '../components/ScreenerBar';

interface Props {
  host: HostAdapter;
  onNavigateToChart?: (symbol: string, market: string) => void;
}

const HoldingsOverviewPage: React.FC<Props> = ({ host, onNavigateToChart }) => {
  const [analyses, setAnalyses] = useState<StockAnalysis[]>([]);
  const [activeFilters, setActiveFilters] = useState<SignalType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0, symbol: '' });

  const loadHoldings = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAnalyses([]);

    try {
      // 1. Fetch all holdings from user's portfolio
      const holdings = await host.getAllHoldings();
      
      if (holdings.length === 0) {
        setLoading(false);
        return;
      }

      // 2. Resolve Yahoo symbols for each holding
      const resolver = new SymbolResolver();
      const provider = new YahooFinanceProvider(host);
      
      const holdingInfos = holdings.map(h => {
        const resolved = resolver.resolveFromHolding(h);
        return {
          holding: h,
          ...resolved,
        };
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
        const sym = symbols[i];
        const info = uniqueSymbols.get(sym)!;
        setProgress({ current: i + 1, total: symbols.length, symbol: info.displayName ? `${info.displayName} (${info.holding.instrument?.symbol || sym})` : (info.holding.instrument?.symbol || sym) });

        try {
          const instrument = { providerSymbol: sym, currency: info.currency, timezone: info.timezone } as any;
          const historyResult = await provider.getHistory({
            instrument,
            interval: '1d',
            from: new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString(),
            to: new Date().toISOString(),
            priceBasis: 'provider-ohlc',
          });

          const market = info.market || (info.currency === 'TWD' ? (sym.endsWith('.TWO') ? 'TPEX' : 'TWSE') : 'US');

          const analysisInput: AnalysisInput = {
            symbol: info.holding.instrument?.symbol || sym.replace(/\.(TW|TWO)$/, ''),
            displayName: info.displayName || sym,
            market,
            quantity: info.holding.quantity || 0,
            marketValue: info.holding.marketValue?.local || 0,
            closes: historyResult.bars.map(b => b.close),
            highs: historyResult.bars.map(b => b.high),
            lows: historyResult.bars.map(b => b.low),
            opens: historyResult.bars.map(b => b.open),
            volumes: historyResult.bars.map(b => b.volume || 0),
            week52High: historyResult.meta.fiftyTwoWeekHigh ?? null,
            week52Low: historyResult.meta.fiftyTwoWeekLow ?? null,
          };

          const analysis = analyzeStock(analysisInput);
          results.push(analysis);
          
          // Update UI progressively
          setAnalyses([...results]);
        } catch (e) {
          console.error(`Failed to analyze ${sym}:`, e);
        }

        // Small delay between requests to avoid rate limiting
        if (i < symbols.length - 1) {
          await new Promise(r => setTimeout(r, 350));
        }
      }

      setAnalyses(results);
    } catch (e: any) {
      setError(e.message || '載入持倉資料時發生錯誤');
    } finally {
      setLoading(false);
    }
  }, [host]);

  useEffect(() => {
    loadHoldings();
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
    <div className="p-6 bg-zinc-950 text-zinc-100 min-h-screen font-sans">
      <div className="max-w-full mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">持倉技術分析</h1>
            <p className="text-sm text-zinc-500 mt-1">
              {analyses.length > 0 
                ? `${analyses.length} 檔持倉 · ${totalSignals} 個訊號（${bullishCount} 多方 / ${bearishCount} 空方）`
                : '載入中...'}
            </p>
          </div>
          <button
            onClick={loadHoldings}
            disabled={loading}
            className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-300 hover:bg-zinc-700 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {loading ? '同步中...' : '重新整理'}
          </button>
        </div>

        {/* Loading progress */}
        {loading && progress.total > 0 && (
          <div className="mb-6 p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-zinc-400">
                正在分析 <span className="text-zinc-200 font-medium">{progress.symbol}</span>
              </span>
              <span className="text-xs text-zinc-500">{progress.current} / {progress.total}</span>
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
          <div className="mb-4 text-xs text-zinc-500">
            篩選結果: 顯示 {filteredAnalyses.length} / {analyses.length} 檔
          </div>
        )}

        {/* Holdings table */}
        <HoldingsTable 
          analyses={filteredAnalyses} 
          onSelectStock={handleSelectStock}
        />
      </div>
    </div>
  );
};

export default HoldingsOverviewPage;
