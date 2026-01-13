
import React, { useState, useMemo, useEffect } from 'react';
import { CalculationModule } from '../services/calculationModule';
import { HistoryService } from '../services/historyService';
import { Dataset, SchemaMapping, FilterState } from '../types';
import { BIChart } from './Charts';
import { TrendingUp, Calculator, RefreshCw, AlertCircle, Info, Save } from 'lucide-react';

interface Props {
  dataset: Dataset;
  filterState: FilterState;
}

const formatCurrencyCompact = (value: number) => {
  if (!Number.isFinite(value)) return '₺0';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  const units = [
    { divider: 1_000_000_000, suffix: 'B' },
    { divider: 1_000_000, suffix: 'M' },
    { divider: 1_000, suffix: 'K' },
  ];
  for (const unit of units) {
    if (abs >= unit.divider) {
      return `${sign}₺${(abs / unit.divider).toFixed(1)}${unit.suffix}`;
    }
  }
  return `${sign}₺${abs.toLocaleString('tr-TR')}`;
};

export const SimulationPage: React.FC<Props> = ({ dataset, filterState }) => {
  const [category, setCategory] = useState('ALL');
  const [priceChange, setPriceChange] = useState(0);
  const [marginChange, setMarginChange] = useState(0);

  const categories = useMemo(() => 
    ['ALL', ...Array.from(new Set(dataset.rows.map(r => r[dataset.mapping.category || ''] || 'Kategorisiz')))], 
    [dataset]
  );

  const processedRows = useMemo(() => 
    dataset.rows.map(r => CalculationModule.processRow(r, dataset.mapping)), 
    [dataset]
  );

  const results = useMemo(() => 
    CalculationModule.runSimulation(processedRows, category, priceChange, marginChange),
    [processedRows, category, priceChange, marginChange]
  );

  const handleSaveSimulation = () => {
    HistoryService.saveRecord(dataset.name, {
      type: 'simulation',
      datasetId: dataset.name,
      titleTR: `Simülasyon: ${category === 'ALL' ? 'Tüm Kategoriler' : category} (${priceChange}% Fiyat, ${marginChange}% Marj)`,
      filterStateSnapshot: filterState,
      payload: results
    });
    alert("Simülasyon sonucu geçmişe kaydedildi.");
  };

  const diffRev = ((results.scenario.revenue - results.base.revenue) / results.base.revenue) * 100;
  const diffProfit = ((results.scenario.profit - results.base.profit) / results.base.profit) * 100;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">What-if Simülasyon</h2>
          <p className="text-slate-500 text-sm">Fiyat ve kâr marjı değişimlerinin iş performansına etkisini analiz edin.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleSaveSimulation}
            className="flex items-center gap-2 bg-indigo-50 px-4 py-2 rounded-xl text-indigo-600 border border-indigo-100 font-black uppercase text-[10px] tracking-widest hover:bg-indigo-100 transition-all"
          >
            <Save className="w-3.5 h-3.5" /> Sonucu Kaydet
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6 items-start">
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <Calculator className="w-5 h-5 text-indigo-600" />
              <h3 className="font-black text-xs uppercase tracking-widest text-slate-400">Parametreler</h3>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400">Ürün Kategorisi</label>
              <select 
                value={category} 
                onChange={e => setCategory(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black uppercase text-slate-400">Fiyat Değişimi (%)</label>
                <span className={`text-xs font-black ${priceChange > 0 ? 'text-emerald-500' : priceChange < 0 ? 'text-rose-500' : 'text-slate-500'}`}>
                  {priceChange > 0 ? '+' : ''}{priceChange}%
                </span>
              </div>
              <input 
                type="range" min="-20" max="20" step="1" 
                value={priceChange} 
                onChange={e => setPriceChange(Number(e.target.value))}
                className="w-full accent-indigo-600"
              />
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black uppercase text-slate-400">Kâr Marjı Değişimi (%)</label>
                <span className={`text-xs font-black ${marginChange > 0 ? 'text-emerald-500' : marginChange < 0 ? 'text-rose-500' : 'text-slate-500'}`}>
                  {marginChange > 0 ? '+' : ''}{marginChange}%
                </span>
              </div>
              <input 
                type="range" min="-10" max="10" step="0.5" 
                value={marginChange} 
                onChange={e => setMarginChange(Number(e.target.value))}
                className="w-full accent-indigo-600"
              />
            </div>

            <button 
              onClick={() => { setPriceChange(0); setMarginChange(0); setCategory('ALL'); }}
              className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors"
            >
              <RefreshCw className="w-3 h-3" /> Sıfırla
            </button>
          </div>

          {!dataset.mapping.margin && (
            <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex gap-3 items-start">
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
              <p className="text-[10px] font-bold text-amber-700 leading-relaxed uppercase">
                UYARI: Veri setinizde 'Marj' sütunu otomatik eşleşmediği için kâr senaryoları varsayılan tahminler üzerinden yürütülmektedir.
              </p>
            </div>
          )}
        </div>

        <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tahmini Ciro Etkisi</p>
                <h4 className="text-3xl font-black text-indigo-600">{formatCurrencyCompact(results.scenario.revenue)}</h4>
              <p className={`text-xs font-black mt-2 ${diffRev >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {diffRev >= 0 ? '↑' : '↓'} %{Math.abs(diffRev).toFixed(1)} Değişim
              </p>
            </div>
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tahmini Kâr Etkisi</p>
                <h4 className="text-3xl font-black text-emerald-600">{formatCurrencyCompact(results.scenario.profit)}</h4>
              <p className={`text-xs font-black mt-2 ${diffProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {diffProfit >= 0 ? '↑' : '↓'} %{Math.abs(diffProfit).toFixed(1)} Değişim
              </p>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden w-full min-h-[360px]">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">Baz vs Senaryo Karşılaştırması</h3>
            <div className="relative w-full min-h-[320px] md:min-h-[380px]">
                <BIChart 
                  title="" 
                  type="bar" 
                  data={[
                     { label: 'Ciro', base: results.base.revenue, scn: results.scenario.revenue },
                     { label: 'Kâr', base: results.base.profit, scn: results.scenario.profit }
                  ]}
                  dataKey="base"
                  secondaryDataKey="scn"
                  height={320}
                  valueFormatter={(val) => formatCurrencyCompact(val)}
                  mergeAxes
                  yAxisDomain={[850000, (max: number) => Math.ceil(max * 1.05)]}
                  chartMargin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                />
            </div>
            <div className="flex justify-center gap-6 mt-4">
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-indigo-600 rounded-full"></div><span className="text-[10px] font-black uppercase">Baz Değer</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-rose-500 rounded-full"></div><span className="text-[10px] font-black uppercase">Senaryo Değeri</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
