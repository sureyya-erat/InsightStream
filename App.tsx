
import React, { useState, useEffect, useRef } from 'react';
import { Page, Dataset } from './types';
import { LandingPage } from './components/LandingPage';
import { Dashboard } from './components/Dashboard';
import { SimulationPage } from './components/SimulationPage';
import { DataQualityPage } from './components/DataQualityPage';
import { ChatPage } from './components/ChatPage';
import { SchedulingPage } from './components/SchedulingPage';
import { HistoryPage } from './components/HistoryPage';
import { AnnualSummaryPage } from './components/AnnualSummaryPage';
import { DataProcessor } from './services/dataProcessor';
import { StorageService } from './services/storage';
import { SAMPLE_DATASET } from './constants';
import { driver } from "driver.js";
import TermsGate, { DEFAULT_TERMS_STORAGE_KEY, DEFAULT_TERMS_VERSION } from "./components/TermsGate";
import {
  Upload, FileText, Clock, Trash2, ArrowRight, AlertCircle,
  LayoutDashboard, TrendingUp, MessageSquare, Home, Calendar, History,
  PlayCircle, BarChart3, Shield
} from 'lucide-react';

interface HistoryItem {
  id: string;
  name: string;
  timestamp: number;
}

const TERMS_VERSION = DEFAULT_TERMS_VERSION;
const TERMS_STORAGE_KEY = DEFAULT_TERMS_STORAGE_KEY;

const readStoredTermsAcceptance = () => {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(TERMS_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Boolean(parsed?.accepted && parsed.version === TERMS_VERSION);
  } catch {
    return false;
  }
};

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>(Page.Landing);
  const [activeDataset, setActiveDataset] = useState<Dataset | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [filterStateSnapshot, setFilterStateSnapshot] = useState<any>(null);
  const [termsAccepted, setTermsAccepted] = useState<boolean>(() => readStoredTermsAcceptance());
  const [termsModalActive, setTermsModalActive] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('insightstream_history_meta');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse history", e);
        localStorage.removeItem('insightstream_history_meta');
      }
    }
  }, []);

  useEffect(() => {
    setTermsAccepted(readStoredTermsAcceptance());
  }, []);



  const ensureTerms = (next: () => void) => {
    if (termsAccepted) {
      next();
      return;
    }
    pendingActionRef.current = next;
    setTermsModalActive(true);
  };

  const goToHome = () => ensureTerms(() => setCurrentPage(Page.Home));

  const handleTermsAccepted = () => {
    setTermsAccepted(true);
    setTermsModalActive(false);
    pendingActionRef.current?.();
    pendingActionRef.current = null;
  };

  const launchGuidedTour = () => {
    let driverObj: any;

    const tourSteps = [
      {
        element: '[data-tour="hero-landing"]',
        popover: {
          title: 'InsightStream BI',
          description: 'Bu uygulama ile verilerinizi yükleyebilir, interaktif dashboardlar oluşturabilir ve AI destekli analizler yapabilirsiniz.',
          side: "right" as any,
          align: 'start' as any
        }
      },
      {
        element: '[data-tour="upload"]',
        popover: {
          title: 'Veri Yükleme',
          description: 'Başlamak için kendi verinizi yükleyin veya örnek veri setini kullanın. (Sizin için şimdi örnek veriyi yüklüyoruz!)',
          side: "bottom" as any,
          align: 'start' as any,
          onNextClick: () => {
            if (!activeDataset) {
              loadDemo();
              // Wait for React to render Dashboard then move next
              setTimeout(() => {
                driverObj.moveNext();
              }, 800);
            } else {
              driverObj.moveNext();
            }
          }
        }
      },
      {
        element: '[data-tour="filters"]',
        popover: { title: 'Dinamik Filtreler', description: 'Yıl, Ay, Şube ve Kategori bazlı anlık filtreleme yapın. Tüm grafikler anında güncellenir.', side: "right" as any, align: 'start' as any }
      },
      {
        element: '[data-tour="kpis"]',
        popover: { title: 'Canlı Metrikler', description: 'Ciro, Kâr ve Satış miktarlarınızı gerçek zamanlı takip edin.', side: "bottom" as any, align: 'start' as any }
      },
      {
        element: '[data-tour="charts"]',
        popover: { title: 'Gelişmiş Grafikler', description: 'Trendler, Pareto ve Fiyat analizlerini buradan inceleyin.', side: "top" as any, align: 'start' as any }
      },
      {
        element: '[data-tour="nav-chat"]',
        popover: {
          title: 'Veri ile Sohbet',
          description: 'Yapay zekaya doğal dilde sorular sorarak analiz isteyin. Örn: "En kârlı şube hangisi?"',
          side: "bottom" as any,
          align: 'start' as any,
          onNextClick: () => {
            setCurrentPage(Page.Chat);
            setTimeout(() => {
              driverObj.moveNext();
            }, 500);
          }
        }
      },
      {
        element: '[data-tour="nav-sim"]',
        popover: {
          title: 'What-if Simülasyon',
          description: 'Fiyat ve marj değişimlerinin kâr üzerindeki etkilerini simüle edin.',
          side: "bottom" as any,
          align: 'start' as any,
          onNextClick: () => {
            setCurrentPage(Page.Simulation);
            setTimeout(() => {
              driverObj.moveNext();
            }, 500);
          }
        }
      },
      {
        element: '[data-tour="nav-sch"]',
        popover: {
          title: 'Otomatik Raporlama',
          description: 'Dashboard görünümlerinizi PDF olarak zamanlayıp otomatik e-posta gönderin.',
          side: "bottom" as any,
          align: 'start' as any,
          onNextClick: () => {
            setCurrentPage(Page.Scheduling);
            setTimeout(() => {
              driverObj.moveNext();
            }, 500);
          }
        }
      }
    ];

    driverObj = driver({
      showProgress: true,
      nextBtnText: 'İleri',
      prevBtnText: 'Geri',
      doneBtnText: 'Bitir',
      steps: tourSteps
    });

    // Eğer Landing'de değilsek, turu oradan başlatmak için yönlendir
    if (currentPage !== Page.Landing) {
      setCurrentPage(Page.Landing);
      // Küçük bir delay ile elementin DOM'da oluşmasını bekle
      setTimeout(() => driverObj.drive(), 100);
    } else {
      driverObj.drive();
    }
  };

  const handleStartTour = () => ensureTerms(launchGuidedTour);

  const saveToHistory = async (name: string, data: any) => {
    try {
      const id = `ds_${Date.now()}`;
      const newItem: HistoryItem = { id, name, timestamp: Date.now() };
      const updated = [newItem, ...history].slice(0, 5);
      setHistory(updated);
      try {
        localStorage.setItem('insightstream_history_meta', JSON.stringify(updated));
      } catch (lsError) {
        console.warn("LocalStorage quota hit");
      }
      await StorageService.saveDataset(id, data);
    } catch (e) {
      console.error("Storage error:", e);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    setError(null);
    try {
      const rows = await DataProcessor.parseFile(file);
      const dataset = DataProcessor.processDataset(file.name, rows);
      setActiveDataset(dataset);
      await saveToHistory(file.name, rows);
      setCurrentPage(Page.Dashboard);
    } catch (err: any) {
      setError(err.message || "Dosya işlenirken bir hata oluştu.");
    } finally {
      setIsProcessing(false);
      e.target.value = '';
    }
  };

  const loadDemo = () => {
    const dataset = DataProcessor.processDataset("Urban Sales Sample", SAMPLE_DATASET);
    setActiveDataset(dataset);
    setCurrentPage(Page.Dashboard);
  };

  const loadFromHistory = async (item: HistoryItem) => {
    setIsProcessing(true);
    try {
      const rows = await StorageService.getDataset(item.id);
      if (rows) {
        const dataset = DataProcessor.processDataset(item.name, rows);
        setActiveDataset(dataset);
        setCurrentPage(Page.Dashboard);
      } else setError("Veri seti bulunamadı.");
    } catch (e) { setError("Veri yüklenemedi."); }
    finally { setIsProcessing(false); }
  };

  const clearHistory = async () => {
    setHistory([]);
    localStorage.removeItem('insightstream_history_meta');
    await StorageService.clearAll();
    setError(null);
  };

  const Navigation = () => (
    <nav className="relative z-[120] bg-gradient-to-r from-indigo-800 via-purple-700 to-sky-500 text-white px-8 py-4 flex items-center justify-between no-print sticky top-0 shadow-[0_10px_40px_rgba(15,23,42,0.45)] border-b border-white/20">
      <div className="flex items-center gap-6">
        <div
          onClick={() => setCurrentPage(Page.Landing)}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-10 h-10 bg-white/15 border border-white/30 rounded-2xl flex items-center justify-center text-white font-black text-lg group-hover:scale-105 transition-transform shadow-inner shadow-black/20">IS</div>
          <div className="hidden md:flex flex-col leading-tight">
            <span className="font-black tracking-[0.4em] text-[10px] text-white/70">INSIGHTSTREAM</span>
            <span className="text-sm font-bold text-white">AI BI Studio</span>
          </div>
        </div>
        <div className="flex gap-1 bg-white/10 backdrop-blur px-1.5 py-1 rounded-2xl overflow-x-auto border border-white/20 shadow-inner shadow-black/20">
          <button
            onClick={() => setCurrentPage(Page.Landing)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.4em] transition-all ${currentPage === Page.Landing ? 'bg-white text-indigo-700 shadow-lg' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
          >
            <Home className="w-3 h-3" /> Ana Sayfa
          </button>
          <button
            onClick={() => setCurrentPage(Page.Dashboard)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.4em] transition-all ${currentPage === Page.Dashboard ? 'bg-white text-indigo-700 shadow-lg' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
          >
            <LayoutDashboard className="w-3 h-3" /> Dashboard
          </button>
          <button
            onClick={() => setCurrentPage(Page.DataQuality)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.4em] transition-all ${currentPage === Page.DataQuality ? 'bg-white text-indigo-700 shadow-lg' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
          >
            <Shield className="w-3 h-3" /> Veri Kalitesi
          </button>
          <button
            onClick={() => setCurrentPage(Page.AnnualSummary)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.4em] transition-all ${currentPage === Page.AnnualSummary ? 'bg-white text-indigo-700 shadow-lg' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
          >
            <BarChart3 className="w-3 h-3" /> Performans Özeti
          </button>
          <button
            data-tour="nav-sim"
            onClick={() => setCurrentPage(Page.Simulation)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.4em] transition-all ${currentPage === Page.Simulation ? 'bg-white text-indigo-700 shadow-lg' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
          >
            <TrendingUp className="w-3 h-3" /> Simülasyon
          </button>
          <button
            data-tour="nav-chat"
            onClick={() => setCurrentPage(Page.Chat)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.4em] transition-all ${currentPage === Page.Chat ? 'bg-white text-indigo-700 shadow-lg' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
          >
            <MessageSquare className="w-3 h-3" /> Sohbet
          </button>
          <button
            data-tour="nav-sch"
            onClick={() => setCurrentPage(Page.Scheduling)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.4em] transition-all ${currentPage === Page.Scheduling ? 'bg-white text-indigo-700 shadow-lg' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
          >
            <Calendar className="w-3 h-3" /> Zamanlama
          </button>
          <button
            onClick={() => setCurrentPage(Page.History)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.4em] transition-all ${currentPage === Page.History ? 'bg-white text-indigo-700 shadow-lg' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
          >
            <History className="w-3 h-3" /> Geçmiş
          </button>
        </div>
      </div>
      <button onClick={goToHome} className="p-3 rounded-2xl border border-white/30 bg-white/15 text-white hover:bg-white/25 transition-colors shadow-inner shadow-black/20" title="Dosya Yükleme">
        <Upload className="w-5 h-5" />
      </button>
    </nav>
  );

  const renderContent = () => {
    if (!activeDataset) return null;
    switch (currentPage) {
      case Page.Dashboard:
        return <Dashboard key={activeDataset.name} dataset={activeDataset} onBack={goToHome} onStartTour={handleStartTour} />;
      case Page.DataQuality:
        return <DataQualityPage dataset={activeDataset} onUpdateDataset={setActiveDataset} />;
      case Page.Simulation:
        return <SimulationPage dataset={activeDataset} filterState={filterStateSnapshot || { years: "ALL", months: "ALL", cities: "ALL", branches: "ALL", categories: "ALL", genericFilters: {} }} />;
      case Page.Chat:
        return <ChatPage dataset={activeDataset} filterState={filterStateSnapshot || { years: "ALL", months: "ALL", cities: "ALL", branches: "ALL", categories: "ALL", genericFilters: {} }} onApplyFilters={() => setCurrentPage(Page.Dashboard)} />;
      case Page.AnnualSummary:
        return <AnnualSummaryPage dataset={activeDataset} />;
      case Page.Scheduling:
        return <SchedulingPage dataset={activeDataset} />;
      case Page.History:
        return <HistoryPage dataset={activeDataset} onApplyFilters={(filters) => { setFilterStateSnapshot(filters); setCurrentPage(Page.Dashboard); }} />;
      default:
        return null;
    }
  };

  const landingStart = goToHome;
  const landingDemo = () => ensureTerms(() => loadDemo());

  let pageContent: React.ReactNode;

  if (currentPage === Page.Landing) {
    pageContent = (
      <LandingPage onStart={landingStart} onDemo={landingDemo} onTour={handleStartTour} />
    );
  } else if (activeDataset && currentPage !== Page.Home) {
    pageContent = (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navigation />
        <div className="flex-1">
          {renderContent()}
        </div>
      </div>
    );
  } else {
    pageContent = (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 sm:p-12">
        <div className="max-w-2xl w-full space-y-12">
          <div className="text-center space-y-4">
            <div onClick={() => setCurrentPage(Page.Landing)} className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black text-2xl mx-auto cursor-pointer hover:scale-105 transition-transform">IS</div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Raporunuzu Oluşturun</h2>
            <p className="text-slate-500">Kendi dosyanızı yükleyin veya demo verisini kullanın.</p>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200 border border-slate-100 space-y-8">
            <div data-tour="upload" className="relative group">
              <label className={`w-full flex flex-col items-center justify-center px-6 py-12 border-2 border-dashed rounded-3xl cursor-pointer transition-all ${isProcessing ? 'bg-slate-50 border-slate-200 cursor-not-allowed' : 'bg-slate-50/50 border-slate-200 hover:border-indigo-400 group-hover:bg-slate-50'}`}>
                {isProcessing ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-600 font-bold uppercase text-xs tracking-widest">Veriler Analiz Ediliyor...</p>
                  </div>
                ) : (
                  <>
                    <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center text-indigo-600 mb-6 group-hover:scale-110 transition-transform border border-slate-100">
                      <Upload className="w-8 h-8" />
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-slate-900 mb-2">Dosya Seçin veya Sürükleyin</p>
                      <p className="text-sm text-slate-400 font-medium">.xlsx, .csv, .json desteklenir</p>
                    </div>
                  </>
                )}
                <input type="file" className="hidden" accept=".csv,.json,.xlsx,.xls" onChange={handleFileUpload} disabled={isProcessing} />
              </label>
              {error && <div className="mt-4 p-4 bg-rose-50 rounded-xl border border-rose-100 text-sm font-bold text-rose-600 flex gap-2"><AlertCircle className="w-5 h-5" /> {error}</div>}
            </div>

            <div className="flex items-center gap-4"><div className="h-px flex-1 bg-slate-100"></div><span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">VEYA</span><div className="h-px flex-1 bg-slate-100"></div></div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button onClick={loadDemo} className="flex items-center gap-4 p-4 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-2xl transition-all group">
                <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-slate-600 group-hover:text-indigo-600 transition-colors"><FileText className="w-5 h-5" /></div>
                <div className="text-left"><p className="font-bold text-slate-900 text-sm">Demo Verisi</p><p className="text-[10px] text-slate-400 font-bold uppercase">Urban Sales</p></div>
              </button>
              <button onClick={handleStartTour} className="flex items-center gap-4 p-4 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-2xl transition-all group">
                <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-indigo-600"><PlayCircle className="w-5 h-5" /></div>
                <div className="text-left"><p className="font-bold text-indigo-900 text-sm">Hızlı Rehber</p><p className="text-[10px] text-indigo-400 font-bold uppercase">Nasıl Çalışır?</p></div>
              </button>
            </div>
          </div>

          {history.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2 text-slate-400"><Clock className="w-4 h-4" /><span className="text-xs font-black uppercase tracking-widest">Son Yüklemeler</span></div>
                <button onClick={clearHistory} className="text-xs font-black text-slate-400 hover:text-rose-500 transition-colors flex items-center gap-1.5"><Trash2 className="w-3.5 h-3.5" /> Temizle</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {history.map((item) => (
                  <button key={item.id} onClick={() => loadFromHistory(item)} className="flex flex-col p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md hover:border-indigo-100 transition-all text-left group">
                    <p className="font-bold text-slate-900 truncate w-full group-hover:text-indigo-600 transition-colors">{item.name}</p>
                    <p className="text-[10px] text-slate-400 mt-1 uppercase font-black tracking-widest">{new Date(item.timestamp).toLocaleDateString()}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => setCurrentPage(Page.Landing)}
            className="mx-auto flex items-center gap-2 text-slate-400 hover:text-slate-600 font-bold text-sm transition-colors"
          >
            <Home className="w-4 h-4" /> Ana Sayfaya Dön
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {pageContent}
      <TermsGate
        triggerMode
        active={termsModalActive}
        version={TERMS_VERSION}
        storageKey={TERMS_STORAGE_KEY}
        onAccepted={handleTermsAccepted}
      />
    </>
  );
};

export default App;
