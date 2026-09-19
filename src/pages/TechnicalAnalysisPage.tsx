import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { HostAdapter } from '../host/HostAdapter';
import { SymbolPicker } from '../components/SymbolPicker';
import { PivotTable } from '../components/PivotTable';
import { IndicatorControls, IndicatorSettings, ChartLegend, chartColors } from '../components/IndicatorControls';
import { TrailingStopPanel } from '../components/TrailingStopPanel';
import { TrailingStopStore, StopState } from '../alerts/TrailingStopStore';
import { stopPrice } from '../alerts/trailing-stop';
import { SymbolResolver, getTaiwanStockInfo } from '../market-data/SymbolResolver';
import { YahooFinanceProvider } from '../market-data/YahooFinanceProvider';
import { Market, HistoryResult, Instrument } from '../market-data/types';
import { stockTrades, TradeRecord } from '../market-data/trades';
import { createChart, IChartApi, CrosshairMode, LineStyle, SeriesMarker, Time, AutoscaleInfo } from 'lightweight-charts';
import { HoldingCost, holdingCost } from '../indicators/cost-basis';
import { sma } from '../indicators/sma';
import { ema } from '../indicators/ema';
import { bollingerBands } from '../indicators/bollinger';
import { rsi } from '../indicators/rsi';
import { PivotType } from '../indicators/pivot';
import { supportResistance } from '../indicators/support-resistance';

interface Props {
  host: HostAdapter;
  initialSymbol?: string;
  initialMarket?: Market;
  onBack?: () => void;
  stopStore: TrailingStopStore;
  stopState: StopState;
  headerActions?: React.ReactNode;
}
const TechnicalAnalysisPage: React.FC<Props> = ({ host, initialSymbol, initialMarket, onBack, stopStore, stopState, headerActions }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const rsiContainerRef = useRef<HTMLDivElement>(null);
  const generation = useRef(0);
  const [settings, setSettings] = useState<IndicatorSettings>({ showSma: true, showEma: false, showBb: false, showRsi: true, showLevels: true, showTrades: true, showCost: true });
  const [instrument, setInstrument] = useState<Instrument | null>(null);
  const [requested, setRequested] = useState(initialSymbol || '2330');
  const [history, setHistory] = useState<HistoryResult | null>(null);
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [cost, setCost] = useState<HoldingCost | null>(null);
  const [costLoading, setCostLoading] = useState(false);
  const [costError, setCostError] = useState<string | null>(null);
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [tradesLoading, setTradesLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pivotType, setPivotType] = useState<PivotType>('classic');
  const bars = history?.bars;
  const levels = useMemo(() => supportResistance(bars || [], pivotType), [bars, pivotType]);
  const rule = stopState.rules.find(r => r.instrument.providerSymbol === instrument?.providerSymbol);
  const threshold = rule && !rule.needsReview ? stopPrice(rule) : null;
  const displayName = instrument ? getTaiwanStockInfo(instrument.symbol)?.name || instrument.symbol : requested;
  const loadData = useCallback(async (symbol: string, market: Market) => {
    const id = ++generation.current;
    setRequested(symbol); setLoading(true); setError(null); setHistory(null); setInstrument(null); setTrades([]); setTradeError(null); setTradesLoading(false); setCost(null); setCostError(null); setCostLoading(false);
    try {
      const resolved = await new SymbolResolver().resolve({ symbol, market });
      if (id !== generation.current) return;
      setInstrument(resolved);
      const now = new Date();
      const res = await new YahooFinanceProvider(host).getHistory({ instrument: resolved, interval: '1d', from: new Date(now.getTime() - 2 * 366 * 86400000).toISOString(), to: now.toISOString(), priceBasis: 'provider-ohlc' });
      if (id !== generation.current) return;
      setHistory(res); setLoading(false); setTradesLoading(true); setCostLoading(true);
      await Promise.all([
        (async () => {
          try {
            const activities = await host.ctx.api.activities.getAll();
            if (id === generation.current) setTrades(stockTrades(activities, resolved));
          } catch (tradeFailure) {
            if (id === generation.current) setTradeError(`無法讀取交易紀錄，請確認已授予 activities:getAll 權限：${String(tradeFailure)}`);
          } finally { if (id === generation.current) setTradesLoading(false); }
        })(),
        (async () => {
          try {
            const holdings = await host.getAllHoldings();
            if (id === generation.current) setCost(holdingCost(holdings, resolved));
          } catch (failure) {
            if (id === generation.current) setCostError(`無法讀取持倉成本：${String(failure)}`);
          } finally { if (id === generation.current) setCostLoading(false); }
        })(),
      ]);
    } catch (failure) { if (id === generation.current) setError(String(failure)); }
    finally { if (id === generation.current) setLoading(false); }
  }, [host]);
  useEffect(() => {
    void loadData(initialSymbol || '2330', initialMarket || 'TWSE');
    return () => { generation.current++; };
  }, [initialSymbol, initialMarket, loadData]);

  useEffect(() => {
    if (!chartContainerRef.current || !bars?.length) return;
    const common = {
      layout: { background: { color: '#18181b' }, textColor: '#a1a1aa' },
      grid: { vertLines: { color: '#27272a' }, horzLines: { color: '#27272a' } },
      timeScale: { timeVisible: false, borderColor: '#3f3f46' },
    };
    const chart = createChart(chartContainerRef.current, { ...common, width: chartContainerRef.current.clientWidth, height: 400, crosshair: { mode: CrosshairMode.Normal } });
    const candleSeries = chart.addCandlestickSeries({
      autoscaleInfoProvider: (original: () => AutoscaleInfo | null) => {
        const info = original();
        if (info && settings.showCost && cost?.averageCost != null) {
          return { ...info, priceRange: { minValue: Math.min(info.priceRange.minValue, cost.averageCost), maxValue: Math.max(info.priceRange.maxValue, cost.averageCost) } };
        }
        return info;
      }, upColor: '#22c55e', downColor: '#ef4444', borderVisible: false, wickUpColor: '#22c55e', wickDownColor: '#ef4444' });
    candleSeries.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: 0.22 } });
    candleSeries.setData(bars.map(b => ({ time: b.tradingDate, open: b.open, high: b.high, low: b.low, close: b.close })));
    const volume = chart.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: '', lastValueVisible: false, priceLineVisible: false });
    volume.priceScale().applyOptions({ scaleMargins: { top: 0.83, bottom: 0 } });
    volume.setData(bars.filter(b => b.volume !== null).map(b => ({ time: b.tradingDate, value: b.volume!, color: b.close >= b.open ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)' })));
    const closes = bars.map(b => b.close);
    const line = (data: (number | null)[], color: string, title: string, lineStyle = LineStyle.Solid) => {
      const series = chart.addLineSeries({ color, lineWidth: 1, title, lineStyle, priceLineVisible: false });
      series.setData(data.flatMap((value, i) => value === null ? [] : [{ time: bars[i].tradingDate, value }]));
    };
    if (settings.showSma) [20, 60, 120, 240].forEach((period, i) => line(sma(closes, period), chartColors.sma[i], `SMA ${period}`));
    if (settings.showEma) [12, 26].forEach((period, i) => line(ema(closes, period), chartColors.ema[i], `EMA ${period}`));
    if (settings.showBb) {
      const bb = bollingerBands(closes, 20, 2);
      line(bb.upper, chartColors.bb, 'BB 上軌', LineStyle.Dashed);
      line(bb.middle, chartColors.bb, 'BB 中軌');
      line(bb.lower, chartColors.bb, 'BB 下軌', LineStyle.Dashed);
    }
    if (settings.showLevels) {
      if (levels.support !== null) candleSeries.createPriceLine({ price: levels.support, color: chartColors.support, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: '20日區間支撐' });
      if (levels.resistance !== null) candleSeries.createPriceLine({ price: levels.resistance, color: chartColors.resistance, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: '20日區間壓力' });
    }
    if (settings.showCost && cost?.averageCost !== null && cost?.averageCost !== undefined) candleSeries.createPriceLine({ price: cost.averageCost, color: chartColors.cost, lineWidth: 2, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: '持倉均價' });
    if (threshold !== null) candleSeries.createPriceLine({ price: threshold, color: chartColors.stop, lineWidth: 2, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: '停利提醒' });
    if (settings.showTrades) {
      const dates = new Set(bars.map(b => b.tradingDate));
      const markers: SeriesMarker<Time>[] = trades.filter(t => dates.has(t.date)).map(t => ({ time: t.date, position: t.side === 'BUY' ? 'belowBar' : 'aboveBar', color: t.side === 'BUY' ? chartColors.buy : chartColors.sell, shape: t.side === 'BUY' ? 'arrowUp' : 'arrowDown', text: `${t.side === 'BUY' ? '買' : '賣'} ${t.quantity} @ ${t.price.toFixed(2)}` }));
      candleSeries.setMarkers(markers);
    }
    let rsiChart: IChartApi | null = null;
    if (settings.showRsi && rsiContainerRef.current) {
      rsiChart = createChart(rsiContainerRef.current, { ...common, width: rsiContainerRef.current.clientWidth, height: 150 });
      const series = rsiChart.addLineSeries({ color: chartColors.rsi, lineWidth: 1, title: 'RSI 14', autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }) });
      series.setData(rsi(closes, 14).map((value, i) => value === null ? { time: bars[i].tradingDate } : { time: bars[i].tradingDate, value }));
      [30, 70].forEach(price => series.createPriceLine({ price, color: '#a1a1aa', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: price === 30 ? '超賣' : '超買' }));
      // Use actual dates: indicator warm-up makes logical bar indexes differ.
      let syncing = false;
      chart.timeScale().subscribeVisibleTimeRangeChange(range => {
        if (range && !syncing) { syncing = true; try { rsiChart?.timeScale().setVisibleRange(range); } finally { syncing = false; } }
      });
      rsiChart.timeScale().subscribeVisibleTimeRangeChange(range => {
        if (range && !syncing) { syncing = true; try { chart.timeScale().setVisibleRange(range); } finally { syncing = false; } }
      });
    }
    chart.timeScale().fitContent();
    const resize = new ResizeObserver(() => {
      if (chartContainerRef.current) chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      if (rsiChart && rsiContainerRef.current) rsiChart.applyOptions({ width: rsiContainerRef.current.clientWidth });
    });
    resize.observe(chartContainerRef.current);
    return () => { resize.disconnect(); chart.remove(); rsiChart?.remove(); };
  }, [bars, settings, levels, threshold, trades, cost]);

  const matchingDates = new Set(bars?.map(b => b.tradingDate));
  const unmatchedCount = trades.filter(t => !matchingDates.has(t.date)).length;
  return <div className="p-4 sm:p-6 bg-zinc-950 text-zinc-100 min-h-screen font-sans">
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center gap-4 mb-6">
        {onBack && <button onClick={onBack} className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm">← 返回總覽</button>}
        <h1 className="text-2xl font-bold">{displayName} <span className="text-base font-normal text-zinc-400">{instrument?.market}</span></h1>
        <div className="ml-auto">{headerActions}</div>
      </div>
      <div className="flex flex-col gap-4 mb-4">
        <SymbolPicker onSelect={loadData} defaultSymbol={initialSymbol || '2330'} defaultMarket={initialMarket || 'TWSE'} />
        <IndicatorControls settings={settings} onChange={setSettings} />
      </div>
      {loading && <p role="status" className="mb-4 text-zinc-400">正在同步市場資料…</p>}
      {error && <p role="alert" className="mb-4 text-red-400">{error}</p>}
      {history && <p className="text-xs text-zinc-400 mb-3">行情日 {history.meta.latestTradingDate} · 擷取 {new Date(history.meta.fetchedAt).toLocaleString()} · 可能延遲{history.meta.warnings.map(w => ` · ${w}`)}</p>}
      {history && <section aria-label="持倉成本摘要" className="mb-4 text-sm">
        {costLoading ? <p role="status" className="text-zinc-400">正在讀取持倉成本…</p> : costError ? <p role="alert" className="text-amber-300">{costError}</p> : cost?.averageCost != null ? <>
          <p className="tabular-nums">目前持倉平均成本 <strong>{cost.averageCost.toFixed(4)} {cost.currency}</strong> · {cost.quantity.toLocaleString()} 股 · {cost.accounts} 個帳戶</p>
          <p className="text-xs text-zinc-400 mt-1">採 Wealthfolio 剩餘持倉帳面成本 ÷ 股數，費用與拆股處理依主程式；此線代表目前成本，不是每個歷史日期的成本。資料日 {cost.asOfDates.join('、') || '未提供'}。</p>
          {cost.asOfDates.length > 1 && <p className="text-xs text-amber-300 mt-1">各帳戶資料日期不同，合併結果可能尚未反映最新交易；請同步持倉後重新載入。</p>}
        </> : <div className="text-zinc-400">{cost && <p>目前持有 {cost.quantity.toLocaleString()} 股 · {cost.accounts} 個帳戶</p>}<p>{cost?.reason}</p></div>}
      </section>}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 mb-6 overflow-hidden">
        <ChartLegend settings={settings} hasStop={threshold !== null} hasCost={cost?.averageCost != null} />
        <div ref={chartContainerRef} className="w-full h-[400px]" />
        {settings.showRsi && <div className="border-t border-zinc-800"><div ref={rsiContainerRef} className="w-full h-[150px]" /></div>}
      </div>
      {history && instrument && <>
        <p className="text-xs text-zinc-400 mb-4">支撐／壓力橫線以最新交易日前 20 個已收盤交易日低／高點計算；不足 20 日不顯示。這是區間上下邊界；SMA20（MA20）則是含最新日 K 的 20 日收盤平均，盤中會變動。區間不等於均線，也不是歷史回測訊號。</p>
        <TrailingStopPanel key={instrument.providerSymbol} store={stopStore} state={stopState} instrument={instrument} displayName={displayName} refreshHistory={async () => {
          const id = generation.current;
          const fresh = await new YahooFinanceProvider(host).getHistory({ instrument, interval: '1d', priceBasis: 'provider-ohlc', from: new Date(Date.now() - 2 * 366 * 86400000).toISOString(), to: new Date().toISOString() });
          if (id !== generation.current) throw new Error('股票已切換，請重新設定');
          setHistory(fresh);
          return fresh;
        }} />
        <label className="text-sm text-zinc-300 block mb-3">Pivot 計算方式 <select className="ml-2 bg-zinc-800 border border-zinc-700 rounded-lg p-2" value={pivotType} onChange={e => setPivotType(e.target.value as PivotType)}><option value="classic">Classic</option><option value="fibonacci">Fibonacci</option></select></label>
        <PivotTable pivot={levels.pivot} baseDate={levels.baseDate} />
      </>}
      <section className="my-6" aria-label="實際買賣紀錄">
        <h2 className="font-medium mb-2">我的買賣紀錄</h2>
        <p className="text-xs text-zinc-400 mb-3">箭頭標示交易日期；成交價與股數依原始紀錄，未做拆股還原。只顯示已入帳且無待確認狀態的買賣，不含手續費。</p>
        {tradesLoading ? <p role="status">正在讀取交易紀錄…</p> : tradeError ? <p role="alert" className="text-red-400">{tradeError}</p> : !loading && !error && trades.length === 0 ? <p className="text-sm text-zinc-400">這檔股票沒有符合條件的買賣紀錄。</p> : null}
        {unmatchedCount > 0 && <p className="text-sm text-amber-300 mb-3">{unmatchedCount} 筆交易不在目前行情日期內，保留於下表，不移動到其他日期。</p>}
        {trades.length > 0 && <div className="overflow-x-auto max-h-80"><table className="w-full text-sm text-left tabular-nums"><thead className="text-zinc-400"><tr>{['日期', '買賣', '股數', '成交價', '帳戶'].map(label => <th className="p-2" key={label}>{label}</th>)}</tr></thead><tbody>{trades.map(t => <tr key={t.id} className="border-t border-zinc-800"><td className="p-2">{t.date}</td><td className="p-2" style={{ color: t.side === 'BUY' ? chartColors.buy : chartColors.sell }}>{t.side === 'BUY' ? '▲ 買入' : '▼ 賣出'}</td><td className="p-2">{t.quantity}</td><td className="p-2">{t.price.toFixed(2)} {t.currency}</td><td className="p-2">{t.account}</td></tr>)}</tbody></table></div>}
      </section>
    </div>
  </div>;
};
export default TechnicalAnalysisPage;
