import React, { useState, useMemo, useEffect, useRef } from 'react';
import { BIChart } from './Charts';
import { CalculationModule } from '../services/calculationModule';
import { Dataset, DataRow, FilterState, SchemaMapping, CalculatedField } from '../types';
import { MONTH_ORDER, WEEKDAY_ORDER } from '../constants';
import { EmailService, SmtpHealth } from '../services/emailService';
import { 
  Printer, Mail, Filter, X, AlertCircle, RotateCcw, 
  Loader2, Send, CheckCircle2, ShieldAlert
} from 'lucide-react';

interface Props {
  dataset: Dataset;
  onBack: () => void;
  onStartTour: () => void;
}

type ChartType = 'bar' | 'pie' | 'line' | 'scatter' | 'area' | 'composed';

interface ChartDefinition {
  id: string;
  title: string;
  description: string;
  type: ChartType;
  data: any[];
  dataKey?: string;
  secondaryDataKey?: string;
  categoryKey?: string;
  layout?: 'horizontal' | 'vertical';
  height?: number;
  span?: number;
}

export const Dashboard: React.FC<Props> = ({ dataset, onBack, onStartTour }) => {
  const dashboardRef = useRef<HTMLDivElement>(null);
  const [activeMapping, setActiveMapping] = useState<SchemaMapping>(dataset.mapping);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [calculatedFields, setCalculatedFields] = useState<CalculatedField[]>([]);
  
  // Email Modal States
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState(`InsightStream Raporu - ${dataset.name}`);
  const [emailMessage, setEmailMessage] = useState('');
  const [includePdf, setIncludePdf] = useState(true);
  const [emailLoading, setEmailLoading] = useState(false);
  const [healthStatus, setHealthStatus] = useState<SmtpHealth | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(false);

  const [filterState, setFilterState] = useState<FilterState>({
    years: "ALL", months: "ALL", cities: "ALL", branches: "ALL", categories: "ALL",
    genericFilters: {}
  });
  const [activeCharts, setActiveCharts] = useState<string[]>([]);
  const chartSelectionInitialized = useRef(false);

  const processedRows = useMemo(() => dataset.rows.map(r => CalculationModule.processRow(r, activeMapping, calculatedFields)), [dataset, activeMapping, calculatedFields]);
  const filteredRows = useMemo(() => CalculationModule.applyFilters(processedRows, filterState, activeMapping), [processedRows, filterState, activeMapping]);
  const kpis = useMemo(() => CalculationModule.getTotalKPIs(filteredRows), [filteredRows]);

  const filterSummary = useMemo(() => {
    const parts = [];
    if (filterState.years !== "ALL") parts.push(`Yıl: ${filterState.years.join(', ')}`);
    if (filterState.months !== "ALL") parts.push(`Ay: ${filterState.months.map(m => MONTH_ORDER[(m as any) - 1]).join(', ')}`);
    if (filterState.cities !== "ALL") parts.push(`Şehir: ${filterState.cities.join(', ')}`);
    if (filterState.branches !== "ALL") parts.push(`Şube: ${filterState.branches.join(', ')}`);
    if (filterState.categories !== "ALL") parts.push(`Kategori: ${filterState.categories.join(', ')}`);
    return parts.length > 0 ? parts.join(' | ') : 'Filtre: Tümü';
  }, [filterState]);

  useEffect(() => {
    setEmailMessage(`Merhaba,\n\nEkte ${dataset.name} veri seti için hazırlanan dashboard raporunu bulabilirsiniz.\n\nFiltreler: ${filterSummary}\n\nİyi çalışmalar,\nInsightStream Ekibi`);
  }, [dataset.name, filterSummary]);

  const checkHealth = async () => {
    setCheckingHealth(true);
    const health = await EmailService.getHealth();
    setHealthStatus(health);
    setCheckingHealth(false);
  };

  const generatePdfBase64 = async (): Promise<string | null> => {
    if (!dashboardRef.current) return null;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const canvas = await html2canvas(dashboardRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        ignoreElements: (el) => el.classList.contains('no-print')
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.8);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      return pdf.output('datauristring').split(',')[1];
    } catch (e) {
      console.error("PDF creation failed", e);
      return null;
    }
  };

  const handleSendEmail = async () => {
    if (!emailTo || !emailTo.includes('@')) {
      alert("Lütfen en az bir geçerli alıcı e-postası giriniz.");
      return;
    }

    setEmailLoading(true);
    let attachments = [];
    
    if (includePdf) {
      const pdfBase64 = await generatePdfBase64();
      if (pdfBase64) {
        attachments.push({
          filename: `InsightStream_Report_${dataset.name.replace(/\s+/g, '_')}.pdf`,
          content: pdfBase64,
          encoding: 'base64' as const
        });
      }
    }

    const htmlBody = `
      <div style="font-family: sans-serif; color: #1e293b; max-width: 600px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 20px;">
        <h2 style="color: #4f46e5; margin-bottom: 20px;">InsightStream BI Raporu</h2>
        <p style="white-space: pre-line; font-size: 14px; line-height: 1.6;">${emailMessage}</p>
        
        <div style="background: #f8fafc; padding: 20px; border-radius: 15px; margin: 25px 0;">
          <h3 style="margin-top: 0; font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">Metrik Özetleri</h3>
          <table width="100%" style="font-size: 14px;">
            <tr>
              <td style="padding: 5px 0;"><strong>Toplam Ciro:</strong> ₺${kpis.revenue.toLocaleString()}</td>
              <td style="padding: 5px 0;"><strong>Toplam Kâr:</strong> ₺${kpis.profit.toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0;"><strong>İşlem Sayısı:</strong> ${kpis.txns.toLocaleString()}</td>
              <td style="padding: 5px 0;"><strong>Satılan Birim:</strong> ${kpis.units.toLocaleString()}</td>
            </tr>
          </table>
        </div>

        <p style="font-size: 11px; color: #cbd5e1; text-align: center; margin-top: 30px; border-top: 1px solid #f1f5f9; padding-top: 15px;">
          Bu rapor InsightStream AI tarafından otomatik üretilmiştir.
        </p>
      </div>
    `;

    const res = await EmailService.sendWithAttachment({
      to: emailTo,
      subject: emailSubject,
      html: htmlBody,
      attachments
    });

    setEmailLoading(false);
    if (res.success) {
      alert(`Rapor başarıyla gönderildi! (${res.provider?.toUpperCase()})`);
      setShowEmailModal(false);
    } else {
      alert(`Hata: ${res.error}`);
    }
  };

  const options = useMemo(() => {
    const years = Array.from(new Set(processedRows.map(r => r['YEAR_final']).filter(Boolean))).sort((a: any, b: any) => b - a);
    const months = Array.from(new Set(processedRows.map(r => r['MONTH_index']).filter(Boolean))).sort((a: any, b: any) => a - b).map(m => ({ id: m, name: MONTH_ORDER[(m as any) - 1] }));
    const cities = Array.from(new Set(processedRows.map(r => r['CITY_final']).filter(Boolean))).sort();
    const branches = Array.from(new Set(processedRows.map(r => r['BRANCH_final']).filter(Boolean))).sort();
    const categories = Array.from(new Set(processedRows.map(r => r['CATEGORY_final']).filter(Boolean))).sort();
    return { years, months, cities, branches, categories };
  }, [processedRows]);

  const monthlyPerformance = useMemo(() => {
    return MONTH_ORDER.map((month, idx) => {
      const rows = filteredRows.filter(r => r._month === idx + 1);
      if (!rows.length) return null;
      const revenue = rows.reduce((sum, row) => sum + (row._revenue ?? row['REVENUE_final'] ?? 0), 0);
      const profit = rows.reduce((sum, row) => sum + (row._profit ?? row['PROFIT_final'] ?? 0), 0);
      return {
        label: month.slice(0, 3).toUpperCase(),
        value: revenue,
        profit,
        margin: revenue ? (profit / revenue) * 100 : 0,
      };
    }).filter(Boolean) as Array<{ label: string; value: number; profit: number; margin: number }>;
  }, [filteredRows]);

  const weekdayRhythm = useMemo(() => {
    return WEEKDAY_ORDER.map((day, idx) => {
      const rows = filteredRows.filter(r => r['WEEKDAY_index'] === idx + 1);
      if (!rows.length) return null;
      const revenue = rows.reduce((sum, row) => sum + (row._revenue ?? row['REVENUE_final'] ?? 0), 0);
      const txnCount = rows.reduce<{ seen: Set<string>; count: number }>((acc, row) => {
        const tx = row['TX_ID_final'];
        if (tx && !acc.seen.has(tx)) {
          acc.seen.add(tx);
          acc.count += 1;
        }
        return acc;
      }, { seen: new Set<string>(), count: 0 }).count || rows.length;
      return {
        label: day.slice(0, 3).toUpperCase(),
        value: txnCount,
        secondary: revenue,
      };
    }).filter(Boolean) as Array<{ label: string; value: number; secondary: number }>;
  }, [filteredRows]);

  const cityPerformance = useMemo(() => {
    const buckets: Record<string, { revenue: number; profit: number }> = {};
    filteredRows.forEach(row => {
      const city = row._city || row['CITY_final'] || 'Diğer';
      if (!buckets[city]) buckets[city] = { revenue: 0, profit: 0 };
      buckets[city].revenue += row._revenue ?? row['REVENUE_final'] ?? 0;
      buckets[city].profit += row._profit ?? row['PROFIT_final'] ?? 0;
    });
    return Object.entries(buckets)
      .map(([label, stats]) => ({
        label,
        value: stats.revenue,
        margin: stats.revenue ? (stats.profit / stats.revenue) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [filteredRows]);

  const branchRevenue = useMemo(() => {
    const buckets: Record<string, number> = {};
    filteredRows.forEach(row => {
      const branch = row._branch || row['BRANCH_final'] || 'Diğer';
      if (!buckets[branch]) buckets[branch] = 0;
      buckets[branch] += row._revenue ?? row['REVENUE_final'] ?? 0;
    });
    return Object.entries(buckets)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filteredRows]);

  const categoryMargin = useMemo(() => {
    const buckets: Record<string, { revenue: number; profit: number }> = {};
    filteredRows.forEach(row => {
      const category = row._category || row['CATEGORY_final'] || 'Diğer';
      if (!buckets[category]) buckets[category] = { revenue: 0, profit: 0 };
      buckets[category].revenue += row._revenue ?? row['REVENUE_final'] ?? 0;
      buckets[category].profit += row._profit ?? row['PROFIT_final'] ?? 0;
    });
    return Object.entries(buckets)
      .map(([label, stats]) => ({
        label,
        value: stats.revenue,
        margin: stats.revenue ? (stats.profit / stats.revenue) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 7);
  }, [filteredRows]);

  const basketTrend = useMemo(() => {
    return MONTH_ORDER.map((month, idx) => {
      const rows = filteredRows.filter(r => r._month === idx + 1);
      if (!rows.length) return null;
      const revenue = rows.reduce((sum, row) => sum + (row._revenue ?? row['REVENUE_final'] ?? 0), 0);
      const txnCount = rows.reduce<{ seen: Set<string>; count: number }>((acc, row) => {
        const tx = row['TX_ID_final'];
        if (tx && !acc.seen.has(tx)) {
          acc.seen.add(tx);
          acc.count += 1;
        }
        return acc;
      }, { seen: new Set<string>(), count: 0 }).count || rows.length;
      return {
        label: month.slice(0, 3).toUpperCase(),
        value: txnCount ? revenue / txnCount : 0,
      };
    }).filter(Boolean) as Array<{ label: string; value: number }>;
  }, [filteredRows]);

  const paretoData = useMemo(() => CalculationModule.getParetoData(filteredRows), [filteredRows]);
  const bubbleMatrix = useMemo(() => CalculationModule.getPriceQtyBubbleData(filteredRows), [filteredRows]);

  const chartDefinitions = useMemo<ChartDefinition[]>(() => {
    const defs: ChartDefinition[] = [];
    if (monthlyPerformance.length) {
      defs.push({
        id: 'monthly-performance',
        title: 'Aylık Gelir & Kâr',
        description: '12 aylık ciro ile kâr dalgalanmalarını birlikte takip edin.',
        type: 'bar',
        data: monthlyPerformance,
        dataKey: 'value',
        secondaryDataKey: 'profit',
        layout: 'horizontal',
        height: 360,
        span: 2,
      });
    }
    if (weekdayRhythm.length) {
      defs.push({
        id: 'weekday-rhythm',
        title: 'Haftanın Günlerine Göre Hacim',
        description: 'İşlem adedi ile gelir arasındaki ilişkiyi görün.',
        type: 'bar',
        data: weekdayRhythm,
        dataKey: 'value',
        secondaryDataKey: 'secondary',
        layout: 'horizontal',
        height: 320,
      });
    }
    if (categoryMargin.length) {
      defs.push({
        id: 'category-margin',
        title: 'Kategori Bazlı Karlılık',
        description: 'Hangi kategoriler ciroyu ve kâr marjını taşıyor?',
        type: 'bar',
        data: categoryMargin,
        dataKey: 'value',
        secondaryDataKey: 'margin',
        layout: 'vertical',
        height: 360,
      });
    }
    if (cityPerformance.length) {
      defs.push({
        id: 'city-share',
        title: 'İllere Göre Ciro Payı',
        description: 'Bölgesel dağılımdaki ağırlıkları takip edin.',
        type: 'pie',
        data: cityPerformance,
        dataKey: 'value',
        height: 320,
      });
    }
    if (basketTrend.length) {
      defs.push({
        id: 'basket-trend',
        title: 'Ortalama Sepet Tutarı',
        description: 'Aylık ortalama gelir/bilet trendi.',
        type: 'line',
        data: basketTrend,
        dataKey: 'value',
        height: 320,
      });
    }
    if (paretoData.length) {
      defs.push({
        id: 'pareto',
        title: 'Pareto Gelir Analizi',
        description: 'Gelirin yüzde kaçını ilk kategoriler getiriyor?',
        type: 'bar',
        data: paretoData,
        dataKey: 'value',
        secondaryDataKey: 'cumulativePercent',
        layout: 'horizontal',
        height: 340,
      });
    }
    if (bubbleMatrix.isFallback) {
      if (bubbleMatrix.fallbackData?.length) {
        defs.push({
          id: 'bubble-fallback',
          title: 'Kategori İşlem Payı',
          description: 'Ürün çeşitliliği az olduğundan kategori payı gösterildi.',
          type: 'bar',
          data: bubbleMatrix.fallbackData,
          dataKey: 'value',
          height: 320,
        });
      }
    } else if (bubbleMatrix.data?.length) {
      defs.push({
        id: 'price-elasticity',
        title: 'Fiyat-Volüm Balon Grafiği',
        description: 'Ürün fiyatı, adet ve kârlılık ilişkisi.',
        type: 'scatter',
        data: bubbleMatrix.data,
        height: 360,
      });
    }
    return defs;
  }, [monthlyPerformance, weekdayRhythm, categoryMargin, cityPerformance, basketTrend, paretoData, bubbleMatrix]);

  const chartLibrary = useMemo(() => {
    return chartDefinitions.reduce<Record<string, ChartDefinition>>((acc, def) => {
      if (def.data && def.data.length) acc[def.id] = def;
      return acc;
    }, {});
  }, [chartDefinitions]);
  const chartOptionsList = useMemo(() => Object.values(chartLibrary), [chartLibrary]);

  const chartSelectionKey = useMemo(() => `dashboardChartSelection:${dataset.name}`, [dataset.name]);
  const activeChartDefinitions = useMemo(() => activeCharts.map(id => chartLibrary[id]).filter((def): def is ChartDefinition => Boolean(def)), [activeCharts, chartLibrary]);

  useEffect(() => {
    chartSelectionInitialized.current = false;
    setActiveCharts([]);
  }, [chartSelectionKey]);

  useEffect(() => {
    if (chartSelectionInitialized.current) return;
    const availableIds = Object.keys(chartLibrary);
    if (!availableIds.length) return;
    const storedRaw = localStorage.getItem(chartSelectionKey);
    let initial: string[] = [];
    if (storedRaw) {
      try {
        const parsed = JSON.parse(storedRaw);
        if (Array.isArray(parsed)) initial = parsed.filter(id => availableIds.includes(id));
      } catch (err) {
        console.warn('Chart selection parse error', err);
      }
    }
    if (!initial.length) {
      initial = availableIds.slice(0, Math.min(3, availableIds.length));
    }
    setActiveCharts(initial);
    chartSelectionInitialized.current = true;
  }, [chartLibrary, chartSelectionKey]);

  useEffect(() => {
    if (!chartSelectionInitialized.current) return;
    const availableIds = new Set(Object.keys(chartLibrary));
    setActiveCharts(prev => {
      const filtered = prev.filter(id => availableIds.has(id));
      if (!filtered.length) {
        const fallback = Array.from(availableIds).slice(0, Math.min(3, availableIds.size));
        if (!fallback.length) return filtered;
        localStorage.setItem(chartSelectionKey, JSON.stringify(fallback));
        return fallback;
      }
      if (filtered.length !== prev.length) {
        localStorage.setItem(chartSelectionKey, JSON.stringify(filtered));
        return filtered;
      }
      localStorage.setItem(chartSelectionKey, JSON.stringify(filtered));
      return prev;
    });
  }, [chartLibrary, chartSelectionKey]);

  const toggleChartSelection = (id: string) => {
    setActiveCharts(prev => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev;
        const next = prev.filter(item => item !== id);
        localStorage.setItem(chartSelectionKey, JSON.stringify(next));
        return next;
      }
      const next = [...prev, id];
      localStorage.setItem(chartSelectionKey, JSON.stringify(next));
      return next;
    });
  };

  const moveChart = (id: string, direction: -1 | 1) => {
    setActiveCharts(prev => {
      const index = prev.indexOf(id);
      if (index === -1) return prev;
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= prev.length) return prev;
      const clone = [...prev];
      const [item] = clone.splice(index, 1);
      clone.splice(newIndex, 0, item);
      localStorage.setItem(chartSelectionKey, JSON.stringify(clone));
      return clone;
    });
  };

  const removeChart = (id: string) => {
    setActiveCharts(prev => {
      if (prev.length === 1) return prev;
      const next = prev.filter(item => item !== id);
      localStorage.setItem(chartSelectionKey, JSON.stringify(next));
      return next;
    });
  };

  // Fix: Narrowed down key type and used type assertion to resolve callability and iterability errors on line 165.
  const toggleFilter = (key: Exclude<keyof FilterState, 'genericFilters'>, val: any) => {
    setFilterState(prev => {
      const cur = prev[key];
      if (cur === "ALL") return { ...prev, [key]: [val] };
      // After handling "ALL", cur is guaranteed to be an array in this context.
      const arr = cur as any[];
      const next = arr.includes(val) ? arr.filter((v: any) => v !== val) : [...arr, val];
      return { ...prev, [key]: next.length === 0 ? "ALL" : next };
    });
  };

  const MultiSelectSlicer = ({ title, options, selected, onToggle, onClear }: any) => (
    <div className="pb-6 border-b border-slate-100 last:border-0 space-y-3">
      <div className="flex justify-between items down">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</label>
        <button onClick={onClear} className="text-[10px] text-indigo-500 font-bold hover:underline">Temizle</button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button onClick={onClear} className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${selected === "ALL" ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}>Tümü</button>
        {options.map((opt: any) => {
          const id = opt.id !== undefined ? opt.id : opt;
          const label = opt.name || opt;
          const active = selected !== "ALL" && selected.includes(id);
          return <button key={id} onClick={() => onToggle(id)} className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${active ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}>{label}</button>;
        })}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row" ref={dashboardRef}>
      <aside className="w-full lg:w-72 bg-white border-r border-slate-200 p-6 no-print overflow-y-auto lg:h-screen lg:sticky lg:top-0 shrink-0">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2"><Filter className="w-5 h-5 text-indigo-600" /><h2 className="font-black text-lg uppercase">Filtreler</h2></div>
          <button onClick={() => setFilterState({ years: "ALL", months: "ALL", cities: "ALL", branches: "ALL", categories: "ALL", genericFilters: {} })} className="p-2 text-slate-400 hover:text-indigo-600"><RotateCcw className="w-4 h-4" /></button>
        </div>
        <div className="space-y-2">
          <MultiSelectSlicer title="Yıl" options={options.years} selected={filterState.years} onToggle={(v:any)=>toggleFilter('years', v)} onClear={()=>setFilterState(p=>({...p, years:"ALL"}))} />
          <MultiSelectSlicer title="Ay" options={options.months} selected={filterState.months} onToggle={(v:any)=>toggleFilter('months', v)} onClear={()=>setFilterState(p=>({...p, months:"ALL"}))} />
          <MultiSelectSlicer title="Şehir" options={options.cities} selected={filterState.cities} onToggle={(v:any)=>toggleFilter('cities', v)} onClear={()=>setFilterState(p=>({...p, cities:"ALL"}))} />
          <MultiSelectSlicer title="Şube" options={options.branches} selected={filterState.branches} onToggle={(v:any)=>toggleFilter('branches', v)} onClear={()=>setFilterState(p=>({...p, branches:"ALL"}))} />
          <MultiSelectSlicer title="Kategori" options={options.categories} selected={filterState.categories} onToggle={(v:any)=>toggleFilter('categories', v)} onClear={()=>setFilterState(p=>({...p, categories:"ALL"}))} />
        </div>
      </aside>

      <div className="flex-1">
        <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 px-8 py-4 flex items-center justify-between no-print">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-xl transition-colors"><X className="w-5 h-5 text-slate-400" /></button>
            <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">{dataset.name}</h1>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => { setShowEmailModal(true); checkHealth(); }} 
              className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-700 shadow-lg shadow-indigo-100"
            >
              <Mail className="w-4 h-4" /> E-posta Gönder
            </button>
            <button onClick={() => window.print()} className="bg-white border border-slate-200 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-50">
              <Printer className="w-4 h-4" /> Yazdır
            </button>
          </div>
        </header>

        <main className="p-8 space-y-12">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {[
              { label: 'Ciro', value: `₺${kpis.revenue.toLocaleString()}`, color: 'text-indigo-600', icon: '💰', bg: 'bg-indigo-50' },
              { label: 'Kâr', value: `₺${kpis.profit.toLocaleString()}`, color: 'text-emerald-600', icon: '📈', bg: 'bg-emerald-50' },
              { label: 'Satılan Birim', value: kpis.units.toLocaleString(), color: 'text-orange-600', icon: '📦', bg: 'bg-orange-50' },
              { label: 'İşlem', value: kpis.txns.toLocaleString(), color: 'text-slate-600', icon: '🧾', bg: 'bg-slate-50' }
            ].map(k => (
              <div key={k.label} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex justify-between items-center group transition-all hover:shadow-lg">
                <div><p className="text-[10px] font-black text-slate-400 uppercase mb-1">{k.label}</p><h4 className={`text-3xl font-black ${k.color}`}>{k.value}</h4></div>
                <div className={`${k.bg} w-14 h-14 rounded-2xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform no-print`}>{k.icon}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-12">
              <BIChart id="monthly-profit" datasetId={dataset.name} title="AYLIK KÂR PERFORMANSI" type="line" data={CalculationModule.getForecastData(filteredRows)} height={400} />
            </div>
            <div className="lg:col-span-6">
              <BIChart id="category-tx" datasetId={dataset.name} title="KATEGORİ İŞLEM PAYI" type="bar" data={CalculationModule.getTransactionsByCategory(filteredRows)} layout="vertical" height={400} />
            </div>
            <div className="lg:col-span-6">
              <BIChart id="branch-rev" datasetId={dataset.name} title="ŞUBE BAZLI CİRO" type="bar" data={branchRevenue} height={400} />
            </div>
          </div>

        </main>
      </div>

      {/* EMAIL MODAL */}
      {showEmailModal && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm no-print animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8">
            <div className="p-8 bg-indigo-600 text-white flex justify-between items-center">
              <div className="flex items-center gap-3"><Mail className="w-6 h-6" /><h3 className="font-black uppercase text-sm tracking-widest">Dashboard'ı Gönder</h3></div>
              <button onClick={() => setShowEmailModal(false)}><X className="w-5 h-5" /></button>
            </div>

            <div className="p-8 space-y-4">
              <div className={`p-4 rounded-xl border flex flex-col gap-2 ${checkingHealth ? 'bg-slate-50 border-slate-100' : (healthStatus?.ok ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100')}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {checkingHealth ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : (healthStatus?.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <ShieldAlert className="w-4 h-4 text-rose-600" />)}
                    <span className="text-[10px] font-black uppercase text-slate-500">
                      Servis: {checkingHealth ? 'Kontrol ediliyor...' : (healthStatus?.providerMode?.toUpperCase() || 'Bağlantı Yok')}
                    </span>
                  </div>
                  {!checkingHealth && <button onClick={checkHealth} className="p-1.5 hover:bg-white rounded-lg transition-colors"><RotateCcw className="w-3.5 h-3.5 text-slate-400" /></button>}
                </div>
                {!checkingHealth && healthStatus && (
                  <p className="text-[10px] font-bold text-slate-500 leading-relaxed opacity-80">{healthStatus.hintTR}</p>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400">Alıcı(lar)</label>
                  <input 
                    type="text" 
                    value={emailTo} 
                    onChange={e => setEmailTo(e.target.value)} 
                    placeholder=" patron@sirket.com, analiz@is.com" 
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-bold mt-1 outline-none focus:ring-2 focus:ring-indigo-500" 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400">Konu</label>
                  <input type="text" value={emailSubject} onChange={e => setEmailSubject(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-bold mt-1 outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400">Mesaj</label>
                  <textarea rows={4} value={emailMessage} onChange={e => setEmailMessage(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-bold mt-1 outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <div className={`w-10 h-6 rounded-full p-1 transition-colors ${includePdf ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full transition-transform ${includePdf ? 'translate-x-4' : 'translate-x-0'}`}></div>
                    <input type="checkbox" className="hidden" checked={includePdf} onChange={e => setIncludePdf(e.target.checked)} />
                  </div>
                  <span className="text-xs font-black uppercase text-slate-600 tracking-tight">PDF Eki Ekle</span>
                </label>
              </div>
            </div>

            <div className="p-6 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setShowEmailModal(false)} className="px-6 py-3 text-slate-400 font-black uppercase text-xs">Vazgeç</button>
              <button 
                onClick={handleSendEmail} 
                disabled={emailLoading || !emailTo || !healthStatus?.ok}
                className="px-10 py-3 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-100 flex items-center gap-2 disabled:opacity-50"
              >
                {emailLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Gönder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
