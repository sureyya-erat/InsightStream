
import React, { useState, useMemo } from 'react';
import { AnalysisRecord, Dataset, Page } from '../types';
import { HistoryService } from '../services/historyService';
import { BIChart } from './Charts';
import { 
  Clock, Search, Trash2, Bookmark, BookmarkCheck, ExternalLink, 
  X, Printer, FileDown, LayoutDashboard, MessageSquare, TrendingUp, Sparkles, Filter
} from 'lucide-react';

interface Props {
  dataset: Dataset;
  onApplyFilters: (filters: any) => void;
}

export const HistoryPage: React.FC<Props> = ({ dataset, onApplyFilters }) => {
  const [records, setRecords] = useState<AnalysisRecord[]>(() => HistoryService.getRecords(dataset.name));
  const [selectedRecord, setSelectedRecord] = useState<AnalysisRecord | null>(null);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const matchType = filterType === 'ALL' || r.type === filterType;
      const matchSearch = r.titleTR.toLowerCase().includes(searchTerm.toLowerCase());
      return matchType && matchSearch;
    });
  }, [records, filterType, searchTerm]);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Bu analiz kaydını silmek istediğinize emin misiniz?")) return;
    HistoryService.deleteRecord(dataset.name, id);
    setRecords(prev => prev.filter(r => r.id !== id));
  };

  const handleTogglePin = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    HistoryService.togglePin(dataset.name, id);
    setRecords(prev => prev.map(r => r.id === id ? { ...r, pinned: !r.pinned } : r));
  };

  const handlePrint = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.print();
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'chat': return <MessageSquare className="w-4 h-4" />;
      case 'simulation': return <TrendingUp className="w-4 h-4" />;
      case 'insight': return <Sparkles className="w-4 h-4" />;
      case 'dashboard_snapshot': return <LayoutDashboard className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'chat': return 'Sohbet Sorgusu';
      case 'simulation': return 'Simülasyon';
      case 'insight': return 'AI İçgörü';
      case 'dashboard_snapshot': return 'Görünüm Kaydı';
      default: return 'Analiz';
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Analiz Geçmişi</h2>
          <p className="text-slate-500 text-sm">Yapılan tüm analizler, sohbetler ve simülasyonlar burada saklanır.</p>
        </div>
        <div className="flex gap-2">
           <button 
             onClick={() => { HistoryService.clearHistory(dataset.name); setRecords([]); }}
             className="text-[10px] font-black uppercase text-slate-400 hover:text-rose-500 transition-colors flex items-center gap-2"
           >
             <Trash2 className="w-3.5 h-3.5" /> Geçmişi Temizle
           </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Analiz başlığı ara..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'ALL', label: 'Tümü' },
            { id: 'chat', label: 'Sohbet' },
            { id: 'simulation', label: 'Simülasyon' },
            { id: 'insight', label: 'AI İçgörü' },
            { id: 'dashboard_snapshot', label: 'Snapshot' }
          ].map(t => (
            <button 
              key={t.id}
              onClick={() => setFilterType(t.id)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${filterType === t.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-slate-50 text-slate-400 hover:text-slate-600'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredRecords.length === 0 ? (
          <div className="col-span-full py-32 flex flex-col items-center justify-center opacity-30 text-center space-y-4">
            <Clock className="w-16 h-16" />
            <p className="font-black uppercase tracking-widest text-xs">Henüz kayıt bulunamadı</p>
          </div>
        ) : (
          filteredRecords.map(record => (
            <div 
              key={record.id} 
              onClick={() => setSelectedRecord(record)}
              className="group bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all cursor-pointer flex flex-col h-full relative"
            >
              <div className="flex justify-between items-start mb-4">
                <div className={`p-2.5 rounded-xl ${record.pinned ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600'} transition-colors`}>
                  {getTypeIcon(record.type)}
                </div>
                <div className="flex gap-1">
                  <button onClick={(e) => handleTogglePin(record.id, e)} className="p-2 text-slate-300 hover:text-amber-500 transition-colors">
                    {record.pinned ? <BookmarkCheck className="w-4 h-4 text-amber-500" /> : <Bookmark className="w-4 h-4" />}
                  </button>
                  <button onClick={(e) => handleDelete(record.id, e)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <h4 className="font-black text-slate-900 leading-snug mb-2 group-hover:text-indigo-600 transition-colors">{record.titleTR}</h4>
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-auto flex items-center gap-1.5">
                <Clock className="w-3 h-3" /> {new Date(record.createdAt).toLocaleString('tr-TR')}
              </p>
            </div>
          ))
        )}
      </div>

      {/* DETAIL MODAL */}
      {selectedRecord && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm no-print animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-8 duration-500 print:shadow-none print:w-full print:max-w-none print:max-h-none print:static">
            <div className="p-6 sm:p-8 bg-indigo-600 text-white flex justify-between items-center shrink-0 no-print">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">{getTypeIcon(selectedRecord.type)}</div>
                <div>
                  <h3 className="font-black uppercase tracking-widest text-[10px] opacity-70">{getTypeLabel(selectedRecord.type)}</h3>
                  <p className="font-black text-lg leading-tight truncate max-w-md">{selectedRecord.titleTR}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={handlePrint} className="p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all active:scale-95 shadow-sm"><Printer className="w-5 h-5" /></button>
                <button onClick={() => setSelectedRecord(null)} className="p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-colors"><X className="w-5 h-5" /></button>
              </div>
            </div>

            <div id="printable-analysis" className="flex-1 overflow-y-auto p-8 space-y-8 print:p-0 print:overflow-visible print:block">
              <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-6 gap-4 print:border-slate-200">
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Analiz Tarihi</p>
                  <p className="font-bold text-slate-700">{new Date(selectedRecord.createdAt).toLocaleString('tr-TR')}</p>
                </div>
                <div className="flex gap-4 no-print">
                  <button 
                    onClick={() => { onApplyFilters(selectedRecord.filterStateSnapshot); setSelectedRecord(null); }}
                    className="flex items-center gap-2 px-6 py-2.5 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-colors"
                  >
                    <Filter className="w-3.5 h-3.5" /> Filtreleri Dashboard'a Uygula
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                {selectedRecord.type === 'chat' && (
                  <div className="space-y-6">
                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 print:bg-white print:border-slate-200">
                      <p className="text-[10px] font-black uppercase text-indigo-400 mb-2">AI Analiz Yanıtı</p>
                      <p className="text-sm font-bold text-slate-700 leading-relaxed">{selectedRecord.payload.content}</p>
                    </div>
                    {selectedRecord.payload.data && (
                      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm print:border-slate-200 print:shadow-none">
                        <BIChart 
                          title={selectedRecord.titleTR} 
                          type={selectedRecord.payload.plan?.chart || 'bar'} 
                          data={selectedRecord.payload.data} 
                          height={300} 
                        />
                      </div>
                    )}
                  </div>
                )}

                {selectedRecord.type === 'simulation' && (
                  <div className="space-y-8">
                     <div className="grid grid-cols-2 gap-4">
                        <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 text-center print:bg-white print:border-slate-200">
                          <p className="text-[10px] font-black uppercase text-indigo-400 mb-1">Ciro Değişimi</p>
                          <p className="text-2xl font-black text-indigo-600">₺{selectedRecord.payload.scenario.revenue.toLocaleString()}</p>
                        </div>
                        <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100 text-center print:bg-white print:border-slate-200">
                          <p className="text-[10px] font-black uppercase text-emerald-400 mb-1">Kâr Değişimi</p>
                          <p className="text-2xl font-black text-emerald-600">₺{selectedRecord.payload.scenario.profit.toLocaleString()}</p>
                        </div>
                     </div>
                     <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm print:border-slate-200 print:shadow-none">
                        <BIChart 
                          title="Simülasyon Karşılaştırması" 
                          type="bar" 
                          data={[
                            { label: 'Ciro', base: selectedRecord.payload.base.revenue, scn: selectedRecord.payload.scenario.revenue },
                            { label: 'Kâr', base: selectedRecord.payload.base.profit, scn: selectedRecord.payload.scenario.profit }
                          ]}
                          dataKey="base"
                          secondaryDataKey="scn"
                          height={300}
                        />
                     </div>
                  </div>
                )}

                {(selectedRecord.type === 'insight' || selectedRecord.type === 'recommendation') && (
                  <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 print:bg-white print:border-slate-200">
                    <p className="text-sm font-bold text-slate-700 leading-loose whitespace-pre-line">{selectedRecord.payload.text}</p>
                  </div>
                )}

                {selectedRecord.type === 'dashboard_snapshot' && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:grid-cols-2">
                     {Object.entries(selectedRecord.payload.kpis).map(([key, val]: any) => (
                       <div key={key} className="bg-white p-4 rounded-2xl border border-slate-100 text-center print:border-slate-200">
                         <p className="text-[9px] font-black uppercase text-slate-400 mb-1">{key}</p>
                         <p className="text-lg font-black text-indigo-600">{val.toLocaleString()}</p>
                       </div>
                     ))}
                     <div className="col-span-full pt-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Bu kayıt o anki dashboard KPI değerlerini dondurmuştur.</p>
                     </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PRINT-ONLY VIEW */}
      <div className="print-only">
        {selectedRecord && (
          <div className="p-8">
            <h1 className="text-2xl font-black uppercase mb-2">{selectedRecord.titleTR}</h1>
            <p className="text-slate-500 mb-8">{new Date(selectedRecord.createdAt).toLocaleString('tr-TR')} - {dataset.name}</p>
            <div className="space-y-8">
               {selectedRecord.type === 'chat' && <p className="font-bold">{selectedRecord.payload.content}</p>}
               {selectedRecord.type === 'insight' && <p className="whitespace-pre-line">{selectedRecord.payload.text}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
