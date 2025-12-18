
import React, { useState, useEffect } from 'react';
// Added missing Info icon to the lucide-react import list
import { AlertTriangle, Layers, RefreshCw, Shield, Save, CheckCircle2, FileText, Sparkles, Check, Loader2, ArrowDown, Info } from 'lucide-react';
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
    // Visual feedback delay
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
    <div className={`flex flex-col h-full bg-slate-50/50 ${isRTL ? 'font-persian' : ''}`} dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="p-4 border-b border-slate-200 bg-white shadow-sm sticky top-0 z-20">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5 font-bold text-slate-800">
                    <div className="p-2 bg-amber-50 rounded-xl border border-amber-100">
                        <AlertTriangle className="w-4.5 h-4.5 text-amber-600" />
                    </div>
                    <div className="flex flex-col">
                        <span className="leading-none">{isRTL ? 'مرکز مدیریت تضادها' : 'Conflict Resolution'}</span>
                        <span className="text-[10px] text-slate-400 font-medium mt-1 uppercase tracking-widest">Scientific Audit</span>
                    </div>
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 shadow-sm">
                        {conflicts.length} {isRTL ? 'مورد باقی‌مانده' : 'Issues Pending'}
                    </span>
                </div>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-8 pb-24">
            {conflicts.map((msg, index) => {
                if (!msg.conflict) return null;
                const currentSelection = selections[msg.id];

                return (
                    <div 
                        key={msg.id} 
                        className={`group relative bg-white border rounded-2xl shadow-sm transition-all duration-500 ease-out flex flex-col ${
                            currentSelection 
                            ? 'border-indigo-500 ring-4 ring-indigo-50 shadow-lg transform scale-[1.02] -translate-y-1' 
                            : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
                        }`}
                    >
                        {/* Status Badge */}
                        {currentSelection && (
                            <div className="absolute -top-3 -right-3 bg-indigo-600 text-white p-1.5 rounded-full shadow-lg z-10 animate-in zoom-in duration-300">
                                <Check className="w-4 h-4 stroke-[3]" />
                            </div>
                        )}

                        {/* Card Header */}
                        <div className={`border-b px-4 py-3 flex items-center gap-3 transition-colors rounded-t-2xl ${currentSelection ? 'bg-indigo-50/40 border-indigo-100' : 'bg-slate-50 border-slate-100'}`}>
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0 transition-all ${currentSelection ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-400'}`}>
                                {index + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className={`text-xs font-bold uppercase tracking-wide truncate ${currentSelection ? 'text-indigo-900' : 'text-slate-800'}`}>
                                    {msg.conflict.description}
                                </h4>
                                {msg.conflict.reasoning && (
                                    <p className="text-[10px] text-slate-500 mt-0.5 font-medium flex items-center gap-1">
                                        <Info className="w-3 h-3" />
                                        {msg.conflict.reasoning}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Comparison Grid */}
                        <div className="p-4 space-y-6 relative">
                            {/* Visual Flow Indicator */}
                            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white border border-slate-200 rounded-full flex items-center justify-center z-10 shadow-sm text-slate-300 group-hover:text-indigo-400 transition-colors">
                                <ArrowDown className="w-4 h-4" />
                            </div>

                            {/* Section 1: Current Report (Legacy/Stable Look) */}
                            <div className="space-y-2 relative">
                                <div className="flex items-center gap-2 px-1">
                                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                        {isRTL ? 'داده فعلی گزارش' : 'Current Report Text'}
                                    </label>
                                </div>
                                <div className="relative bg-slate-100/50 border-2 border-slate-200 border-solid rounded-xl p-4 text-xs text-slate-600 leading-relaxed shadow-inner font-medium">
                                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:10px_10px]"></div>
                                    "{msg.conflict.existing_info}"
                                </div>
                            </div>

                            {/* Section 2: New Input (Fresh/Incoming Look) */}
                            <div className="space-y-2 relative">
                                <div className="flex items-center gap-2 px-1">
                                    <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                                    <label className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">
                                        {isRTL ? 'ورودی پیشنهادی جدید' : 'Incoming New Data'}
                                    </label>
                                </div>
                                <div className={`relative bg-indigo-50/40 border-2 border-dashed rounded-xl p-4 text-xs text-indigo-900 leading-relaxed shadow-sm transition-colors ${currentSelection === 'updated_new' || currentSelection === 'combined' ? 'border-indigo-400' : 'border-indigo-200'}`}>
                                    <div className="absolute -top-2 -left-2 px-2 py-0.5 bg-indigo-500 text-[9px] text-white font-black rounded italic shadow-sm uppercase">NEW</div>
                                    "{msg.conflict.new_info}"
                                </div>
                            </div>
                        </div>

                        {/* Resolution Strategy Selector */}
                        <div className="px-4 py-4 bg-slate-50/50 border-t border-slate-100 rounded-b-2xl grid grid-cols-3 gap-3">
                            <button
                                onClick={() => handleSelect(msg.id, 'kept_existing')}
                                className={`group/btn flex flex-col items-center justify-center gap-2 py-3.5 rounded-xl border-2 transition-all duration-300 ${
                                    currentSelection === 'kept_existing' 
                                    ? 'bg-white border-slate-700 shadow-lg text-slate-900 ring-4 ring-slate-100 scale-[1.05] z-10' 
                                    : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300 hover:bg-slate-50'
                                }`}
                            >
                                <div className={`p-2 rounded-lg transition-colors ${currentSelection === 'kept_existing' ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-300 group-hover/btn:bg-slate-100'}`}>
                                    <Shield className="w-4.5 h-4.5" />
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="text-[10px] font-black uppercase tracking-tight">{isRTL ? 'حفظ اصلی' : 'Keep Original'}</span>
                                    <span className="text-[8px] opacity-60 font-medium">Reject change</span>
                                </div>
                            </button>
                            
                            <button
                                onClick={() => handleSelect(msg.id, 'combined')}
                                className={`group/btn flex flex-col items-center justify-center gap-2 py-3.5 rounded-xl border-2 transition-all duration-300 ${
                                    currentSelection === 'combined' 
                                    ? 'bg-amber-50 border-amber-500 shadow-lg text-amber-900 ring-4 ring-amber-100 scale-[1.05] z-10' 
                                    : 'bg-white border-slate-100 text-slate-400 hover:border-amber-200 hover:bg-amber-50/30'
                                }`}
                            >
                                <div className={`p-2 rounded-lg transition-colors ${currentSelection === 'combined' ? 'bg-amber-600 text-white' : 'bg-slate-50 text-slate-300 group-hover/btn:bg-amber-100/50'}`}>
                                    <Layers className="w-4.5 h-4.5" />
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="text-[10px] font-black uppercase tracking-tight">{isRTL ? 'ترکیب هوشمند' : 'Synthesize'}</span>
                                    <span className="text-[8px] opacity-60 font-medium">Merge both</span>
                                </div>
                            </button>

                            <button
                                onClick={() => handleSelect(msg.id, 'updated_new')}
                                className={`group/btn flex flex-col items-center justify-center gap-2 py-3.5 rounded-xl border-2 transition-all duration-300 ${
                                    currentSelection === 'updated_new' 
                                    ? 'bg-indigo-600 border-indigo-700 shadow-lg text-white ring-4 ring-indigo-100 scale-[1.05] z-10' 
                                    : 'bg-white border-slate-100 text-slate-400 hover:border-indigo-300 hover:bg-indigo-50/30'
                                }`}
                            >
                                <div className={`p-2 rounded-lg transition-colors ${currentSelection === 'updated_new' ? 'bg-white/20 text-white' : 'bg-slate-50 text-slate-300 group-hover/btn:bg-indigo-100/50'}`}>
                                    <RefreshCw className="w-4.5 h-4.5" />
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="text-[10px] font-black uppercase tracking-tight">{isRTL ? 'جایگزینی' : 'Overwrite'}</span>
                                    <span className={`text-[8px] font-medium ${currentSelection === 'updated_new' ? 'text-indigo-100' : 'text-slate-400'}`}>Use new only</span>
                                </div>
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>

        {/* Global Action Footer */}
        <div className="p-4 bg-white border-t border-slate-200 shadow-[0_-8px_30px_rgba(0,0,0,0.06)] sticky bottom-0 z-30">
            <button
                onClick={handleFinalSubmit}
                disabled={!isComplete || isSubmitting}
                className={`group w-full relative overflow-hidden flex items-center justify-center gap-3 py-4 rounded-2xl font-black text-sm transition-all duration-500 ${
                    isComplete && !isSubmitting
                    ? 'bg-slate-900 text-white shadow-xl shadow-slate-200 hover:bg-black hover:-translate-y-0.5 active:translate-y-0' 
                    : isSubmitting ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-300 cursor-not-allowed border border-slate-200'
                }`}
            >
                {isSubmitting ? (
                    <div className="flex items-center gap-3">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="animate-pulse">{isRTL ? 'در حال اعمال تغییرات...' : 'Updating Document...'}</span>
                    </div>
                ) : (
                    <>
                        <Save className={`w-5 h-5 transition-transform duration-500 ${isComplete ? 'group-hover:scale-110' : ''}`} />
                        <span>{isRTL ? 'تایید و ثبت نهایی تمام موارد' : 'Confirm & Apply All Changes'}</span>
                    </>
                )}
            </button>
            {!isComplete && !isSubmitting && (
                <div className="flex items-center justify-center gap-2 mt-3 animate-pulse">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">
                        {isRTL ? 'لطفاً برای تمام موارد تصمیم‌گیری کنید' : 'Decisions required for all pending items'}
                    </p>
                </div>
            )}
        </div>
    </div>
  );
};

export default ConflictManager;
