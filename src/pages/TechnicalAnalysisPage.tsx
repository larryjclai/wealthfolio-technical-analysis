import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { HostAdapter } from '../host/HostAdapter';
import { SymbolPicker } from '../components/SymbolPicker';
import { PivotTable } from '../components/PivotTable';
import { IndicatorControls, IndicatorSettings } from '../components/IndicatorControls';
import { SymbolResolver, getTaiwanStockInfo } from '../market-data/SymbolResolver';
import { YahooFinanceProvider } from '../market-data/YahooFinanceProvider';
import { Market, Bar } from '../market-data/types';
import { createChart, IChartApi, CrosshairMode } from 'lightweight-charts';
import { sma } from '../indicators/sma';
import { ema } from '../indicators/ema';
import { bollingerBands } from '../indicators/bollinger';
import { rsi } from '../indicators/rsi';
import { calculatePivot, PivotResult } from '../indicators/pivot';

interface Props {
  host: HostAdapter;
  initialSymbol?: string;
  initialMarket?: Market;
  onBack?: () => void;
}

const TechnicalAnalysisPage: React.FC<Props> = ({ host, initialSymbol, initialMarket, onBack }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const rsiContainerRef = useRef<HTMLDivElement>(null);

  const [settings, setSettings] = useState<IndicatorSettings>({
    showSma: true,
    showEma: false,
    showBb: false,
    showRsi: true,
  });

  const [currentStock, setCurrentStock] = useState<{ symbol: string; displayName: string; market: Market }>({
    symbol: initialSymbol || '2330',
    displayName: getTaiwanStockInfo(initialSymbol || '2330')?.name || initialSymbol || '台積電',
    market: initialMarket || 'TWSE',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bars, setBars] = useState<Bar[]>([]);
  const [pivot, setPivot] = useState<{result: PivotResult, date: string} | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current || !rsiContainerRef.current) return;
    if (bars.length === 0) return;

    // Main Chart
    const chart = createChart(chartContainerRef.current, {
      layout: { background: { color: 'transparent' }, textColor: '#a1a1aa' },
      grid: { vertLines: { color: '#27272a' }, horzLines: { color: '#27272a' } },
      width: chartContainerRef.current.clientWidth,
      height: 400,
      crosshair: { mode: CrosshairMode.Normal },
      timeScale: { timeVisible: false, borderColor: '#3f3f46' },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    const volumeSeries = chart.addHistogramSeries({
      color: '#22c55e',
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    // Populate Data
    const chartData = bars.map(b => ({
      time: b.tradingDate,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close
    }));
    // @ts-ignore
    candleSeries.setData(chartData);

    const volumeData = bars.map(b => ({
      time: b.tradingDate,
      value: b.volume || 0,
      color: b.close >= b.open ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'
    }));
    // @ts-ignore
    volumeSeries.setData(volumeData);

    const closes = bars.map(b => b.close);

    // SMA
    if (settings.showSma) {
      const smaLine = chart.addLineSeries({ color: '#3b82f6', lineWidth: 1 });
      const smaData = sma(closes, 20).map((v, i) => v !== null ? { time: bars[i].tradingDate, value: v } : null).filter(Boolean);
      // @ts-ignore
      smaLine.setData(smaData);
    }

    // EMA
    if (settings.showEma) {
      const emaLine = chart.addLineSeries({ color: '#f59e0b', lineWidth: 1 });
      const emaData = ema(closes, 20).map((v, i) => v !== null ? { time: bars[i].tradingDate, value: v } : null).filter(Boolean);
      // @ts-ignore
      emaLine.setData(emaData);
    }

    // BB
    if (settings.showBb) {
      const upperLine = chart.addLineSeries({ color: 'rgba(59, 130, 246, 0.4)', lineWidth: 1, lineStyle: 2 });
      const lowerLine = chart.addLineSeries({ color: 'rgba(59, 130, 246, 0.4)', lineWidth: 1, lineStyle: 2 });
      const bb = bollingerBands(closes, 20, 2);
      
      const upperData = bb.upper.map((v, i) => v !== null ? { time: bars[i].tradingDate, value: v } : null).filter(Boolean);
      const lowerData = bb.lower.map((v, i) => v !== null ? { time: bars[i].tradingDate, value: v } : null).filter(Boolean);
      
      // @ts-ignore
      upperLine.setData(upperData);
      // @ts-ignore
      lowerLine.setData(lowerData);
    }

    // RSI Chart
    let rsiChart: IChartApi | null = null;
    if (settings.showRsi) {
      rsiChart = createChart(rsiContainerRef.current, {
        layout: { background: { color: 'transparent' }, textColor: '#a1a1aa' },
        grid: { vertLines: { color: '#27272a' }, horzLines: { color: '#27272a' } },
        width: rsiContainerRef.current.clientWidth,
        height: 150,
        timeScale: { timeVisible: false, borderColor: '#3f3f46' },
      });
      
      const rsiLine = rsiChart.addLineSeries({ color: '#c084fc', lineWidth: 1 });
      const rsiData = rsi(closes, 14).map((v, i) => v !== null ? { time: bars[i].tradingDate, value: v } : null).filter(Boolean);
      // @ts-ignore
      rsiLine.setData(rsiData);
      
      // Sync time scale
      chart.timeScale().subscribeVisibleTimeRangeChange((range) => {
        if (range) rsiChart?.timeScale().setVisibleRange(range);
      });
      rsiChart.timeScale().subscribeVisibleTimeRangeChange((range) => {
        if (range) chart.timeScale().setVisibleRange(range);
      });
    }

    chart.timeScale().fitContent();
    if (rsiChart) rsiChart.timeScale().fitContent();

    const handleResize = () => {
      if (chartContainerRef.current) chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      if (rsiChart && rsiContainerRef.current) rsiChart.applyOptions({ width: rsiContainerRef.current.clientWidth });
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      if (rsiChart) rsiChart.remove();
    };
  }, [bars, settings]);

  const loadData = async (symbolStr: string, market: Market) => {
    setLoading(true);
    setError(null);
    try {
      const resolver = new SymbolResolver();
      const instrument = await resolver.resolve({ symbol: symbolStr, market });
      const twInfo = getTaiwanStockInfo(symbolStr);
      const displayName = twInfo?.name || symbolStr;
      setCurrentStock({ symbol: symbolStr, displayName, market });

      const provider = new YahooFinanceProvider(host);
      
      const to = new Date();
      const from = new Date();
      from.setFullYear(from.getFullYear() - 1); 
      
      const res = await provider.getHistory({
        instrument,
        interval: '1d',
        from: from.toISOString(),
        to: to.toISOString(),
        priceBasis: 'provider-ohlc'
      });

      setBars(res.bars);

      if (res.bars.length > 0) {
        const last = res.bars[res.bars.length - 1];
        const pv = calculatePivot(last.high, last.low, last.close, 'classic');
        setPivot({ result: pv, date: last.tradingDate });
      } else {
        setPivot(null);
      }
    } catch (err: any) {
      setError(err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useLayoutEffect(() => {
    if (initialSymbol) {
      loadData(initialSymbol, initialMarket || (/^\d+$/.test(initialSymbol) ? 'TWSE' : 'US'));
    } else {
      loadData('2330', 'TWSE');
    }
  }, [initialSymbol, initialMarket]);

  return (
    <div className="p-6 bg-zinc-950 text-zinc-100 min-h-screen font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            {onBack && (
              <button
                onClick={onBack}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                返回總覽
              </button>
            )}
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                {currentStock.displayName !== currentStock.symbol ? (
                  <>
                    <span>{currentStock.displayName}</span>
                    <span className="text-base font-mono text-zinc-400">({currentStock.symbol})</span>
                  </>
                ) : (
                  <span>{currentStock.symbol}</span>
                )}
                <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 font-normal">
                  {currentStock.market}
                </span>
              </h1>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col gap-4 mb-6">
          <SymbolPicker onSelect={loadData} defaultSymbol={initialSymbol || '2330'} defaultMarket={initialMarket || 'TWSE'} />
          <IndicatorControls settings={settings} onChange={setSettings} />
        </div>
        
        {loading && <div className="mb-4 text-zinc-400 font-medium text-sm animate-pulse">正在同步市場資料...</div>}
        {error && <div className="mb-4 text-red-400 font-medium text-sm bg-red-950/30 p-3 rounded-lg border border-red-900/50">錯誤: {error}</div>}
        
        <div className="bg-zinc-900 p-1 rounded-xl border border-zinc-800 mb-6 shadow-xl">
          <div ref={chartContainerRef} className="w-full h-[400px] rounded-lg overflow-hidden" />
          {settings.showRsi && (
             <div className="border-t border-zinc-800 mt-1">
               <div ref={rsiContainerRef} className="w-full h-[150px] rounded-b-lg overflow-hidden" />
             </div>
          )}
        </div>
        
        <PivotTable pivot={pivot?.result || null} baseDate={pivot?.date || ''} />
      </div>
    </div>
  );
};

export default TechnicalAnalysisPage;
