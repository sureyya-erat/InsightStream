import React, { useMemo } from 'react';
import { Dataset } from '../types';
import { CalculationModule } from '../services/calculationModule';
import {
  Droplet,
  Copy,
  Activity,
  ShieldCheck,
  Filter,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Table as TableIcon,
  Target,
  RefreshCcw
} from 'lucide-react';

interface ColumnQuality {
  name: string;
  type: string;
  missingRate: number;
  missingCount: number;
  uniqueCount: number;
  topValues: string[];
  status: 'clean' | 'attention' | 'risk';
  note: string;
}

interface Props {
  dataset: Dataset;
}

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

const formatValue = (val: any) => {
  if (val === null || val === undefined || val === '') return '—';
  if (typeof val === 'number') return Number.isInteger(val) ? val.toString() : val.toFixed(2);
  return String(val);
};

export const DataQualityPage: React.FC<Props> = ({ dataset }) => {
  const processedRows = useMemo(
    () => dataset.rows.map(row => CalculationModule.processRow(row, dataset.mapping)),
    [dataset]
  );

  const totalRows = dataset.summary.rowCount || processedRows.length;
  const totalColumns = dataset.summary.colCount || dataset.columns.length;

  const missingCells = Math.round(dataset.summary.missingValues || 0);
  const missingPct = totalRows * totalColumns ? (missingCells / (totalRows * totalColumns)) * 100 : 0;

  const duplicateStats = useMemo(() => {
    const key = dataset.mapping.txId;
    if (!key) return { count: 0, ratio: 0 };
    const seen = new Set<string>();
    let duplicates = 0;
    dataset.rows.forEach(row => {
      const raw = row[key];
      if (raw === null || raw === undefined) return;
      const val = String(raw);
      if (seen.has(val)) duplicates += 1;
      else seen.add(val);
    });
    return { count: duplicates, ratio: totalRows ? (duplicates / totalRows) * 100 : 0 };
  }, [dataset, totalRows]);

  const numericOutliers = useMemo(() => {
    const stats = dataset.profiles
      .filter(profile => profile.type === 'numeric')
      .map(profile => {
        const values = dataset.rows
          .map(row => CalculationModule.normalizeNumeric(row[profile.name]))
          .filter(v => !Number.isNaN(v));
        if (values.length < 8) {
          return { column: profile.name, outliers: 0, ratio: 0, sampleSize: values.length };
        }
        const sorted = [...values].sort((a, b) => a - b);
        const q1 = sorted[Math.floor(sorted.length * 0.25)];
        const q3 = sorted[Math.floor(sorted.length * 0.75)];
        const iqr = q3 - q1;
        const lower = q1 - 1.5 * iqr;
        const upper = q3 + 1.5 * iqr;
        const outliers = sorted.filter(v => v < lower || v > upper).length;
        return { column: profile.name, outliers, ratio: outliers / sorted.length, sampleSize: sorted.length };
      });

    const totalOutliers = stats.reduce((sum, item) => sum + item.outliers, 0);
    const totalSamples = stats.reduce((sum, item) => sum + item.sampleSize, 0);
    const worst = [...stats].sort((a, b) => b.ratio - a.ratio)[0];
    return {
      totalOutliers,
      ratio: totalSamples ? (totalOutliers / totalSamples) * 100 : 0,
      highlight: worst && worst.outliers > 0 ? worst : null,
    };
  }, [dataset]);

  const columnQuality: ColumnQuality[] = useMemo(() => {
    const topValueCache: Record<string, string[]> = {};

    dataset.columns.forEach(col => {
      const counts: Record<string, number> = {};
      dataset.rows.forEach(row => {
        const raw = row[col];
        if (raw === null || raw === undefined || raw === '') return;
        const key = formatValue(raw);
        counts[key] = (counts[key] || 0) + 1;
      });
      topValueCache[col] = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([label]) => label);
    });

    return dataset.profiles.map(profile => {
      const missingCount = Math.round((profile.missingRate || 0) * totalRows);
      let status: ColumnQuality['status'] = 'clean';
      let note = 'Temiz';
      if (profile.missingRate > 0.2) {
        status = 'risk';
        note = 'Yüksek eksik veri';
      } else if (profile.missingRate > 0.05) {
        status = 'attention';
        note = 'Gözlem gerekli';
      } else if (profile.uniqueCount <= 1 && profile.type !== 'numeric') {
        status = 'attention';
        note = 'Düşük varyans';
      }
      return {
        name: profile.name,
        type: profile.type,
        missingRate: (profile.missingRate || 0) * 100,
        missingCount,
        uniqueCount: profile.uniqueCount,
        topValues: topValueCache[profile.name] || [],
        status,
        note,
      };
    });
  }, [dataset, totalRows]);

  const filterFacets = useMemo(() => {
    const years = Array.from(new Set(processedRows.map(r => r._year).filter(Boolean))).sort((a, b) => Number(b) - Number(a));
    const months = Array.from(new Set(processedRows.map(r => r._month).filter(Boolean))).sort((a, b) => Number(a) - Number(b));
    const cities = Array.from(new Set(processedRows.map(r => r._city))).filter(Boolean);
    const branches = Array.from(new Set(processedRows.map(r => r._branch))).filter(Boolean);
    const categories = Array.from(new Set(processedRows.map(r => r._category))).filter(Boolean);
    return { years, months, cities, branches, categories };
  }, [processedRows]);

  const alerts = useMemo(() => {
    const items: { title: string; detail: string; severity: 'high' | 'medium' | 'low' }[] = [];
    if (missingPct > 1) items.push({ title: 'Eksik veri taraması', detail: `${missingCells.toLocaleString()} hücre temizlenmeli`, severity: missingPct > 5 ? 'high' : 'medium' });
    if (duplicateStats.count > 0) items.push({ title: 'Tekrarlanan kayıtlar', detail: `${duplicateStats.count} satırda aynı Transaction ID`, severity: duplicateStats.count / Math.max(totalRows, 1) > 0.02 ? 'high' : 'medium' });
    if (numericOutliers.highlight) items.push({ title: 'Ayıklanması gereken uç değerler', detail: `${numericOutliers.highlight.outliers} adet ${numericOutliers.highlight.column} dışı değer`, severity: 'medium' });
    if (items.length === 0) items.push({ title: 'Veri kalitesi yüksek', detail: 'Kritik temizlik ihtiyacı bulunamadı.', severity: 'low' });
    return items;
  }, [missingPct, missingCells, duplicateStats, numericOutliers, totalRows]);

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-8 space-y-8">
      <header className="space-y-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.4em] text-slate-400">
            <ShieldCheck className="w-4 h-4" /> Veri Kalitesi Analizi
          </div>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">{dataset.name}</h1>
              <p className="text-slate-500 font-medium">Veri setinizdeki eksiklikler, tutarsızlıklar ve aykırı değerleri anlık takip edin.</p>
            </div>
            <div className="flex items-center gap-3">
              <button className="px-4 py-2 rounded-2xl border border-slate-200 text-xs font-black uppercase tracking-[0.3em] bg-white text-slate-500">Otomatik</button>
              <button className="px-4 py-2 rounded-2xl border border-transparent text-xs font-black uppercase tracking-[0.3em] bg-slate-900 text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> Temizliği Başlat
              </button>
            </div>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-6 rounded-3xl border border-indigo-100 bg-indigo-50/40">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] font-black uppercase tracking-[0.4em] text-indigo-600">Eksik Veriler</p>
            <Droplet className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="text-3xl font-black text-slate-900">{missingCells.toLocaleString()}</div>
          <p className="text-sm text-slate-500 font-medium">{formatPercent(missingPct)} toplam hücre</p>
        </div>
        <div className="p-6 rounded-3xl border border-amber-100 bg-amber-50/40">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] font-black uppercase tracking-[0.4em] text-amber-600">Yinelenenler</p>
            <Copy className="w-5 h-5 text-amber-500" />
          </div>
          <div className="text-3xl font-black text-slate-900">{duplicateStats.count}</div>
          <p className="text-sm text-slate-500 font-medium">{formatPercent(duplicateStats.ratio)} kayıt</p>
        </div>
        <div className="p-6 rounded-3xl border border-rose-100 bg-rose-50/50">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] font-black uppercase tracking-[0.4em] text-rose-600">Aykırı Değerler</p>
            <Activity className="w-5 h-5 text-rose-500" />
          </div>
          <div className="text-3xl font-black text-slate-900">{numericOutliers.totalOutliers}</div>
          <p className="text-sm text-slate-500 font-medium">{formatPercent(numericOutliers.ratio)} metrik</p>
        </div>
        <div className="p-6 rounded-3xl border border-emerald-100 bg-emerald-50/40">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] font-black uppercase tracking-[0.4em] text-emerald-600">Kolon Tipleri</p>
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="text-3xl font-black text-slate-900">{dataset.profiles.length}</div>
          <p className="text-sm text-slate-500 font-medium">{dataset.summary.colCount} alan profili</p>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[280px,1fr]">
        <aside className="space-y-6 bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <Filter className="w-5 h-5 text-slate-400" />
            <p className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-400">Filtreler</p>
          </div>
          {([
            { label: 'Yıl', values: filterFacets.years.map(String) },
            { label: 'Ay', values: filterFacets.months.map(m => m?.toString() ?? '') },
            { label: 'Şehir', values: filterFacets.cities },
            { label: 'Şube', values: filterFacets.branches },
            { label: 'Kategori', values: filterFacets.categories },
          ] as { label: string; values: (string | number)[] }[]).map(section => (
            <div key={section.label} className="space-y-3">
              <div className="flex items-center justify-between text-xs font-black uppercase tracking-[0.3em] text-slate-400">
                <span>{section.label}</span>
                <button className="text-[10px] text-indigo-500">Temizle</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {section.values.length === 0 ? (
                  <span className="text-xs text-slate-300">Veri yok</span>
                ) : (
                  section.values.map(value => (
                    <span key={`${section.label}-${value}`} className="px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-[11px] font-semibold text-slate-600">
                      {value}
                    </span>
                  ))
                )}
              </div>
            </div>
          ))}
        </aside>

        <main className="space-y-8">
          <section className="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-400">İyileştirme Planı</p>
                <h3 className="text-xl font-black text-slate-900">Veri Sağlığı Uyarıları</h3>
              </div>
              <button className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-black uppercase tracking-[0.3em] flex items-center gap-2">
                <RefreshCcw className="w-4 h-4" /> Tarama Yap
              </button>
            </div>
            <div className="space-y-4">
              {alerts.map((alert, idx) => (
                <div key={idx} className={`flex items-start gap-3 p-4 rounded-2xl border ${alert.severity === 'high' ? 'border-rose-100 bg-rose-50/40' : alert.severity === 'medium' ? 'border-amber-100 bg-amber-50/30' : 'border-emerald-100 bg-emerald-50/40'}`}>
                  {alert.severity === 'low' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5" />
                  ) : (
                    <AlertTriangle className={`w-5 h-5 mt-0.5 ${alert.severity === 'high' ? 'text-rose-500' : 'text-amber-500'}`} />
                  )}
                  <div>
                    <p className="text-sm font-bold text-slate-900">{alert.title}</p>
                    <p className="text-sm text-slate-500">{alert.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-400">Kolon Bazlı Kalite</p>
                <h3 className="text-xl font-black text-slate-900">Kolon Analiz Raporu</h3>
              </div>
              <button className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-black uppercase tracking-[0.3em] flex items-center gap-2">
                <TableIcon className="w-4 h-4" /> Tüm Boşlukları Temizle
              </button>
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-100">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">
                  <tr>
                    <th className="text-left px-4 py-3">Kolon</th>
                    <th className="text-left px-4 py-3">Tip</th>
                    <th className="text-left px-4 py-3">Boş</th>
                    <th className="text-left px-4 py-3">Benzersiz</th>
                    <th className="text-left px-4 py-3">En Sık Değerler</th>
                    <th className="text-left px-4 py-3">Durum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {columnQuality.map(col => (
                    <tr key={col.name} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-900">{col.name}</p>
                        <p className="text-xs text-slate-400">{col.note}</p>
                      </td>
                      <td className="px-4 py-3 capitalize text-slate-600">{col.type}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{col.missingCount}</p>
                        <p className="text-xs text-slate-400">{formatPercent(col.missingRate)}</p>
                      </td>
                      <td className="px-4 py-3">{col.uniqueCount}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2 max-w-xs">
                          {col.topValues.length === 0 ? (
                            <span className="text-xs text-slate-300">Veri yok</span>
                          ) : (
                            col.topValues.map(value => (
                              <span key={`${col.name}-${value}`} className="px-2 py-1 rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">
                                {value}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-[0.3em] ${
                          col.status === 'risk'
                            ? 'bg-rose-50 text-rose-600'
                            : col.status === 'attention'
                            ? 'bg-amber-50 text-amber-600'
                            : 'bg-emerald-50 text-emerald-600'
                        }`}>
                          {col.status === 'risk' ? 'Risk' : col.status === 'attention' ? 'İzle' : 'Temiz'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-slate-900 rounded-[2rem] p-6 text-white space-y-4 shadow-xl">
            <p className="text-[11px] font-black uppercase tracking-[0.4em] text-white/70">Önerilen Aksiyonlar</p>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Target className="w-5 h-5 text-indigo-300" />
                <div>
                  <p className="text-sm font-bold">Eksik alanları tamamlamak için form doğrulama ekleyin.</p>
                  <p className="text-sm text-white/70">CRM veya ERP entegrasyonuyla tek kaynaktan veri toplanabilir.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Copy className="w-5 h-5 text-indigo-300" />
                <div>
                  <p className="text-sm font-bold">Tekrarlanan kayıtlar için Transaction ID kontrolü aktif edin.</p>
                  <p className="text-sm text-white/70">Yeni kayıt girişlerinde benzersiz anahtar zorunlu olsun.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Activity className="w-5 h-5 text-indigo-300" />
                <div>
                  <p className="text-sm font-bold">Uç değerleri loglama ve manuel onaya gönderme.</p>
                  <p className="text-sm text-white/70">Belirli eşikleri aşan değerler için otomatik uyarı.</p>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};
