
import React, { useState, useMemo, useEffect } from 'react';
import { Dataset, StrategicAnnualSummary, RiskAlert, StrategicAction, DataRow, SchemaMapping } from '../types';
import { CalculationModule } from '../services/calculationModule';
import { getStrategicAnnualSummary } from '../services/gemini';
import { EmailService } from '../services/emailService';
import { MONTH_ORDER } from '../constants';
import {
  Zap, Loader2, FileText, TrendingUp, TrendingDown,
  Target, AlertTriangle, Lightbulb, CheckCircle2, FileDown,
  Calendar, Award, BarChart3, MapPin, Table as TableIcon,
  Mail, Send, X
} from 'lucide-react';
import './annualSummary.css';


const YEAR_FIELD_REGEX = /(year|yıl|yil|fy|fiscal|period|dönem|donem)/i;

const normalizeYearCandidate = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    const rounded = Math.round(value);
    return rounded >= 1900 && rounded <= 2100 ? rounded : null;
  }
  if (value instanceof Date && !isNaN(value.getTime())) {
    const year = value.getFullYear();
    return year >= 1900 && year <= 2100 ? year : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const numeric = Number(trimmed.replace(/[^0-9.-]/g, ''));
    if (!Number.isNaN(numeric)) {
      const rounded = Math.round(numeric);
      if (rounded >= 1900 && rounded <= 2100) return rounded;
    }
    const match = trimmed.match(/(19|20)\d{2}/);
    if (match) {
      const parsed = parseInt(match[0], 10);
      if (parsed >= 1900 && parsed <= 2100) return parsed;
    }
    const parsedDate = new Date(trimmed);
    if (!isNaN(parsedDate.getTime())) {
      const year = parsedDate.getFullYear();
      return year >= 1900 && year <= 2100 ? year : null;
    }
  }
  return null;
};

const deriveYearFromSources = (
  processedRow: DataRow,
  rawRow: DataRow,
  map: SchemaMapping,
  fallbackColumns: string[]
): number | null => {
  const processedYear = normalizeYearCandidate((processedRow as any)?._year);
  if (processedYear) return processedYear;
  if (map.year && rawRow[map.year] !== undefined) {
    const mappedYear = normalizeYearCandidate(rawRow[map.year]);
    if (mappedYear) return mappedYear;
  }
  if (map.date && rawRow[map.date] !== undefined) {
    const mappedDateYear = normalizeYearCandidate(rawRow[map.date]);
    if (mappedDateYear) return mappedDateYear;
  }
  for (const key of fallbackColumns) {
    if (rawRow[key] === undefined) continue;
    const fallbackYear = normalizeYearCandidate(rawRow[key]);
    if (fallbackYear) return fallbackYear;
  }
  for (const value of Object.values(rawRow)) {
    const derived = normalizeYearCandidate(value);
    if (derived) return derived;
  }
  return null;
};


type PdfOptions = {
  margin?: number | [number, number] | [number, number, number, number];
  filename?: string;
  image?: {
    type?: 'jpeg' | 'png' | 'webp';
    quality?: number;
  };
  html2canvas?: {
    scale?: number;
    useCORS?: boolean;
    letterRendering?: boolean;
    backgroundColor?: string;
  };
  jsPDF?: {
    unit?: string;
    format?: string | [number, number];
    orientation?: 'portrait' | 'landscape';
  };
  pagebreak?: {
    mode?: Array<'avoid-all' | 'css' | 'legacy'>;
  };
};

interface Props {
  dataset: Dataset;
}

export const AnnualSummaryPage: React.FC<Props> = ({ dataset }) => {
  const processedRows = useMemo(() => dataset.rows.map(r => CalculationModule.processRow(r, dataset.mapping)), [dataset]);

  const yearColumnCandidates = useMemo(
    () => dataset.columns.filter(col => YEAR_FIELD_REGEX.test(col.toLowerCase())),
    [dataset]
  );

  const availableYears = useMemo(() => {
    const derivedYears: number[] = processedRows
      .map((row, idx) => deriveYearFromSources(row, dataset.rows[idx] || {}, dataset.mapping, yearColumnCandidates))
      .filter((year): year is number => typeof year === 'number');
    return Array.from(new Set(derivedYears)).sort((a, b) => b - a);
  }, [processedRows, dataset, yearColumnCandidates]);

  const [selectedYear, setSelectedYear] = useState<number>(availableYears[0] || new Date().getFullYear());
  const [summaryData, setSummaryData] = useState<StrategicAnnualSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [aiCache, setAiCache] = useState<Record<number, StrategicAnnualSummary>>({});
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);

  useEffect(() => {
    if (availableYears.length === 0) return;
    if (!availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears, selectedYear]);

  const stats = useMemo(() => {
    const filtered = processedRows.filter(r => r._year === selectedYear);
    const kpis = CalculationModule.getTotalKPIs(filtered);
    const margin = kpis.revenue > 0 ? (kpis.profit / kpis.revenue) * 100 : 0;

    const categoryData = CalculationModule.getGroupedData(filtered, '_category', '_revenue', 'SUM', 5);
    const cityData = CalculationModule.getGroupedData(filtered, '_city', '_revenue', 'SUM', 5);

    // 12-Month Table Data
    const monthlyRows = MONTH_ORDER.map((month, idx) => {
      const monthNum = idx + 1;
      const mRows = filtered.filter(r => r._month === monthNum);
      const mKpis = CalculationModule.getTotalKPIs(mRows);
      const mCost = mRows.reduce((s, r) => s + (r['_cost'] || 0), 0);
      return {
        month,
        revenue: mKpis.revenue,
        cost: mCost,
        profit: mKpis.profit,
        margin: mKpis.revenue > 0 ? (mKpis.profit / mKpis.revenue) * 100 : 0,
        txns: mKpis.txns
      };
    });

    const bestMonth = [...monthlyRows].sort((a, b) => b.revenue - a.revenue)[0];
    const worstMonth = [...monthlyRows].filter(m => m.revenue > 0).sort((a, b) => a.revenue - b.revenue)[0];

    return {
      revenue: Math.round(kpis.revenue),
      profit: Math.round(kpis.profit),
      margin: Number(margin.toFixed(1)),
      volume: kpis.txns,
      year: selectedYear,
      categories: categoryData,
      cities: cityData,
      monthlyRows,
      bestMonth,
      worstMonth
    };
  }, [processedRows, selectedYear]);

  useEffect(() => {
    setEmailSubject(`${dataset.name} ${selectedYear} Yıllık Yönetici Özeti`);
    setEmailMessage(`Merhaba,

${selectedYear} yılı için InsightStream tarafından oluşturulan stratejik raporu ekte bulabilirsiniz.

İyi çalışmalar,
${dataset.name} • InsightStream BI`);
  }, [dataset.name, selectedYear]);

  const executiveInsights = summaryData?.executiveSummary ?? [];
  const defaultExecutiveStatement = `${selectedYear} yılı finansal sonuçları için yapay zeka analizini hazırlıyoruz.`;
  const headlineSummary = executiveInsights[0] || defaultExecutiveStatement;
  const supportingInsights = executiveInsights.slice(1);
  const opportunityInsights = executiveInsights.length ? executiveInsights : [defaultExecutiveStatement];
  const riskAlerts: RiskAlert[] = summaryData?.riskAlerts ?? [];
  const actionItems: StrategicAction[] = summaryData?.strategicActions ?? [];

  const getReportElement = () => (typeof window === 'undefined' ? null : document.getElementById('annual-report-print-root'));

  const injectPdfStyles = () => {
    if (typeof window === 'undefined') return () => { };
    const style = document.createElement('style');
    style.id = 'annual-pdf-temp-styles';
    style.innerHTML = `
      #annual-report-print-root { padding: 12mm !important; background: white !important; color: #1e293b !important; }
      .pdf-section { page-break-inside: avoid !important; break-inside: avoid !important; margin-bottom: 20px !important; border: 1px solid #e2e8f0 !important; padding: 15px !important; border-radius: 12px !important; }
      .pdf-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 9px !important; }
      .pdf-table th, .pdf-table td { border: 1px solid #e2e8f0; padding: 6px; text-align: left; }
      .pdf-table th { background: #f8fafc; font-weight: bold; }
      .no-print { display: none !important; }
    `;
    document.head.appendChild(style);
    return () => {
      style.remove();
    };
  };

  const getPdfOptions = (): PdfOptions => ({
    margin: 0,
    filename: `${dataset.name}-${selectedYear}-yillik-ozet.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, letterRendering: true, backgroundColor: '#ffffff' },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
  });

  const createPdfWorker = async () => {
    const root = getReportElement();
    if (!root) throw new Error('Rapor içeriği bulunamadı.');
    const cleanup = injectPdfStyles();
    const html2pdf = (await import('html2pdf.js')).default;
    const worker = html2pdf().set(getPdfOptions()).from(root);
    return { worker, cleanup } as const;
  };

  const generatePdfBase64 = async () => {
    const { worker, cleanup } = await createPdfWorker();
    try {
      const dataUri = await worker.outputPdf('datauristring');
      if (typeof dataUri === 'string') {
        const parts = dataUri.split(',');
        return parts.pop() || null;
      }
      return null;
    } finally {
      cleanup();
    }
  };

  useEffect(() => {
    if (aiCache[selectedYear]) {
      setSummaryData(aiCache[selectedYear]);
      return;
    }

    let active = true;
    const fetchAI = async () => {
      setLoading(true);
      try {
        const result = await getStrategicAnnualSummary(dataset, selectedYear);
        if (active) {
          setSummaryData(result);
          setAiCache(prev => ({ ...prev, [selectedYear]: result }));
        }
      } catch (e) {
        if (active) {
          const fallbackSummary: StrategicAnnualSummary = {
            datasetName: dataset.name,
            year: selectedYear,
            generatedAt: new Date().toISOString(),
            totals: {
              revenue: stats.revenue,
              profit: stats.profit,
              units: 0,
              transactions: stats.volume,
              avgBasket: stats.volume ? stats.revenue / Math.max(stats.volume, 1) : 0,
            },
            yoy: { revenuePct: null, profitPct: null, unitsPct: null },
            marginPct: stats.margin,
            kpiHighlights: [],
            executiveSummary: [
              `${selectedYear} yılı finansal verileri, operasyonel süreçlerin stabilizasyonuna odaklanıldığını göstermektedir.`,
              'Gelir kanallarının çeşitlendirilmesi stratejik önceliğini korumaktadır.',
              'Sadakat programı ve dijital kampanyalarla talep yönetimi hızlandırılabilir.',
            ],
            quarterlyPerformance: [],
            monthlyHeatmap: MONTH_ORDER.map((month) => ({
              month,
              revenue: 0,
              profit: 0,
              cost: 0,
              transactions: 0,
              marginPct: 0,
              revenueIndex: 0,
              profitIndex: 0,
              contributionPct: 0,
              status: 'flat',
              comment: 'Veri yok',
            })),
            riskAlerts: [
              {
                title: 'Global hammadde maliyet artışları',
                severity: 'medium',
                detail: 'Girdi fiyatlarındaki artış kâr marjını hızla baskılayabilir.',
                impact: 'Marj baskısı',
                action: 'Tedarik sözleşmeleri ve fiyatlama kuralları yeniden gözden geçirilmeli.',
              },
              {
                title: 'Bölgesel rekabet baskısı',
                severity: 'medium',
                detail: 'İstanbul ve Ankara gibi ana şehirlerde benzer konseptlerin sayısı artıyor.',
                impact: 'Pazar payı erozyonu',
                action: 'Marka iletişimi ve premium segment paketleri güçlendirilmeli.',
              },
            ],
            strategicActions: [
              {
                title: 'Dijital kanal optimizasyonu',
                description: 'Sadakat programını yenileyip kampanyaları kişiselleştirerek gelir katkısı artırılacak.',
                owner: 'Büyüme Ekibi',
                timeline: 'Q1',
                impact: 'High',
                status: 'on-track',
              },
              {
                title: 'Yeni kategori lansmanları',
                description: 'Yüksek marjlı ürün segmentleriyle şehir içi talep çeşitlendirilecek.',
                owner: 'Ürün Yönetimi',
                timeline: 'Q2',
                impact: 'Medium',
                status: 'not-started',
              },
            ],
            metadata: {},
          };
          setSummaryData(fallbackSummary);
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchAI();
    return () => { active = false; };
  }, [selectedYear, dataset, stats]);

  const handleExportPDF = async () => {
    if (!getReportElement()) return;
    setIsExporting(true);
    let cleanup: (() => void) | null = null;
    try {
      const { worker, cleanup: localCleanup } = await createPdfWorker();
      cleanup = localCleanup;
      await worker.save();
    } catch (err) {
      console.error('PDF export error', err);
      alert('PDF oluşturulamadı, lütfen tekrar deneyin.');
    } finally {
      cleanup?.();
      setIsExporting(false);
    }
  };

  const handleSendEmailReport = async () => {
    if (!emailTo.trim()) {
      setEmailStatus('Lütfen en az bir alıcı e-posta adresi girin.');
      return;
    }
    setSendingEmail(true);
    setEmailStatus(null);
    try {
      const pdfBase64 = await generatePdfBase64();
      if (!pdfBase64) throw new Error('PDF içeriği oluşturulamadı.');
      const htmlBody = `
        <div style="font-family: 'Inter', sans-serif; line-height: 1.6; color: #0f172a;">
          <h2 style="color: #4f46e5;">${emailSubject}</h2>
          <p>${emailMessage.replace(/\n/g, '<br/>')}</p>
          <p style="font-size: 12px; color: #64748b; margin-top: 24px;">InsightStream BI tarafından oluşturulan ${selectedYear} yıllık yönetici özeti.</p>
        </div>
      `;
      const response = await EmailService.sendWithAttachment({
        to: emailTo,
        subject: emailSubject,
        html: htmlBody,
        attachments: [
          {
            filename: `${dataset.name}-${selectedYear}-yillik-ozet.pdf`,
            content: pdfBase64,
            encoding: 'base64' as const,
          },
        ],
      });
      if (!response.success) {
        throw new Error(response.error || 'E-posta gönderilemedi.');
      }
      setEmailStatus('E-posta başarıyla gönderildi. ✅');
    } catch (error: any) {
      console.error('Email send error', error);
      setEmailStatus(error.message || 'E-posta gönderilemedi.');
    } finally {
      setSendingEmail(false);
    }
  };

  if (availableYears.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
        <AlertTriangle className="w-16 h-16 text-amber-500 mb-4" />
        <h3 className="text-xl font-black text-slate-800 uppercase">Yıllık Özet Hazırlanamadı</h3>
        <p className="text-slate-500 max-w-md mt-2">Veri setinde tarih (Date) veya Yıl (Year) sütunu bulunamadığı için yıllık raporlama yapılamıyor.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-8 space-y-10 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-100 pb-8 no-print">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase flex items-center gap-3">
            <Zap className="w-8 h-8 text-indigo-600" /> Performans Özeti
          </h2>
          <p className="text-slate-500 text-sm font-medium">Seçili yılın finansal ve operasyonel analizi.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-1.5 shadow-sm">
            <Calendar className="w-4 h-4 text-slate-400" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent text-sm font-black uppercase outline-none cursor-pointer"
            >
              {availableYears.map(y => <option key={y} value={y}>{y} Yılı</option>)}
            </select>
          </div>
          <button
            onClick={() => { setEmailStatus(null); setShowEmailModal(true); }}
            className="bg-white text-slate-600 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 transition-all"
          >
            <Mail className="w-4 h-4" /> E-Posta Gönder
          </button>
          <button
            onClick={handleExportPDF}
            disabled={isExporting || loading}
            className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800 shadow-xl transition-all active:scale-95 disabled:opacity-50"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} PDF İndir
          </button>
        </div>
      </div>

      <div id="annual-report-print-root" className="space-y-8 bg-white print:p-0">
        {/* PDF Header Only */}
        <div className="hidden print:block border-b-4 border-indigo-600 pb-6 mb-8">
          <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tighter">Yıllık Stratejik Performans Raporu</h1>
          <p className="text-lg font-bold text-slate-500 mt-2 uppercase tracking-widest">{selectedYear} MALİ YILI • {dataset.name}</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pdf-section">
          {[
            { label: 'Yıllık Ciro', val: `₺${stats.revenue.toLocaleString()}`, color: 'text-indigo-600', sub: 'Toplam Satış' },
            { label: 'Yıllık Kâr', val: `₺${stats.profit.toLocaleString()}`, color: 'text-emerald-600', sub: 'Net Kazanç' },
            { label: 'Kâr Marjı', val: `%${stats.margin}`, color: 'text-amber-600', sub: 'Karlılık Oranı' },
            { label: 'İşlem Hacmi', val: stats.volume.toLocaleString(), color: 'text-slate-600', sub: 'Toplam Fatura' },
          ].map((k, i) => (
            <div key={i} className="bg-slate-50/50 p-6 rounded-3xl border border-slate-100 text-center">
              <p className="text-[10px] font-black uppercase text-slate-400 mb-1">{k.label}</p>
              <div className={`text-2xl font-black ${k.color}`}>{k.val}</div>
              <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">{k.sub}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Yıllık Veriler Analiz Ediliyor...</p>
          </div>
        ) : (
          <div className="space-y-8">
            <section className="report-grid">
              {/* Executive Summary */}
              <section className="summary-card bg-indigo-50/30 p-8 rounded-[2rem] border border-indigo-100/50 pdf-section relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5"><FileText className="w-24 h-24" /></div>
                <h3 className="text-xs font-black uppercase tracking-widest text-indigo-600 mb-4 flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Yönetici Stratejik Özeti
                </h3>
                <div className="space-y-3">
                  <p className="text-sm font-bold text-slate-700 leading-relaxed italic">
                    {headlineSummary}
                  </p>
                  {supportingInsights.length > 0 && (
                    <ul className="space-y-2 text-[13px] text-slate-600 font-semibold leading-relaxed">
                      {supportingInsights.map((item, idx) => (
                        <li key={idx} className="flex gap-2">
                          <span className="text-indigo-400 mt-0.5">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>

              {/* Location Share */}
              <section className="region-card insight-card bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm pdf-section">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-800 mb-4 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-rose-500" /> Bölgesel Dağılım
                </h3>
                <div className="space-y-3 overflow-y-auto max-h-64 pr-1">
                  {stats.cities.map((city: any, i: number) => (
                    <div key={i} className="flex justify-between items-center text-[11px] font-bold">
                      <span className="text-slate-500 uppercase">{city.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-800">₺{Math.round(city.value / 1000)}k</span>
                        <span className="text-[9px] text-indigo-400">%{Math.round(city.value / stats.revenue * 100)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Dönem Rekorları */}
              <section className="records-card insight-card bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm pdf-section">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-800 mb-4 flex items-center gap-2">
                  <Award className="w-4 h-4 text-emerald-500" /> Dönem Rekorları
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-emerald-50/50 rounded-2xl">
                    <div>
                      <p className="text-[10px] font-black text-emerald-600 uppercase">En Verimli Ay</p>
                      <p className="text-sm font-black text-slate-700">{stats.bestMonth?.month}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-slate-900">₺{stats.bestMonth?.revenue.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase">En Düşük Ay</p>
                      <p className="text-sm font-black text-slate-700">{stats.worstMonth?.month || 'Veri Yok'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-slate-900">₺{stats.worstMonth?.revenue.toLocaleString() || 0}</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Kategori Katkısı */}
              <section className="category-card insight-card bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm pdf-section">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-800 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-500" /> Kategori Katkısı (Top 5)
                </h3>
                <div className="space-y-2 overflow-y-auto max-h-48 pr-1">
                  {stats.categories.map((c: any, i: number) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="flex-1">
                        <div className="flex justify-between text-[10px] font-bold text-slate-600 mb-0.5 uppercase">
                          <span>{c.label}</span>
                          <span>₺{Math.round(c.value / 1000)}k</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full">
                          <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(c.value / stats.categories[0].value) * 100}%` }}></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </section>

            {/* 12-Month Detailed Table */}
            <section className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm pdf-section">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 mb-6 flex items-center gap-2">
                <TableIcon className="w-4 h-4 text-indigo-600" /> 12 Aylık Kârlılık Özeti
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse pdf-table">
                  <thead>
                    <tr className="bg-slate-50 text-slate-400 font-black uppercase border-b border-slate-100">
                      <th className="p-4">Ay</th>
                      <th className="p-4">Ciro</th>
                      <th className="p-4">Maliyet</th>
                      <th className="p-4">Kâr</th>
                      <th className="p-4">Marj</th>
                      <th className="p-4">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {stats.monthlyRows.map((m, i) => (
                      <tr key={i} className={m.revenue === 0 ? 'bg-slate-50/30' : 'hover:bg-slate-50 transition-colors'}>
                        <td className="p-4 font-bold text-slate-700">{m.month}</td>
                        <td className="p-4 font-medium">{m.revenue > 0 ? `₺${m.revenue.toLocaleString()}` : <span className="text-slate-300 italic">Veri Yok</span>}</td>
                        <td className="p-4 text-slate-500">₺{m.cost.toLocaleString()}</td>
                        <td className={`p-4 font-bold ${m.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>₺{m.profit.toLocaleString()}</td>
                        <td className="p-4 font-black">%{m.margin.toFixed(1)}</td>
                        <td className="p-4 text-slate-500">{m.txns}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-indigo-50/50 font-black text-slate-900 border-t-2 border-indigo-100">
                      <td className="p-4 uppercase">TOPLAM</td>
                      <td className="p-4">₺{stats.revenue.toLocaleString()}</td>
                      <td className="p-4 text-slate-500">₺{(stats.revenue - stats.profit).toLocaleString()}</td>
                      <td className="p-4 text-emerald-700">₺{stats.profit.toLocaleString()}</td>
                      <td className="p-4">%{stats.margin}</td>
                      <td className="p-4">{stats.volume}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Strategic Opportunities */}
              <div className="bg-emerald-50/30 p-8 rounded-[2rem] border border-emerald-100/50 pdf-section">
                <h3 className="text-xs font-black uppercase tracking-widest text-emerald-600 mb-6 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4" /> Büyüme Fırsatları
                </h3>
                <ul className="space-y-4">
                  {opportunityInsights.map((statement, i) => (
                    <li key={i} className="text-[11px] font-bold text-slate-700 flex gap-3 leading-relaxed">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> {statement}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Critical Risks */}
              <div className="bg-rose-50/30 p-8 rounded-[2rem] border border-rose-100/50 pdf-section">
                <h3 className="text-xs font-black uppercase tracking-widest text-rose-600 mb-6 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Kritik Risk Faktörleri
                </h3>
                <ul className="space-y-4">
                  {riskAlerts.length ? riskAlerts.map((risk, i) => (
                    <li key={i} className="text-[11px] font-bold text-slate-700 flex flex-col gap-1">
                      <div className="flex gap-2 items-start">
                        <TrendingDown className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-slate-800">{risk.title}</p>
                          <p className="text-[11px] text-slate-500 leading-relaxed font-medium">{risk.detail}</p>
                        </div>
                      </div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Etkisi: {risk.impact} · Aksiyon: {risk.action}</p>
                    </li>
                  )) : (
                    <li className="text-[11px] font-bold text-slate-500">AI risk değerlendirmesi bulunamadı.</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Action plan spread across bottom */}
        <section className="bg-slate-900 text-white rounded-[2rem] p-8 space-y-6 pdf-section">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-xs font-black uppercase tracking-widest text-indigo-300 flex items-center gap-2">
              <Target className="w-4 h-4" /> Aksiyon Planı
            </h3>
            <p className="text-[11px] text-slate-300 font-semibold">
              Yapay zeka tarafından önerilen programlar · {selectedYear}
            </p>
          </div>
          {actionItems.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {actionItems.map((action, i) => (
                <div key={`${action.title}-${i}`} className="bg-white/5 rounded-2xl p-5 space-y-3 border border-white/10">
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.3em] text-indigo-200">
                    <span>{action.title}</span>
                    <span>{action.timeline}</span>
                  </div>
                  <p className="text-sm font-semibold leading-relaxed text-white/90">{action.description}</p>
                  <div className="text-[10px] text-slate-300 uppercase tracking-[0.2em] space-y-1">
                    <p>Sorumlu: {action.owner}</p>
                    <p>Etki: {action.impact} · Durum: {action.status.replace('-', ' ')}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-200 font-semibold">AI aksiyon planı üretilemedi.</p>
          )}
        </section>

        {/* PDF Footer Only */}
        <div className="hidden print:block pt-12 border-t border-slate-100 text-center">
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">InsightStream Strategic Engine • {new Date().toLocaleDateString('tr-TR')}</p>
          <p className="text-[8px] text-slate-300 mt-2 italic">Bu rapor yapay zeka tarafından verileriniz temel alınarak oluşturulmuştur.</p>
        </div>
      </div>

      {showEmailModal && (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-lg p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Rapor Paylaşımı</p>
                <h3 className="text-xl font-black text-slate-900">E-posta ile Gönder</h3>
              </div>
              <button onClick={() => setShowEmailModal(false)} className="p-2 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <label className="space-y-1 block">
                <span className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">Alıcı E-Posta</span>
                <input
                  type="email"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  placeholder="ornek@firma.com"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </label>
              <label className="space-y-1 block">
                <span className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">Konu</span>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </label>
              <label className="space-y-1 block">
                <span className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">Mesaj</span>
                <textarea
                  rows={5}
                  value={emailMessage}
                  onChange={(e) => setEmailMessage(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </label>
              {emailStatus && (
                <div className={`text-sm font-semibold px-4 py-2 rounded-2xl ${emailStatus.includes('başarı') ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                  {emailStatus}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setShowEmailModal(false)} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-500 hover:text-slate-900">İptal</button>
              <button
                onClick={handleSendEmailReport}
                disabled={sendingEmail}
                className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-black uppercase tracking-[0.3em] flex items-center gap-2 hover:bg-indigo-500 disabled:opacity-60"
              >
                {sendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Gönder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};