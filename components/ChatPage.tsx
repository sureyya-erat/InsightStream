
import React, { useState, useRef, useEffect } from 'react';
import { getChatQueryPlan } from '../services/gemini';
import { CalculationModule } from '../services/calculationModule';
import { HistoryService } from '../services/historyService';
import { Dataset, PinnedChart, FilterState } from '../types';
import { BIChart } from './Charts';
import { MessageSquare, Send, Sparkles, Terminal, Filter, LayoutGrid, BookmarkPlus, CheckCircle2 } from 'lucide-react';

interface Props {
  dataset: Dataset;
  onApplyFilters: (filters: any) => void;
  filterState: FilterState;
}

export const ChatPage: React.FC<Props> = ({ dataset, onApplyFilters, filterState }) => {
  const [question, setQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [chatHistory]);

  useEffect(() => {
    const storageKey = `insightstream_pinned_${dataset.name}`;
    try {
      const existing = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (Array.isArray(existing)) {
        setPinnedIds(existing.map((item: any) => item.id));
      }
    } catch (e) { console.error(e); }
  }, [dataset.name]);

  const quickQuestions = [
    "En kârlı şube hangisi?",
    "En çok ciro getiren kategori hangisi?",
    "Haftalık kâr trendi nasıl?",
    "İstanbul şubelerinin satışları nasıl?"
  ];

  const handlePin = (msg: any, idx: number) => {
    const chartId = `pinned_${dataset.name}_${idx}`;
    if (pinnedIds.includes(chartId)) return;

    const newPinned: PinnedChart = {
      id: chartId,
      title: msg.plan.titleTR || `${msg.plan.metric.toUpperCase()} Analizi (${msg.plan.groupBy})`,
      type: msg.plan.chart || 'bar',
      data: msg.data,
      plan: msg.plan,
      createdAt: Date.now()
    };

    const storageKey = `insightstream_pinned_${dataset.name}`;
    const existing = JSON.parse(localStorage.getItem(storageKey) || '[]');
    localStorage.setItem(storageKey, JSON.stringify([...existing, newPinned]));
    setPinnedIds(prev => [...prev, chartId]);
  };

  const handleAsk = async (q: string = question) => {
    if (!q.trim()) return;
    setLoading(true);
    const userMsg = { role: 'user', content: q };
    setChatHistory(prev => [...prev, userMsg]);
    setQuestion('');

    try {
      const plan = await getChatQueryPlan(q, dataset);
      const rows = dataset.rows.map(r => CalculationModule.processRow(r, dataset.mapping));
      const filtered = plan.filters ? rows.filter(r => {
        let match = true;
        if (plan.filters.year) match = match && r['YEAR_final'] === plan.filters.year;
        if (plan.filters.city) match = match && r['CITY_final']?.toLowerCase().includes(plan.filters.city.toLowerCase());
        return match;
      }) : rows;

      const data = CalculationModule.executeQueryPlan(filtered, plan);
      const topVal = data[0];

      const answer = plan.intent === 'topN' && topVal
        ? `${plan.metric === 'revenue' ? 'Ciro' : 'Kâr'} açısından en başarılı ${plan.groupBy === 'branch' ? 'şube' : 'kategori'} ${topVal.label} olarak görülüyor (₺${topVal.value.toLocaleString()}).`
        : `Verileriniz üzerinde ${plan.groupBy} bazlı analiz gerçekleştirildi.`;

      const aiMsg = {
        role: 'ai',
        content: answer,
        data,
        plan,
        suggestedFilters: plan.filters
      };

      setChatHistory(prev => [...prev, aiMsg]);

      // Save to History
      HistoryService.saveRecord(dataset.name, {
        type: 'chat',
        datasetId: dataset.name,
        titleTR: q,
        filterStateSnapshot: filterState,
        payload: aiMsg
      });

    } catch (err: any) {
      console.error('AI sohbet isteği başarısız oldu:', err);
      const friendlyError = err?.message ? `Üzgünüm, sorunuzu analiz ederken bir hata oluştu. (Detay: ${err.message})` : 'Üzgünüm, sorunuzu analiz ederken bir hata oluştu.';
      setChatHistory(prev => [...prev, { role: 'ai', content: friendlyError }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-8 h-[calc(100vh-120px)] flex flex-col space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-100">
          <MessageSquare className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Veri ile Sohbet</h2>
          <p className="text-slate-500 text-sm">Doğal dil kullanarak veri setinizi analiz edin.</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-6 pr-4 scroll-smooth">
        {chatHistory.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-40">
            <Terminal className="w-16 h-16" />
            <div className="space-y-2">
              <p className="font-black uppercase tracking-widest text-xs">Analize Hazır</p>
              <p className="text-sm">Bir soru sorun veya aşağıdaki önerileri kullanın.</p>
            </div>
          </div>
        )}

        {chatHistory.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[95%] sm:max-w-[85%] rounded-[2rem] p-6 shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-100'}`}>
              <div className="mb-4">
                <p className="text-sm font-bold leading-relaxed">{msg.content}</p>
              </div>

              {msg.data && (
                <div className="mt-4 pt-4 border-t border-slate-50 space-y-4">
                  <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100">
                    <BIChart
                      title={(msg.plan.titleTR || `${msg.plan.metric.toUpperCase()} ANALİZİ`).toUpperCase()}
                      type={msg.plan.chart || 'bar'}
                      data={msg.data}
                      height={160}
                      minimal={true}
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    {msg.suggestedFilters && (
                      <button
                        onClick={() => onApplyFilters(msg.suggestedFilters)}
                        className="flex-1 py-2.5 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-100 transition-colors"
                      >
                        <Filter className="w-3 h-3" /> Filtreleri Uygula
                      </button>
                    )}
                    <button
                      onClick={() => handlePin(msg, idx)}
                      disabled={pinnedIds.includes(`pinned_${dataset.name}_${idx}`)}
                      className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${pinnedIds.includes(`pinned_${dataset.name}_${idx}`)
                          ? 'bg-emerald-50 text-emerald-600 cursor-default'
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                        }`}
                    >
                      {pinnedIds.includes(`pinned_${dataset.name}_${idx}`) ? (
                        <><CheckCircle2 className="w-3 h-3" /> Dashboard'a Eklendi</>
                      ) : (
                        <><BookmarkPlus className="w-3 h-3" /> Dashboard'a Ekle</>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-100 rounded-[2rem] p-6 flex items-center gap-3">
              <Sparkles className="w-4 h-4 text-indigo-600 animate-spin" />
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">Yapay Zeka Analiz Ediyor...</span>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4 pt-4 border-t border-slate-100">
        <div className="flex flex-wrap gap-2">
          {quickQuestions.map(q => (
            <button key={q} onClick={() => handleAsk(q)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
              {q}
            </button>
          ))}
        </div>
        <div className="relative group">
          <input
            type="text"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAsk()}
            placeholder="Veri hakkında bir soru sorun..."
            className="w-full bg-white border border-slate-200 rounded-2xl p-4 pr-14 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-xl shadow-slate-100"
          />
          <button
            onClick={() => handleAsk()}
            className="absolute right-3 top-2.5 p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
