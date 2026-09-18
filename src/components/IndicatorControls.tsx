import React from 'react';

export interface IndicatorSettings {
  showSma: boolean;
  showEma: boolean;
  showBb: boolean;
  showRsi: boolean;
}

interface Props {
  settings: IndicatorSettings;
  onChange: (settings: IndicatorSettings) => void;
}

export const IndicatorControls: React.FC<Props> = ({ settings, onChange }) => {
  const toggle = (key: keyof IndicatorSettings) => {
    onChange({ ...settings, [key]: !settings[key] });
  };

  return (
    <div className="flex flex-wrap gap-4 p-4 border border-zinc-800 rounded-xl bg-zinc-900 shadow-sm items-center text-sm">
      <span className="font-semibold text-zinc-400 uppercase tracking-wider text-xs">Indicators</span>
      <div className="h-4 w-px bg-zinc-800 mx-1"></div>
      
      <label className="flex items-center gap-2 cursor-pointer group">
        <input type="checkbox" checked={settings.showSma} onChange={() => toggle('showSma')} className="accent-blue-500 w-4 h-4 rounded border-zinc-700 bg-zinc-800" />
        <span className="text-zinc-300 group-hover:text-zinc-100 transition-colors">SMA (20)</span>
      </label>
      
      <label className="flex items-center gap-2 cursor-pointer group">
        <input type="checkbox" checked={settings.showEma} onChange={() => toggle('showEma')} className="accent-blue-500 w-4 h-4 rounded border-zinc-700 bg-zinc-800" />
        <span className="text-zinc-300 group-hover:text-zinc-100 transition-colors">EMA (20)</span>
      </label>
      
      <label className="flex items-center gap-2 cursor-pointer group">
        <input type="checkbox" checked={settings.showBb} onChange={() => toggle('showBb')} className="accent-blue-500 w-4 h-4 rounded border-zinc-700 bg-zinc-800" />
        <span className="text-zinc-300 group-hover:text-zinc-100 transition-colors">Bollinger (20, 2)</span>
      </label>
      
      <label className="flex items-center gap-2 cursor-pointer group">
        <input type="checkbox" checked={settings.showRsi} onChange={() => toggle('showRsi')} className="accent-blue-500 w-4 h-4 rounded border-zinc-700 bg-zinc-800" />
        <span className="text-zinc-300 group-hover:text-zinc-100 transition-colors">RSI (14)</span>
      </label>
    </div>
  );
};
