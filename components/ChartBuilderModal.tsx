
import React, { useState, useMemo } from 'react';
import { Dataset, PinnedChart, CalculatedField } from '../types';
import { X, Save, BarChart3, PieChart, LineChart, Activity, Plus, Layout, ListFilter, MousePointer2, Calculator, AlertCircle } from 'lucide-react';
import { CalculationModule } from '../services/calculationModule';
import { BIChart } from './Charts';

interface Props {
  dataset: Dataset;
  calculatedFields: CalculatedField[];
  onSave: (chart: PinnedChart) => void;
  onClose: () => void;
}

export const ChartBuilderModal: React.FC<Props> = ({ dataset, calculatedFields, onSave, onClose }) => {
  const [title, setTitle] = useState('');
  const [dimension, setDimension] = useState(dataset.columns[0]);
  const [metric, setMetric] = useState<string>('revenue'); 
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie'>('bar');

  const metricOptions = useMemo(() => {
    const numericCols = dataset.profiles.filter(p => p.type === 'numeric').map(p => p.name);
    const calcNames = calculatedFields.map(f => f.name);
    return { numericCols, calcNames };
  }, [dataset, calculatedFields]);

  const previewData = useMemo(() => {
    if (!dimension || !metric) return [];
    
    const rows = dataset.rows.map(r => CalculationModule.processRow(r, dataset.mapping, calculatedFields));
    
    let groupKey = dimension;
    if (dimension === dataset.mapping.branch) groupKey = 'BRANCH_final';
    else if (dimension === dataset.mapping.city) groupKey = 'CITY_final';
    else if (dimension === dataset.mapping.category) groupKey = 'CATEGORY_final';
    else if (dimension === dataset.mapping.month) groupKey = 'MONTH_final';

    let metricKey = metric;
    if (metric === 'revenue') metricKey = 'REVENUE_final';
    else if (metric === 'profit') metricKey = 'PROFIT_final';
    else if (metric === 'units') metricKey = 'QTY_SOLD_final';
    else if (metric === 'transactions') metricKey = 'TX_ID_final';

    const agg: Record<string, any> = {};
    rows.forEach(r => {
      const k = String(r[groupKey] || r[dimension] || 'Diğer');
      if (!agg[k]) agg[k] = { label: k, value: metric === 'transactions' ? new Set() : 0 };
      
      if (metric === 'transactions') {
        agg[k].value.add(r['TX_ID_final'] || r[dataset.mapping.txId || '']);
      } else {
        const val = (r[metricKey] !== undefined) ? r[metricKey] : CalculationModule.normalizeNumeric(r[metric]);
        agg[k].value += val;
      }
    });

    return Object.values(agg)
      .map((x: any) => ({ 
        label: x.label, 
        value: metric === 'transactions' ? x.value.size : x.value 
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [dimension, metric, dataset, calculatedFields]);

  const canSave = title.trim().length > 0 && previewData.length > 0;

  const handleSave = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!title.trim()) {
        alert("Lütfen bir grafik başlığı giriniz.");
        return;
    }
    if (previewData.length === 0) {
        alert("Bu seçimlerle herhangi bir veri üretilemedi.");
        return;
    }

    onSave({
      id: `custom_${Date.now()}`,
      title: title.toUpperCase(),
      type: chartType,
      data: previewData,
      plan: { dimension, metric },
      createdAt: Date.now()
    });
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-6xl rounded-[3rem] shadow-[0_35px_60px_-15px_rgba(0,0,0,0.3)] overflow-hidden animate-in zoom-in duration-500 flex flex-col max-h-[95vh] relative">
        
        {/* HEADER */}
        <div className="p-6 sm:p-8 bg-indigo-600 text-white flex justify-between items-center shrink-0 z-10">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-2xl">
              <Layout className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black uppercase tracking-widest text-sm">Grafik Tasarımcısı</h3>
              <p className="text-[10px] text-indigo-100 font-bold opacity-70 uppercase tracking-tighter">Power BI / Custom Widget Builder</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-white/20 rounded-xl transition-all active:scale-90"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* SCROLLABLE BODY */}
        <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row bg-white">
          
          {/* LEFT SIDEBAR: CONFIG */}
          <div className="w-full lg:w-80 border-r border-slate-100 p-8 space-y-8 bg-slate-50/50 shrink-0">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2">
                <MousePointer2 className="w-3 h-3" /> Grafik Başlığı
              </label>
              <input 
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Örn: Bölge Bazlı Performans"
                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2">
                <ListFilter className="w-3 h-3" /> Boyut (X Ekseni)
              </label>
              <select 
                value={dimension}
                onChange={e => setDimension(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 cursor-pointer"
              >
                {dataset.columns.map(col => <option key={col} value={col}>{col}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2">
                <Activity className="text-indigo-500 w-3 h-3" /> Metrik (Y Ekseni)
              </label>
              <select 
                value={metric}
                onChange={e => setMetric(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 cursor-pointer"
              >
                <optgroup label="Standart Metrikler">
                    <option value="revenue">Toplam Ciro</option>
                    <option value="profit">Toplam Kâr</option>
                    <option value="units">Satılan Miktar</option>
                    <option value="transactions">İşlem Sayısı (Count)</option>
                </optgroup>
                {metricOptions.calcNames.length > 0 && (
                  <optgroup label="Hesaplı Alanlar">
                      {metricOptions.calcNames.map(name => <option key={name} value={name}>{name}</option>)}
                  </optgroup>
                )}
                <optgroup label="Veri Sütunları">
                    {metricOptions.numericCols.map(col => <option key={col} value={col}>{col}</option>)}
                </optgroup>
              </select>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase text-slate-400">Görselleştirme Tipi</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'bar', icon: <BarChart3 className="w-4 h-4" />, label: 'Bar' },
                  { id: 'line', icon: <LineChart className="w-4 h-4" />, label: 'Line' },
                  { id: 'pie', icon: <PieChart className="w-4 h-4" />, label: 'Pie' }
                ].map(type => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setChartType(type.id as any)}
                    className={`p-4 rounded-xl flex flex-col items-center gap-2 transition-all ${chartType === type.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-white border border-slate-200 text-slate-400 hover:border-indigo-300'}`}
                  >
                    {type.icon}
                    <span className="text-[8px] font-black uppercase tracking-widest">{type.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT CONTENT: PREVIEW */}
          <div className="flex-1 p-8 sm:p-12 flex flex-col bg-white">
            <div className="mb-8 flex items-center justify-between">
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300 mb-1">Anlık Önizleme</h4>
                  <p className="text-[9px] font-bold text-slate-400 italic">Seçimleriniz otomatik yansıtılır</p>
                </div>
                <div className="flex gap-2">
                    <div className="w-2 h-2 rounded-full bg-indigo-200 animate-pulse"></div>
                    <div className="w-2 h-2 rounded-full bg-indigo-100"></div>
                </div>
            </div>
            
            <div className="flex-1 min-h-[350px] bg-slate-50/30 rounded-[3rem] border-4 border-dashed border-slate-100 flex items-center justify-center p-4 sm:p-8">
              {previewData.length > 0 ? (
                <div className="w-full h-full max-w-3xl animate-in fade-in zoom-in duration-500 flex flex-col items-center">
                  <BIChart 
                    title={title || 'GRAFİK ÖNİZLEME'} 
                    type={chartType} 
                    data={previewData} 
                    height={300} 
                    minimal={true}
                  />
                  <div className="mt-8 flex gap-4 text-[9px] font-black text-slate-300 uppercase tracking-widest">
                    <span>{dimension} (Boyut)</span>
                    <span>•</span>
                    <span>{metric} (Metrik)</span>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-4 opacity-30">
                  <BarChart3 className="w-16 h-16 mx-auto animate-bounce text-slate-400" />
                  <p className="font-black uppercase text-xs tracking-widest">Seçim Bekleniyor...</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* STICKY FOOTER */}
        <div className="p-6 sm:p-8 bg-white border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0 z-20 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
          <div className="flex items-center gap-3">
             {!canSave && (
               <div className="flex items-center gap-2 text-amber-500 bg-amber-50 px-4 py-2 rounded-xl animate-in fade-in slide-in-from-left-4">
                 <AlertCircle className="w-4 h-4" />
                 <span className="text-[10px] font-black uppercase tracking-widest">
                   {!title.trim() ? 'Başlık Gerekli' : 'Veri Seçimi Gerekli'}
                 </span>
               </div>
             )}
          </div>
          
          <div className="flex gap-4 w-full sm:w-auto">
            <button 
              type="button"
              onClick={onClose} 
              className="flex-1 sm:flex-none px-10 py-5 text-slate-400 font-black uppercase text-xs tracking-widest hover:text-slate-600 transition-colors"
            >
              Vazgeç
            </button>
            <button 
              type="button"
              onClick={handleSave} 
              disabled={!canSave}
              className={`flex-1 sm:flex-none px-12 py-5 rounded-[1.5rem] text-xs font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all transform active:scale-95 shadow-2xl ${
                canSave 
                ? 'bg-indigo-600 text-white shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-1' 
                : 'bg-slate-100 text-slate-300 cursor-not-allowed'
              }`}
            >
              <Plus className="w-5 h-5" /> Dashboard'a Ekle
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
