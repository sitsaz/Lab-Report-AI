
import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Layers, 
  RefreshCw, 
  Shield, 
  Save, 
  CheckCircle2, 
  FileText, 
  Sparkles, 
  Check, 
  Loader2, 
  ArrowDown, 
  Info,
  History,
  Cpu,
  Database,
  SearchCode
} from 'lucide-react';
import { Message } from '../types';

interface ConflictManagerProps {
  conflicts: Message[];
  onBulkResolve: (resolutions: Record<string, 'kept_existing' | 'updated_new' | 'combined'>) => void;
  language: 'en' | 'fa';
}

const ConflictManager: React.FC<ConflictManagerProps> = ({ conflicts, onBulkResolve, language }) => {
  const isRTL = language === 'fa';
  const [selections, setSelections] = useState<Record<string, 'kept_existing' | 'updated_new' | 'combined'>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    setSelections({});
    setShowSuccess(false);
  }, [conflicts.length]);

  const handleSelect = (id: string, resolution: 'kept_existing' | 'updated_new' | 'combined') => {
    setSelections(prev => ({ ...prev, [id]: resolution }));
  };

  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 800));
    setShowSuccess(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    onBulkResolve(selections);
    setIsSubmitting(false);
  };

  const isComplete = conflicts.every(c => selections[c.id]);

  if (conflicts.length === 0 || showSuccess) {
    return (
        <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 animate-in fade-in zoom-in duration-500 fill-mode-both">
            <div className="relative">
                <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mb-6 border-4 border-green-100 shadow-xl shadow-green-100/50">
                    <CheckCircle2 className="w-12 h-12 text-green-500 animate-in zoom-in spin-in-12 duration-700" />
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-sm">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                </div>
            </div>
            <h3 className="font-bold text-slate-800 text-2xl mb-2 tracking-tight">
                {isRTL ? 'تغییرات با موفقیت اعمال شد!' : 'Conflicts Resolved!'}
            </h3>
            <p className="text-sm text-slate-400 text-center max-w-xs leading-relaxed">
                {isRTL ? 'گزارش شما با انتخاب‌های انجام شده به‌روزرسانی شد.' : 'Your laboratory report has been successfully updated with the merged data.'}
            </p>
        </div>
    );
  }

  return (
    <div className={`flex flex-col h-full bg-slate-100/30 ${isRTL ? 'font-persian' : ''}`} dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="p-4 border-b border-slate-200 bg-white shadow-sm sticky top-0 z-20">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5 font-bold text-slate-800">
                    <div className="p-2 bg-amber-50 rounded-xl border border-amber-100">
                        <AlertTriangle className="w-4.5 h-4.5 text-amber-600" />
                    </div>
                    <div className="flex flex-col">
                        <span className="leading-none">{isRTL ? 'مرکز مدیریت تضادها' : 'Conflict Resolution Hub'}</span>
                        <span className="text-[10px] text-slate-400 font-medium mt-1 uppercase tracking-widest">Verify & Harmonize Data</span>
                    </div>
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 shadow-sm">
                        {conflicts.length} {isRTL ? 'مورد باقی‌مانده' : 'Pending Review'}
                    </span>
                </div>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-12 pb-24">
            {conflicts.map((msg, index) => {
                if (!msg.conflict) return null;
                const currentSelection = selections[msg.id];

                return (
                    <div 
                        key={msg.id} 
                        className={`group relative bg-white border rounded-3xl transition-all duration-500 ease-out flex flex-col ${
                            currentSelection 
                            ? 'border-indigo-500 ring-8 ring-indigo-50/50 shadow-2xl transform scale-[1.02] -translate-y-1' 
                            : 'border-slate-200 hover:border-slate-300 shadow-lg'
                        }`}
                    >
                        {/* Status Badge */}
                        {currentSelection && (
                            <div className="absolute -top-3 -right-3 bg-indigo-600 text-white p-2 rounded-full shadow-lg z-10 animate-in zoom-in duration-300">
                                <Check className="w-5 h-5 stroke-[3]" />
                            </div>
                        )}

                        {/* Card Header */}
                        <div className={`border-b px-6 py-4 flex items-center gap-4 transition-colors rounded-t-3xl ${currentSelection ? 'bg-indigo-50/50 border-indigo-100' : 'bg-slate-50 border-slate-100'}`}>
                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-black flex-shrink-0 transition-all ${currentSelection ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white border-2 border-slate-200 text-slate-400'}`}>
                                {index + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className={`text-sm font-black uppercase tracking-wider truncate ${currentSelection ? 'text-indigo-900' : 'text-slate-800'}`}>
                                    {msg.conflict.description}
                                </h4>
                                {msg.conflict.reasoning && (
                                    <p className="text-xs text-slate-500 mt-1 font-medium flex items-center gap-1.5 leading-tight italic">
                                        <Info className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                        {msg.conflict.reasoning}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Comparison Grid with High Visual Distinction */}
                        <div className="p-6 space-y-10 relative">
                            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-white border-4 border-slate-100 rounded-full flex items-center justify-center z-10 shadow-lg text-slate-300 group-hover:text-indigo-500 group-hover:border-indigo-100 transition-all duration-300 group-hover:scale-110">
                                <SearchCode className="w-6 h-6" />
                            </div>

                            {/* Section 1: STABLE/EXISTING DATA */}
                            <div className={`space-y-3 relative transition-all duration-300 ${currentSelection === 'kept_existing' ? 'opacity-100' : currentSelection ? 'opacity-30 blur-[0.5px]' : ''}`}>
                                <div className="flex items-center justify-between px-1">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-slate-200 rounded-lg">
                                            <Database className="w-3.5 h-3.5 text-slate-600" />
                                        </div>
                                        <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                                            {isRTL ? 'داده‌های موجود' : 'Stable Data'}
                                        </label>
                                    </div>
                                    <div className="px-2 py-0.5 bg-slate-200 text-[8px] font-black text-slate-500 rounded uppercase tracking-tighter">Established</div>
                                </div>
                                <div className="relative bg-slate-100 border-2 border-slate-300 border-solid rounded-2xl p-6 text-xs text-slate-700 leading-relaxed shadow-inner font-semibold font-mono min-h-[80px]">
                                    <div className="absolute top-2 right-4 opacity-[0.05] pointer-events-none select-none">
                                        <FileText className="w-16 h-16 text-slate-900" />
                                    </div>
                                    {msg.conflict.existing_info}
                                </div>
                            </div>

                            {/* Section 2: PROPOSED/NEW DATA */}
                            <div className={`space-y-3 relative transition-all duration-300 ${currentSelection === 'updated_new' || currentSelection === 'combined' ? 'opacity-100' : currentSelection ? 'opacity-30 blur-[0.5px]' : ''}`}>
                                <div className="flex items-center justify-between px-1">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-indigo-100 rounded-lg">
                                            <Cpu className="w-3.5 h-3.5 text-indigo-500" />
                                        </div>
                                        <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">
                                            {isRTL ? 'داده‌های پیشنهادی هوش مصنوعی' : 'Proposed Data'}
                                        </label>
                                    </div>
                                    <div className="px-2 py-0.5 bg-indigo-600 text-[8px] font-black text-white rounded shadow-sm uppercase tracking-tighter">New Logic</div>
                                </div>
                                <div className={`relative bg-indigo-50 border-2 border-dashed rounded-2xl p-6 text-xs text-indigo-900 leading-relaxed shadow-[0_4px_15px_-5px_rgba(79,70,229,0.2)] transition-all duration-500 font-bold font-mono min-h-[80px] ${currentSelection === 'updated_new' || currentSelection === 'combined' ? 'border-indigo-500 bg-indigo-100/50' : 'border-indigo-300'}`}>
                                    <div className="absolute top-2 right-4 opacity-[0.1] pointer-events-none select-none">
                                        <Sparkles className="w-16 h-16 text-indigo-600" />
                                    </div>
                                    {msg.conflict.new_info}
                                </div>
                            </div>
                        </div>

                        {/* Enhanced Resolution Strategy Selector */}
                        <div className="px-6 py-6 bg-slate-50/50 border-t border-slate-100 rounded-b-3xl grid grid-cols-3 gap-5">
                            <button
                                onClick={() => handleSelect(msg.id, 'kept_existing')}
                                className={`group/btn flex flex-col items-center justify-center gap-2.5 py-4 rounded-2xl border-2 transition-all duration-300 ${
                                    currentSelection === 'kept_existing' 
                                    ? 'bg-white border-slate-900 shadow-xl text-slate-900 ring-4 ring-slate-100 scale-[1.05] z-10' 
                                    : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300 hover:bg-slate-50'
                                }`}
                            >
                                <div className={`p-2.5 rounded-xl transition-colors ${currentSelection === 'kept_existing' ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-100 text-slate-300 group-hover/btn:bg-slate-200'}`}>
                                    <Shield className="w-5 h-5" />
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="text-[10px] font-black uppercase tracking-tight">{isRTL ? 'حفظ اصلی' : 'Keep Existing'}</span>
                                    <span className="text-[8px] opacity-60 font-medium">Verify Stability</span>
                                </div>
                            </button>
                            
                            <button
                                onClick={() => handleSelect(msg.id, 'combined')}
                                className={`group/btn flex flex-col items-center justify-center gap-2.5 py-4 rounded-2xl border-2 transition-all duration-300 ${
                                    currentSelection === 'combined' 
                                    ? 'bg-amber-50 border-amber-500 shadow-xl text-amber-900 ring-4 ring-amber-100 scale-[1.05] z-10' 
                                    : 'bg-white border-slate-100 text-slate-400 hover:border-amber-200 hover:bg-amber-50/30'
                                }`}
                            >
                                <div className={`p-2.5 rounded-xl transition-colors ${currentSelection === 'combined' ? 'bg-amber-600 text-white shadow-lg' : 'bg-slate-100 text-slate-300 group-hover/btn:bg-amber-100/50'}`}>
                                    <Layers className="w-5 h-5" />
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="text-[10px] font-black uppercase tracking-tight">{isRTL ? 'ترکیب هوشمند' : 'Synthesize'}</span>
                                    <span className="text-[8px] opacity-60 font-medium">Hybrid Approach</span>
                                </div>
                            </button>

                            <button
                                onClick={() => handleSelect(msg.id, 'updated_new')}
                                className={`group/btn flex flex-col items-center justify-center gap-2.5 py-4 rounded-2xl border-2 transition-all duration-300 ${
                                    currentSelection === 'updated_new' 
                                    ? 'bg-indigo-600 border-indigo-700 shadow-xl text-white ring-4 ring-indigo-100 scale-[1.05] z-10' 
                                    : 'bg-white border-slate-100 text-slate-400 hover:border-indigo-300 hover:bg-indigo-50/30'
                                }`}
                            >
                                <div className={`p-2.5 rounded-xl transition-colors ${currentSelection === 'updated_new' ? 'bg-white text-indigo-600 shadow-lg' : 'bg-slate-100 text-slate-300 group-hover/btn:bg-indigo-100/50'}`}>
                                    <RefreshCw className="w-5 h-5" />
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="text-[10px] font-black uppercase tracking-tight">{isRTL ? 'جایگزینی' : 'Overwrite'}</span>
                                    <span className={`text-[8px] font-medium ${currentSelection === 'updated_new' ? 'text-indigo-100' : 'text-slate-400'}`}>Adopt Suggestion</span>
                                </div>
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>

        {/* Action Footer */}
        <div className="p-6 bg-white border-t border-slate-200 shadow-[0_-15px_45px_rgba(0,0,0,0.1)] sticky bottom-0 z-30">
            <button
                onClick={handleFinalSubmit}
                disabled={!isComplete || isSubmitting}
                className={`group w-full relative overflow-hidden flex items-center justify-center gap-3 py-4.5 rounded-2xl font-black text-sm transition-all duration-500 ${
                    isComplete && !isSubmitting
                    ? 'bg-slate-900 text-white shadow-2xl shadow-indigo-200 hover:bg-black hover:-translate-y-1 active:translate-y-0' 
                    : isSubmitting ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-100 text-slate-300 cursor-not-allowed border border-slate-200'
                }`}
            >
                {isSubmitting ? (
                    <div className="flex items-center gap-3">
                        <Loader2 className="w-6 h-6 animate-spin" />
                        <span className="animate-pulse tracking-wide">{isRTL ? 'در حال اعمال نتایج...' : 'Synchronizing Workspace...'}</span>
                    </div>
                ) : (
                    <>
                        <Save className={`w-5 h-5 transition-transform duration-500 ${isComplete ? 'group-hover:scale-125' : ''}`} />
                        <span className="tracking-tight">{isRTL ? 'تایید و اعمال نهایی' : 'Finalize & Commit Changes'}</span>
                    </>
                )}
            </button>
            {!isComplete && !isSubmitting && (
                <div className="flex items-center justify-center gap-2 mt-4 animate-in slide-in-from-bottom-2 duration-500">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
                        {isRTL ? 'تمام تضادها نیاز به بررسی دارند' : 'All conflicts require user decision'}
                    </p>
                </div>
            )}
        </div>
    </div>
  );
};

export default ConflictManager;
