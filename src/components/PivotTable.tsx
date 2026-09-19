import React from 'react';
import { PivotResult } from '../indicators/pivot';

interface Props {
  pivot: PivotResult | null;
  baseDate: string;
}

export const PivotTable: React.FC<Props> = ({ pivot, baseDate }) => {
  if (!pivot) return <div className="p-4 border border-zinc-800 bg-zinc-900 rounded-xl text-zinc-500 text-sm">前一交易日資料不足，無法計算 Pivot 支撐／壓力。</div>;

  return (
    <div className="border border-zinc-800 rounded-xl shadow-sm bg-zinc-900 overflow-hidden">
      <div className="px-5 py-3 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-center">
        <h3 className="font-medium text-zinc-200">Pivot 支撐／壓力</h3>
        <span className="text-xs text-zinc-500">基準日 {baseDate} · 適用圖表最新交易日</span>
      </div>
      <div className="overflow-x-auto"><table className="w-full text-sm text-left whitespace-nowrap">
        <thead className="bg-zinc-800/50 text-zinc-400">
          <tr>
            <th className="px-5 py-3 font-medium">支撐 S3</th>
            <th className="px-5 py-3 font-medium">支撐 S2</th>
            <th className="px-5 py-3 font-medium">支撐 S1</th>
            <th className="px-5 py-3 font-medium text-blue-400">Pivot</th>
            <th className="px-5 py-3 font-medium">壓力 R1</th>
            <th className="px-5 py-3 font-medium">壓力 R2</th>
            <th className="px-5 py-3 font-medium">壓力 R3</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          <tr className="hover:bg-zinc-800/30 transition-colors">
            <td className="px-5 py-4 text-red-400/80">{pivot.s3.toFixed(2)}</td>
            <td className="px-5 py-4 text-red-400">{pivot.s2.toFixed(2)}</td>
            <td className="px-5 py-4 text-red-400">{pivot.s1.toFixed(2)}</td>
            <td className="px-5 py-4 font-bold text-blue-400">{pivot.p.toFixed(2)}</td>
            <td className="px-5 py-4 text-green-400">{pivot.r1.toFixed(2)}</td>
            <td className="px-5 py-4 text-green-400">{pivot.r2.toFixed(2)}</td>
            <td className="px-5 py-4 text-green-400/80">{pivot.r3.toFixed(2)}</td>
          </tr>
        </tbody>
      </table></div>
    </div>
  );
};
