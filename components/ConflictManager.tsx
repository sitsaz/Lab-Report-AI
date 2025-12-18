import React, { useState, useEffect } from 'react';
import { AlertTriangle, Layers, RefreshCw, Shield, Save, CheckCircle2, FileText, Sparkles } from 'lucide-react';
import { Message } from '../types';

interface ConflictManagerProps {
  conflicts: Message[];
  onBulkResolve: (resolutions: Record<string, 'kept_existing' | 'updated_new' | 'combined'>) => void;
  language: 'en' | 'fa';
}

const ConflictManager: React.FC<ConflictManagerProps> = ({ conflicts, onBulkResolve, language }) => {
  const isRTL = language === 'fa';
  const [selections, setSelections] = useState<Record<string, 'kept_existing' | 'updated_new' | 'combined'>>({});

  useEffect(() => {
    setSelections({});
  }, [conflicts.length]);

  const handleSelect = (id: string, resolution: 'kept_existing' | 'updated_new' | 'combined') => {
    setSelections(prev => ({ ...prev, [id]: resolution }));
  };

  const isComplete = conflicts.every(c => selections[c.id]);

  if (conflicts.length === 0) {
    return (
        <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8">
            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-4 border-2 border-green-100">
                <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
            <p className="font-bold text-slate-600 text-lg">{isRTL ? 'تمام تضادها برطرف شدند!' : 'All Clear!'}</p>
        </div>
    );
  }

  return (
    <div className={`flex flex-col h-full bg-slate-50/30 ${isRTL ? 'font-persian' : ''}`} dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="p-4 border-b border-slate-100 bg-white shadow-sm sticky top-0 z-20">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 font-bold text-slate-800">
                    <div className="p-1.5 bg-amber-100 rounded-lg">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                    </div>
                    <span>{isRTL ? 'مدیریت تضادهای داده‌ای' : 'Data Conflict Center'}</span>
                </div>
                <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                    {conflicts.length} {isRTL ? 'مورد در انتظار' : 'Pending'}
                </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
                {isRTL 
                 ? 'داده‌های ورودی جدید با متن گزارش فعلی مغایرت دارند. لطفاً برای هر مورد استراتژی ادغام را انتخاب کنید.' 
                 : 'New inputs conflict with existing report data. Choose a strategy for each discrepancy.'}
            </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-8">
            {conflicts.map((msg, index) => {
                if (!msg.conflict) return null;
                const currentSelection = selections[msg.id];

                return (
                    <div key={msg.id} className={`bg-white border rounded-xl shadow-sm overflow-hidden flex flex-col transition-all ${currentSelection ? 'border-indigo-300 ring-1 ring-indigo-100' : 'border-slate-200'}`}>
                        {/* Header Section */}
                        <div className="bg-slate-50/50 border-b border-slate-100 p-3 flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600 flex-shrink-0 mt-0.5">
                                {index + 1}
                            </div>
                            <div className="flex-1">
                                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                                    {msg.conflict.description}
                                </h4>
                                {msg.conflict.reasoning && (
                                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                                        {msg.conflict.reasoning}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Comparison Grid with Enhanced Distinction */}
                        <div className="p-4 space-y-4 bg-white">
                            {/* Existing Section */}
                            <div className="space-y-2">
                                <div className="flex items-center gap-1.5 px-1">
                                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                        {isRTL ? 'متن فعلی گزارش' : 'Current Report'}
                                    </label>
                                </div>
                                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 italic leading-relaxed relative overflow-hidden">
                                    <div className="absolute top-0 bottom-0 left-0 w-1 bg-slate-300"></div>
                                    "{msg.conflict.existing_info}"
                                </div>
                            </div>

                            {/* New Input Section */}
                            <div className="space-y-2">
                                <div className="flex items-center gap-1.5 px-1">
                                    <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                                    <label className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">
                                        {isRTL ? 'داده ورودی جدید' : 'New Input'}
                                    </label>
                                </div>
                                <div className="bg-indigo-50/40 border border-indigo-200 rounded-lg p-3 text-xs text-slate-800 font-medium leading-relaxed relative overflow-hidden">
                                    <div className="absolute top-0 bottom-0 left-0 w-1 bg-indigo-500"></div>
                                    "{msg.conflict.new_info}"
                                </div>
                            </div>
                        </div>

                        {/* Selection Options */}
                        <div className="p-3 bg-slate-50/80 border-t border-slate-100 grid grid-cols-3 gap-3">
                            <button
                                onClick={() => handleSelect(msg.id, 'kept_existing')}
                                className={`flex flex-col items-center justify-center gap-2 py-3 rounded-lg border transition-all ${
                                    currentSelection === 'kept_existing' 
                                    ? 'bg-white border-slate-400 shadow-sm text-slate-800 ring-2 ring-slate-100' 
                                    : 'bg-white/50 border-slate-200 text-slate-400 hover:bg-white hover:text-slate-600'
                                }`}
                            >
                                <Shield className={`w-4 h-4 ${currentSelection === 'kept_existing' ? 'text-slate-600' : 'text-slate-300'}`} />
                                <span className="text-[10px] font-bold text-center leading-tight">
                                    {isRTL ? 'ادامه با قبلی' : 'Keep Original'}
                                </span>
                            </button>
                            
                            <button
                                onClick={() => handleSelect(msg.id, 'combined')}
                                className={`flex flex-col items-center justify-center gap-2 py-3 rounded-lg border transition-all ${
                                    currentSelection === 'combined' 
                                    ? 'bg-amber-50 border-amber-300 shadow-sm text-amber-800 ring-2 ring-amber-100' 
                                    : 'bg-white/50 border-slate-200 text-slate-400 hover:bg-amber-50 hover:text-amber-600'
                                }`}
                            >
                                <Layers className={`w-4 h-4 ${currentSelection === 'combined' ? 'text-amber-600' : 'text-slate-300'}`} />
                                <span className="text-[10px] font-bold text-center leading-tight">
                                    {isRTL ? 'ترکیب هوشمند' : 'Combine/Merge'}
                                </span>
                            </button>

                            <button
                                onClick={() => handleSelect(msg.id, 'updated_new')}
                                className={`flex flex-col items-center justify-center gap-2 py-3 rounded-lg border transition-all ${
                                    currentSelection === 'updated_new' 
                                    ? 'bg-indigo-50 border-indigo-400 shadow-sm text-indigo-800 ring-2 ring-indigo-100' 
                                    : 'bg-white/50 border-slate-200 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600'
                                }`}
                            >
                                <RefreshCw className={`w-4 h-4 ${currentSelection === 'updated_new' ? 'text-indigo-600' : 'text-slate-300'}`} />
                                <span className="text-[10px] font-bold text-center leading-tight">
                                    {isRTL ? 'بازنویسی نوین' : 'Overwrite'}
                                </span>
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>

        <div className="p-4 bg-white border-t border-slate-200 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] sticky bottom-0 z-20">
            <button
                onClick={() => onBulkResolve(selections)}
                disabled={!isComplete}
                className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold transition-all ${
                    isComplete 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-95' 
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
            >
                <Save className="w-5 h-5" />
                {isRTL ? 'تایید و اعمال تمامی تغییرات' : 'Submit & Apply All'}
            </button>
            {!isComplete && (
                <p className="text-[10px] text-center text-slate-400 mt-2 font-medium">
                    {isRTL ? 'ابتدا برای تمامی تضادها یک گزینه انتخاب کنید' : 'Please resolve all conflicts to submit'}
                </p>
            )}
        </div>
    </div>
  );
};

export default ConflictManager;