
import React, { useState, useEffect } from 'react';
import { ScheduledReport, Dataset } from '../types';
import { EmailService } from '../services/emailService';
import { 
  Calendar, Mail, Clock, Send, Trash, Play, StopCircle, 
  CheckCircle2, XCircle, ChevronRight, AlertCircle, Sparkles, Bell, RefreshCw, Loader2
} from 'lucide-react';

interface Props {
  dataset: Dataset;
}

export const SchedulingPage: React.FC<Props> = ({ dataset }) => {
  const [reports, setReports] = useState<ScheduledReport[]>([]);
  const [email, setEmail] = useState('');
  const [reportType, setReportType] = useState<'manager' | 'detail'>('manager');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [day, setDay] = useState('Pazartesi');
  const [time, setTime] = useState('09:00');
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSending, setIsSending] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(`insightstream_schedules_${dataset.name}`);
    if (saved) setReports(JSON.parse(saved));
  }, [dataset.name]);

  const saveToStorage = (updated: ScheduledReport[]) => {
    setReports(updated);
    localStorage.setItem(`insightstream_schedules_${dataset.name}`, JSON.stringify(updated));
  };

  const handleCreate = () => {
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      showNotification('error', 'Geçerli bir e-posta adresi giriniz.');
      return;
    }

    const newReport: ScheduledReport = {
      id: `sch_${Date.now()}`,
      datasetId: dataset.name,
      datasetName: dataset.name,
      email,
      reportType,
      frequency,
      day: frequency === 'weekly' ? day : undefined,
      time,
      isEnabled: true,
      createdAt: Date.now()
    };

    const updated = [newReport, ...reports];
    saveToStorage(updated);
    setEmail('');
    showNotification('success', 'Rapor zamanlaması başarıyla oluşturuldu.');
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const testSmtp = async () => {
    setIsTesting(true);
    const result = await EmailService.testSmtpConnection();
    setIsTesting(false);
    showNotification(result.success ? 'success' : 'error', result.message);
  };

  const toggleReport = (id: string) => {
    const updated = reports.map(r => r.id === id ? { ...r, isEnabled: !r.isEnabled } : r);
    saveToStorage(updated);
  };

  const deleteReport = (id: string) => {
    if (!confirm("Bu rapor zamanlamasını silmek istediğinize emin misiniz?")) return;
    const updated = reports.filter(r => r.id !== id);
    saveToStorage(updated);
  };

  const runNow = async (report: ScheduledReport) => {
    setIsSending(report.id);
    const summary = `${dataset.summary.rowCount} satır, ${dataset.summary.colCount} sütun analiz edildi.`;
    const result = await EmailService.sendReport(report, summary);
    setIsSending(null);

    if (result.success) {
      showNotification('success', `${report.email} adresine gerçek rapor gönderildi.`);
      const updated = reports.map(r => r.id === report.id ? { 
        ...r, 
        lastRunAt: Date.now(), 
        lastStatus: 'SUCCESS' as const,
        errorMessage: undefined
      } : r);
      saveToStorage(updated);
    } else {
      showNotification('error', `Gönderim Hatası: ${result.error}`);
      const updated = reports.map(r => r.id === report.id ? { 
        ...r, 
        lastRunAt: Date.now(), 
        lastStatus: 'FAILED' as const,
        errorMessage: result.error
      } : r);
      saveToStorage(updated);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-12 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Zamanlanmış Raporlar</h2>
          <p className="text-slate-500 text-sm">Dashboard verilerini belirli aralıklarla e-posta olarak gönderin.</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={testSmtp}
            disabled={isTesting}
            className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-xl text-slate-600 font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all disabled:opacity-50"
          >
            {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            SMTP Bağlantısını Test Et
          </button>
          <div className="flex items-center gap-2 bg-indigo-50 px-4 py-2 rounded-xl text-indigo-600 border border-indigo-100">
            <Bell className="w-4 h-4" />
            <span className="text-xs font-black uppercase tracking-widest">Zamanlama Modülü Aktif</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 space-y-6 sticky top-24">
            <div className="flex items-center gap-3 mb-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              <h3 className="font-black text-xs uppercase tracking-widest text-slate-400">Yeni Zamanlama</h3>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400">Alıcı E-posta</label>
                <div className="relative">
                   <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                   <input 
                    type="email" 
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="ornek@sirket.com"
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 pl-10 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                   />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400">Rapor Türü</label>
                <select 
                  value={reportType}
                  onChange={e => setReportType(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="manager">Yönetici Özeti (Özet KPI + AI İçgörü)</option>
                  <option value="detail">Detaylı Rapor (Tüm Grafikler + Öneriler)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400">Sıklık</label>
                  <select 
                    value={frequency}
                    onChange={e => setFrequency(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="daily">Günlük</option>
                    <option value="weekly">Haftalık</option>
                    <option value="monthly">Aylık</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400">Saat</label>
                  <input 
                    type="time"
                    value={time}
                    onChange={e => setTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {frequency === 'weekly' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400">Gün Seçimi</label>
                  <select 
                    value={day}
                    onChange={e => setDay(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'].map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              )}

              <div className="pt-4">
                <button 
                  onClick={handleCreate}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all transform active:scale-95"
                >
                  <Calendar className="w-4 h-4" /> Zamanlanmış Rapor Oluştur
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2 text-slate-400">
               <Clock className="w-4 h-4" />
               <span className="text-[10px] font-black uppercase tracking-widest">Mevcut Zamanlamalar ({reports.length})</span>
            </div>
          </div>

          {reports.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-slate-100 rounded-[2.5rem] p-24 flex flex-col items-center justify-center text-center space-y-4 opacity-40">
               <Mail className="w-16 h-16 text-slate-300" />
               <div className="space-y-1">
                 <p className="font-black uppercase tracking-widest text-xs">Henüz Rapor Kurulmadı</p>
                 <p className="text-xs">Sol taraftaki formu kullanarak ilk zamanlamanızı oluşturun.</p>
               </div>
            </div>
          ) : (
            <div className="space-y-4">
              {reports.map(report => (
                <div key={report.id} className={`bg-white border p-6 rounded-[2rem] transition-all flex flex-col md:flex-row items-center justify-between gap-6 hover:shadow-lg ${report.isEnabled ? 'border-slate-100' : 'border-slate-50 opacity-60'}`}>
                  <div className="flex items-center gap-6 flex-1 w-full">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${report.isEnabled ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                      {report.frequency === 'daily' ? <Clock className="w-6 h-6" /> : <Calendar className="w-6 h-6" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-black text-slate-900 truncate">{report.email}</h4>
                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${report.reportType === 'manager' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {report.reportType === 'manager' ? 'Yönetici' : 'Detaylı'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {report.frequency} / {report.day || 'Her Gün'} / {report.time}</span>
                        {report.lastRunAt && (
                          <div className="flex items-center gap-2">
                             <span className="flex items-center gap-1 text-slate-300 italic"><CheckCircle2 className={`w-3 h-3 ${report.lastStatus === 'SUCCESS' ? 'text-emerald-500' : 'text-rose-500'}`} /> Son: {new Date(report.lastRunAt).toLocaleDateString()}</span>
                             {report.lastStatus === 'FAILED' && (
                               <span className="text-rose-400 font-bold lowercase truncate max-w-[200px]" title={report.errorMessage}>Hata: {report.errorMessage}</span>
                             )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full md:w-auto shrink-0 border-t md:border-t-0 pt-4 md:pt-0">
                    <button 
                      onClick={() => toggleReport(report.id)}
                      className={`flex-1 md:flex-none p-3 rounded-xl transition-colors ${report.isEnabled ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                    >
                      {report.isEnabled ? <StopCircle className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                    <button 
                      onClick={() => runNow(report)}
                      disabled={isSending === report.id}
                      className="flex-1 md:flex-none p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors disabled:opacity-50"
                    >
                      {isSending === report.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                    <button 
                      onClick={() => deleteReport(report.id)}
                      className="flex-1 md:flex-none p-3 bg-rose-50 text-rose-400 rounded-xl hover:bg-rose-100 transition-colors"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="bg-slate-50 border border-slate-100 p-6 rounded-3xl flex gap-4 items-start">
             <AlertCircle className="w-6 h-6 text-indigo-400 shrink-0" />
             <div className="space-y-1">
               <p className="text-[10px] font-black uppercase text-slate-500">Önemli: SMTP Yapılandırması</p>
               <p className="text-xs text-slate-400 leading-relaxed italic">
                 E-posta gönderimi için <strong>backend sunucusu (.env)</strong> üzerinde Gmail App Password yapılandırılmalıdır. Ayarlar eksikse rapor gönderimi başarısız olacaktır.
               </p>
             </div>
          </div>
        </div>
      </div>

      {notification && (
        <div className={`fixed bottom-8 right-8 z-[300] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right-8 duration-500 ${notification.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
          {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          <span className="text-sm font-bold uppercase tracking-tight">{notification.message}</span>
        </div>
      )}
    </div>
  );
};
