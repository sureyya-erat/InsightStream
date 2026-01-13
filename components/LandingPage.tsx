
import React from 'react';
import { Sparkles, Upload, BarChart3, FileText, Globe, ShieldCheck, PlayCircle, ArrowRight, TrendingUp, MessageSquare, PieChart, Activity, Calendar } from 'lucide-react';

interface Props {
  onStart: () => void;
  onDemo: () => void;
  onTour: () => void;
}

const ProductMockup = () => (
  <div className="relative w-full max-w-2xl mx-auto lg:mx-0">
    {/* Main Dashboard Window */}
    <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-200 overflow-hidden transform rotate-1 hover:rotate-0 transition-transform duration-700 select-none">
      <div className="h-8 bg-slate-50 border-b border-slate-100 flex items-center px-4 gap-1.5">
        <div className="w-2.5 h-2.5 rounded-full bg-rose-400"></div>
        <div className="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
      </div>
      <div className="p-6 space-y-6 bg-white">
        {/* Header Mock */}
        <div className="flex justify-between items-center mb-2">
          <div className="space-y-1">
            <div className="h-4 w-32 bg-slate-100 rounded-lg"></div>
            <div className="h-2 w-20 bg-slate-50 rounded-lg"></div>
          </div>
          <div className="flex gap-2">
            <div className="h-8 w-8 bg-indigo-50 rounded-lg"></div>
            <div className="h-8 w-24 bg-indigo-600 rounded-lg"></div>
          </div>
        </div>
        {/* KPIs Mock */}
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
              <div className="h-2 w-12 bg-slate-200 rounded"></div>
              <div className="h-4 w-20 bg-indigo-200 rounded"></div>
            </div>
          ))}
        </div>
        {/* Chart Mock */}
        <div className="h-40 w-full bg-slate-50 rounded-3xl border border-slate-100 p-4 flex items-end justify-between gap-2">
          {[40, 70, 45, 90, 65, 80, 55, 85].map((h, i) => (
            <div key={i} className="bg-indigo-500 rounded-t-lg w-full transition-all duration-1000" style={{ height: `${h}%`, opacity: 0.1 + (h/100) }}></div>
          ))}
        </div>
      </div>
    </div>

    {/* Floating Chat Bubble */}
    <div className="absolute -bottom-6 -right-6 bg-white p-4 rounded-2xl shadow-xl border border-indigo-100 w-64 animate-bounce hover:animate-none transition-all cursor-default hidden md:block">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
          <Sparkles className="w-4 h-4" />
        </div>
        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">AI Analiz</p>
      </div>
      <p className="text-[11px] font-bold text-slate-600 leading-relaxed">
        "İstanbul şubesinde kârlılık geçen aya göre %12 arttı. Özellikle kahve kategorisi..."
      </p>
    </div>

    {/* Floating Sim Card */}
    <div className="absolute -top-10 -left-10 bg-indigo-900 text-white p-5 rounded-3xl shadow-2xl w-48 hidden lg:block border border-indigo-800 backdrop-blur-sm bg-opacity-95">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-emerald-400" />
        <p className="text-[10px] font-black uppercase tracking-widest">Simülasyon</p>
      </div>
      <div className="space-y-3">
        <div className="h-1 w-full bg-indigo-800 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-400 w-3/4"></div>
        </div>
        <p className="text-xs font-bold">+₺245k Tahmini Etki</p>
      </div>
    </div>
  </div>
);

export const LandingPage: React.FC<Props> = ({ onStart, onDemo, onTour }) => {
  const handleStartClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onStart();
  };

  const handleDemoClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onDemo();
  };

  return (
    <div className="min-h-screen bg-slate-50 overflow-x-hidden">
      {/* Navbar */}
      <nav className="px-8 py-6 flex justify-between items-center max-w-7xl mx-auto">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.location.reload()}>
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-200">IS</div>
          <span className="text-xl font-black text-slate-900 tracking-tight">InsightStream</span>
        </div>
        <div className="flex items-center gap-4 sm:gap-8">
          <button type="button" onClick={onTour} className="hidden sm:flex text-[11px] font-black uppercase text-indigo-600 items-center gap-1.5 hover:text-indigo-700 transition-colors tracking-widest">
            <PlayCircle className="w-4 h-4" /> Turu Başlat
          </button>
          <button type="button" onClick={handleStartClick} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-95">
            Hemen Başla
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-8 pt-16 pb-24 text-center lg:text-left flex flex-col lg:flex-row items-center gap-20">
        <div className="flex-1 space-y-10" data-tour="hero-landing">
          <div className="inline-flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm">
            <span className="flex h-2 w-2 rounded-full bg-indigo-600 animate-ping"></span>
            Yapay Zeka Destekli BI Çözümü
          </div>
          <div className="space-y-6">
            <h1 className="text-5xl lg:text-8xl font-black text-slate-900 leading-[0.95] tracking-tighter">
              Verini Yükle, <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-br from-indigo-600 via-indigo-500 to-violet-600">
                Geleceği Gör.
              </span>
            </h1>
            <p className="text-xl text-slate-500 max-w-2xl leading-relaxed font-medium">
              Excel, CSV veya JSON dosyalarınızı saniyeler içinde profesyonel BI dashboard'larına dönüştürün. Gemini AI içgörüleri ve akıllı simülasyonlar ile verinizi konuşturun.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
            <button 
              type="button"
              onClick={handleStartClick}
              className="px-10 py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[1.5rem] font-black uppercase tracking-widest text-sm shadow-2xl shadow-indigo-200 transition-all transform hover:-translate-y-1 flex items-center justify-center gap-3"
            >
              <Upload className="w-5 h-5" /> Veri Yükleyerek Başla
            </button>
            <button 
              type="button"
              onClick={onTour}
              className="px-10 py-5 bg-white border border-slate-200 hover:bg-slate-50 text-indigo-600 rounded-[1.5rem] font-black uppercase tracking-widest text-sm transition-all flex items-center justify-center gap-3 shadow-lg shadow-slate-100"
            >
              <PlayCircle className="w-5 h-5" /> Rehber Tur
            </button>
          </div>

          <div className="pt-2">
            <button 
              type="button"
              onClick={handleDemoClick}
              className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 hover:text-indigo-600 flex items-center gap-2 transition-colors mx-auto lg:mx-0"
            >
              Hazır örnek veri setiyle dene <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="flex-1 w-full lg:w-auto">
          <ProductMockup />
          <p className="text-center text-[10px] font-black text-slate-300 uppercase tracking-widest mt-12 opacity-60">
            Örnek dashboard görünümü (verinize göre otomatik oluşur)
          </p>
        </div>
      </main>

      {/* Quick Highlights */}
      <div className="max-w-7xl mx-auto px-8 grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
        {[
          { icon: <Activity className="w-5 h-5" />, title: "Otomatik Dashboard", desc: "10+ Dinamik grafik ve KPI kartı saniyeler içinde hazır." },
          { icon: <MessageSquare className="w-5 h-5" />, title: "Veri ile Sohbet", desc: "Sorular sorun, Gemini AI cevapları ve mini grafikleri üretsin." },
          { icon: <TrendingUp className="w-5 h-5" />, title: "What-if Analizi", desc: "Fiyat ve marj değişimlerinin ciro/kâr etkisini simüle edin." }
        ].map((h, i) => (
          <div key={i} className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-6">{h.icon}</div>
            <h4 className="text-lg font-black text-slate-900 mb-2 uppercase tracking-tight">{h.title}</h4>
            <p className="text-sm text-slate-500 font-medium leading-relaxed">{h.desc}</p>
          </div>
        ))}
      </div>

      {/* Main Features Grid */}
      <section className="bg-white py-32 border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-8">
          <div className="text-center max-w-3xl mx-auto mb-20 space-y-4">
            <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter">Kapsamlı BI Araç Kiti</h2>
            <p className="text-slate-500 font-medium">İhtiyacınız olan her şey tek bir platformda, kurulum gerektirmeden çalışır.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-16">
            {[
              { icon: <Upload className="w-6 h-6" />, title: "Akıllı Veri Ayrıştırma", desc: "Sütunları, tarih formatlarını ve sayısal değerleri otomatik tespit eder ve normalize eder." },
              { icon: <Sparkles className="w-6 h-6" />, title: "AI Narratives", desc: "Grafiklerin ötesinde, verilerinizin ne anlattığını Gemini AI ile doğal dilde okuyun." },
              { icon: <PieChart className="w-6 h-6" />, title: "Gelişmiş Görselleştirme", desc: "Pareto analizinden, tahminleme çizgilerine kadar profesyonel BI grafiklerini kullanın." },
              { icon: <FileText className="w-6 h-6" />, title: "PDF Raporlama", desc: "Analizlerinizi tek tıkla profesyonel PDF'lere dönüştürün veya yazdırın." },
              { icon: <Calendar className="w-6 h-6" />, title: "Otomatik Gönderim", desc: "Raporlarınızı belirli aralıklarla e-posta olarak gönderilecek şekilde zamanlayın." },
              { icon: <ShieldCheck className="w-6 h-6" />, title: "Gizlilik Öncelikli", desc: "Verileriniz asla buluta kaydedilmez, her şey tarayıcınızın içinde güvenle işlenir." }
            ].map((f, i) => (
              <div key={i} className="flex gap-6 group">
                <div className="w-14 h-14 bg-slate-50 group-hover:bg-indigo-600 group-hover:text-white rounded-2xl flex items-center justify-center text-indigo-600 transition-all shrink-0 shadow-sm border border-slate-100 group-hover:border-indigo-600">
                  {f.icon}
                </div>
                <div>
                  <h4 className="text-lg font-black mb-3 text-slate-900 uppercase tracking-tight">{f.title}</h4>
                  <p className="text-slate-500 leading-relaxed text-sm font-medium">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-24 text-center">
            <button 
              type="button"
              onClick={handleStartClick}
              className="px-12 py-6 bg-slate-900 text-white rounded-3xl font-black uppercase tracking-[0.2em] text-xs hover:bg-slate-800 transition-all shadow-2xl active:scale-95"
            >
              Ücretsiz Kullanmaya Başla
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 text-center">
        <div className="flex items-center justify-center gap-2 mb-4 opacity-40">
          <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white font-black text-xs">IS</div>
          <span className="text-lg font-black text-slate-900 tracking-tight">InsightStream</span>
        </div>
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em]">
          © 2024 AI DASHBOARD BUILDER • POWERED BY GEMINI
        </p>
      </footer>
    </div>
  );
};
