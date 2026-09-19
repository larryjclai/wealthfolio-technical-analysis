import React, { useState, useMemo } from 'react';
import { StockAnalysis } from '../indicators/analysis';
import { WeekRangeBar } from './WeekRangeBar';

interface Props {
  analyses: StockAnalysis[];
  filtered?: boolean;
  onSelectStock: (symbol: string, market: string) => void;
}

type SortField = 'symbol' | 'currentPrice' | 'dayChangePct' | 'rsi14' | 'week52Position' | 'signals';
type SortDir = 'asc' | 'desc';

export const HoldingsTable: React.FC<Props> = ({ analyses, onSelectStock, filtered }) => {
  const [sortField, setSortField] = useState<SortField>('symbol');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir(field === 'symbol' ? 'asc' : 'desc');
    }
  };

  const sorted = useMemo(() => {
    return [...analyses].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'symbol': cmp = a.symbol.localeCompare(b.symbol); break;
        case 'currentPrice': cmp = a.currentPrice - b.currentPrice; break;
        case 'dayChangePct': cmp = a.dayChangePct - b.dayChangePct; break;
        case 'rsi14': cmp = (a.rsi14 ?? 0) - (b.rsi14 ?? 0); break;
        case 'week52Position': cmp = (a.week52Position ?? 0) - (b.week52Position ?? 0); break;
        case 'signals': cmp = a.signals.length - b.signals.length; break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [analyses, sortField, sortDir]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="text-zinc-600 ml-1">↕</span>;
    return <span className="text-zinc-300 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const formatPrice = (price: number) => {
    return price.toFixed(2);
  };

  const MaCell = ({ value, above, distPct }: { value: number | null; above: boolean | null; distPct: number | null }) => {
    if (value === null) return <td className="px-3 py-3 text-zinc-600 text-center">—</td>;
    const color = above ? 'text-green-400' : 'text-red-400';
    const arrow = above ? '▲' : '▼';
    return (
      <td className={`px-3 py-3 text-right tabular-nums text-xs`}>
        <div className={color}>
          {formatPrice(value)}
          <span className="text-[10px] ml-1">{arrow}</span>
        </div>
        {distPct !== null && (
          <div className="text-[10px] text-zinc-500">
            {distPct > 0 ? '+' : ''}{distPct.toFixed(1)}%
          </div>
        )}
      </td>
    );
  };

  const RsiCell = ({ value }: { value: number | null }) => {
    if (value === null) return <td className="px-3 py-3 text-zinc-600 text-center">—</td>;
    let color = 'text-zinc-300';
    let bg = '';
    if (value > 70) { color = 'text-red-400'; bg = 'bg-red-500/10'; }
    else if (value < 30) { color = 'text-green-400'; bg = 'bg-green-500/10'; }
    return (
      <td className={`px-3 py-3 text-right tabular-nums text-xs`}>
        <span className={`${color} ${bg} px-1.5 py-0.5 rounded`}>{value.toFixed(1)}</span>
      </td>
    );
  };

  if (analyses.length === 0) {
    return (
      <div className="text-center py-12 text-zinc-500">
        <p className="text-lg mb-2">{filtered ? '沒有符合篩選條件的股票' : '目前沒有可用的持倉分析'}</p>
        <p className="text-sm">{filtered ? '請清除或調整篩選條件' : '請確認持倉，或檢查上方的行情載入訊息'}</p>
      </div>
    );
  }

  return (
    <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-800/50 text-zinc-400 text-xs">
            <tr>
              <th className="px-3 py-3 text-left cursor-pointer hover:text-zinc-200 transition-colors" onClick={() => handleSort('symbol')}>
                股票 <SortIcon field="symbol" />
              </th>
              <th className="px-3 py-3 text-right cursor-pointer hover:text-zinc-200 transition-colors" onClick={() => handleSort('currentPrice')}>
                最新價 <SortIcon field="currentPrice" />
              </th>
              <th className="px-3 py-3 text-right cursor-pointer hover:text-zinc-200 transition-colors" onClick={() => handleSort('dayChangePct')}>
                漲跌% <SortIcon field="dayChangePct" />
              </th>
              <th className="px-3 py-3 text-right">20日區間支撐</th>
              <th className="px-3 py-3 text-right">20日區間壓力</th>
              <th className="px-3 py-3 text-right">MA20</th>
              <th className="px-3 py-3 text-right">MA60</th>
              <th className="px-3 py-3 text-right">MA120</th>
              <th className="px-3 py-3 text-right">MA240</th>
              <th className="px-3 py-3 text-right cursor-pointer hover:text-zinc-200 transition-colors" onClick={() => handleSort('rsi14')}>
                RSI <SortIcon field="rsi14" />
              </th>
              <th className="px-3 py-3 text-center cursor-pointer hover:text-zinc-200 transition-colors" onClick={() => handleSort('week52Position')}>
                52週範圍 <SortIcon field="week52Position" />
              </th>
              <th className="px-3 py-3 text-left cursor-pointer hover:text-zinc-200 transition-colors" onClick={() => handleSort('signals')}>
                訊號 <SortIcon field="signals" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {sorted.map((a) => (
              <tr
                key={`${a.market}:${a.symbol}`}
                className="hover:bg-zinc-800/30 cursor-pointer transition-colors"
                onClick={() => onSelectStock(a.symbol, a.market)}
              >
                {/* Stock name */}
                <td className="px-3 py-3">
                  <button className="font-medium text-zinc-100 flex items-center gap-1.5 text-left" onClick={event => { event.stopPropagation(); onSelectStock(a.symbol, a.market); }}>
                    {a.displayName && a.displayName !== a.symbol ? (
                      <>
                        <span className="truncate max-w-[140px]">{a.displayName}</span>
                        <span className="text-xs text-zinc-400 font-mono">({a.symbol})</span>
                      </>
                    ) : (
                      <span>{a.symbol}</span>
                    )}
                  </button>
                  <div className="text-[10px] text-zinc-500 font-mono">
                    {a.market}
                  </div>
                </td>
                {/* Current price */}
                <td className="px-3 py-3 text-right tabular-nums font-medium text-zinc-100">
                  {formatPrice(a.currentPrice)}
                  <div className="text-xs text-zinc-400 font-normal">{a.latestTradingDate}{a.provisional ? ' · 未收盤' : ''}</div>
                </td>
                {/* Day change */}
                <td className={`px-3 py-3 text-right tabular-nums text-xs font-medium ${
                  a.dayChangePct > 0 ? 'text-green-400' : a.dayChangePct < 0 ? 'text-red-400' : 'text-zinc-400'
                }`}>
                  {a.dayChangePct > 0 ? '+' : ''}{a.dayChangePct.toFixed(2)}%
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-cyan-300">{a.support?.toFixed(2) ?? '—'}</td>
                <td className="px-3 py-3 text-right tabular-nums text-orange-300">{a.resistance?.toFixed(2) ?? '—'}</td>
                {/* Moving Averages */}
                <MaCell value={a.sma20} above={a.aboveSma20} distPct={a.distSma20Pct} />
                <MaCell value={a.sma60} above={a.aboveSma60} distPct={a.distSma60Pct} />
                <MaCell value={a.sma120} above={a.aboveSma120} distPct={a.distSma120Pct} />
                <MaCell value={a.sma240} above={a.aboveSma240} distPct={a.distSma240Pct} />
                {/* RSI */}
                <RsiCell value={a.rsi14} />
                {/* 52-week range */}
                <td className="px-3 py-3">
                  <WeekRangeBar low={a.week52Low} high={a.week52High} current={a.currentPrice} />
                </td>
                {/* Signals */}
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1">
                    {a.signals.map((sig, i) => (
                      <span
                        key={i}
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          sig.sentiment === 'bullish'
                            ? 'bg-green-500/15 text-green-400'
                            : 'bg-red-500/15 text-red-400'
                        }`}
                      >
                        {sig.label}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
