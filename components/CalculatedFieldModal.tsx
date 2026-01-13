
import React, { useState, useMemo } from 'react';
import { CalculatedField, Dataset } from '../types';
import { X, Save, Calculator, HelpCircle, AlertCircle, Plus } from 'lucide-react';
import { CalculationModule } from '../services/calculationModule';

interface Props {
  dataset: Dataset;
  onSave: (field: CalculatedField) => void;
  onClose: () => void;
}

export const CalculatedFieldModal: React.FC<Props> = ({ dataset, onSave, onClose }) => {
  const [name, setName] = useState('');
  const [expression, setExpression] = useState('');
  const [previewRows, setPreviewRows] = useState<any[]>([]);

  const columns = useMemo(() => dataset.columns, [dataset]);

  const handleInsertColumn = (col: string) => {
    setExpression(prev => prev + `[${col}]`);
  };

  const preview = useMemo(() => {
    if (!expression) return [];
    return dataset.rows.slice(0, 5).map(row => ({
      ...row,
      result: CalculationModule.evaluateExpression(expression, row)
    }));
  }, [expression, dataset]);

  const handleSave = () => {
    if (!name || !expression) return;
    onSave({
      id: `calc_${Date.now()}`,
      name,
      expression,
      type: 'numeric'
    });
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 duration-500 flex flex-col max-h-[90vh]">
        <div className="p-8 bg-indigo-600 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Calculator className="w-6 h-6" />
            <h3 className="font-black uppercase tracking-widest text-sm">Hesaplı Alan Oluştur</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-8 overflow-y-auto space-y-6 flex-1">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-400">Alan Adı</label>
            <input 
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Örn: Net_Kar_Orani"
              className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-2">
             <div className="flex justify-between items-center">
                <label className="text-[10px] font-black uppercase text-slate-400">Formül (Expression)</label>
                <div className="group relative">
                  <HelpCircle className="w-4 h-4 text-slate-300 cursor-help" />
                  <div className="absolute right-0 bottom-6 w-64 p-4 bg-slate-900 text-white text-[10px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-xl">
                    Sütunları köşeli parantez içinde kullanın: [Revenue] - [Cost]. 
                    İzin verilen operatörler: +, -, *, /, (, ).
                  </div>
                </div>
             </div>
             <textarea 
               value={expression}
               onChange={e => setExpression(e.target.value)}
               placeholder="[Revenue] - [Cost]"
               rows={3}
               className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-mono font-bold outline-none focus:ring-2 focus:ring-indigo-500"
             />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-400">Sütun Ekle</label>
            <div className="flex flex-wrap gap-2">
              {columns.map(col => (
                <button 
                  key={col} 
                  onClick={() => handleInsertColumn(col)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-[10px] font-bold transition-colors border border-slate-200"
                >
                  <Plus className="w-3 h-3 inline mr-1" /> {col}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-100">
             <p className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2"><AlertCircle className="w-3 h-3" /> Önizleme (İlk 5 Satır)</p>
             <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-left text-[10px]">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="p-2 font-black uppercase text-slate-400">#</th>
                      <th className="p-2 font-black uppercase text-indigo-600">Sonuç ({name || '...'})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {preview.map((row, i) => (
                      <tr key={i}>
                        <td className="p-2 text-slate-400">{i + 1}</td>
                        <td className="p-2 font-bold text-slate-700">{typeof row.result === 'number' ? row.result.toLocaleString() : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
          </div>
        </div>

        <div className="p-6 bg-slate-50 flex justify-end gap-4">
          <button onClick={onClose} className="px-6 py-3 text-slate-400 font-black uppercase text-xs hover:text-slate-600">İptal</button>
          <button 
            onClick={handleSave} 
            disabled={!name || !expression}
            className="px-8 py-3 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-100 disabled:opacity-50"
          >
            <Save className="w-4 h-4 inline mr-2" /> Kaydet
          </button>
        </div>
      </div>
    </div>
  );
};
