import React, { useMemo } from 'react';
import { Activity, BarChart3, Clock, Calendar, ExternalLink, Zap } from 'lucide-react';
import { UsageStats } from '../types';

interface UsageMonitorProps {
  stats: UsageStats;
  isRTL: boolean;
}

const UsageMonitor: React.FC<UsageMonitorProps> = ({ stats, isRTL }) => {
  const rpm = stats.requestsInLastMinute;
  const rpmLimit = 15;
  const rpdLimit = 1500;
  
  const rpmPercentage = Math.min((rpm / rpmLimit) * 100, 100);
  const rpdPercentage = Math.min((stats.dailyRequestsCount / rpdLimit) * 100, 100);

  const remainingRPM = Math.max(0, rpmLimit - rpm);
  const remainingRPD = Math.max(0, rpdLimit - stats.dailyRequestsCount);

  const statusColor = useMemo(() => {
    if (rpmPercentage > 85 || rpdPercentage > 90) return 'text-red-500 bg-red-50 border-red-100';
    if (rpmPercentage > 60 || rpdPercentage > 70) return 'text-amber-500 bg-amber-50 border-amber-100';
    return 'text-emerald-500 bg-emerald-50 border-emerald-100';
  }, [rpmPercentage, rpdPercentage]);

  const barColor = (pct: number) => {
    if (pct > 85) return 'bg-red-500';
    if (pct > 60) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  return (
    <div className={`group relative flex items-center gap-3 px-3 py-1.5 rounded-xl border transition-all shadow-sm ${statusColor}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center gap-1.5 border-r border-current pr-2 mr-0.5">
        <Zap className="w-3.5 h-3.5" />
        <span className="text-[11px] font-black">{remainingRPM}</span>
        <span className="text-[9px] font-bold opacity-60 uppercase tracking-tighter">{isRTL ? 'مانده' : 'Left'}</span>
      </div>
      
      <div className="flex flex-col min-w-[60px]">
        <div className="flex justify-between items-center mb-0.5">
          <span className="text-[8px] font-black uppercase opacity-60">{isRTL ? 'سهمیه روزانه' : 'Daily Quota'}</span>
          <span className="text-[8px] font-bold">{Math.round(rpdPercentage)}%</span>
        </div>
        <div className="w-full h-1 bg-black/5 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-700 ${barColor(rpdPercentage)}`} 
            style={{ width: `${rpdPercentage}%` }}
          />
        </div>
      </div>

      {/* Popover Details */}
      <div className={`absolute top-full mt-2 ${isRTL ? 'left-0' : 'right-0'} w-64 bg-white border border-slate-200 shadow-2xl rounded-2xl p-4 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all z-50 transform origin-top-right scale-95 group-hover:scale-100 text-slate-800`}>
        <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
          <div className="p-2 bg-indigo-50 rounded-lg">
            <BarChart3 className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-tight">{isRTL ? 'مدیریت سهمیه Gemini' : 'Gemini Quota Manager'}</h4>
            <p className="text-[9px] text-slate-400 font-medium">{isRTL ? 'بر اساس محدودیت‌های طرح رایگان' : 'Based on Free Tier limits'}</p>
          </div>
        </div>
        
        <div className="space-y-4">
          {/* RPM Section */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-[10px]">
              <span className="flex items-center gap-1.5 text-slate-500 font-bold uppercase"><Clock className="w-3 h-3" /> {isRTL ? 'در هر دقیقه' : 'Per Minute'}</span>
              <span className={`font-black ${rpmPercentage > 85 ? 'text-red-500' : 'text-slate-700'}`}>{rpm} / {rpmLimit}</span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full transition-all duration-500 ${barColor(rpmPercentage)}`} style={{ width: `${rpmPercentage}%` }} />
            </div>
          </div>

          {/* RPD Section */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-[10px]">
              <span className="flex items-center gap-1.5 text-slate-500 font-bold uppercase"><Calendar className="w-3 h-3" /> {isRTL ? 'در هر روز' : 'Per Day'}</span>
              <span className={`font-black ${rpdPercentage > 90 ? 'text-red-500' : 'text-slate-700'}`}>{stats.dailyRequestsCount} / {rpdLimit}</span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full transition-all duration-500 ${barColor(rpdPercentage)}`} style={{ width: `${rpdPercentage}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
             <div className="bg-slate-50 p-2 rounded-lg text-center">
                <span className="block text-[8px] font-black text-slate-400 uppercase">{isRTL ? 'کل توکن‌ها' : 'Total Tokens'}</span>
                <span className="text-xs font-black text-indigo-600">{stats.totalTokens.toLocaleString()}</span>
             </div>
             <div className="bg-slate-50 p-2 rounded-lg text-center">
                <span className="block text-[8px] font-black text-slate-400 uppercase">{isRTL ? 'کل درخواست‌ها' : 'Session Req.'}</span>
                <span className="text-xs font-black text-slate-700">{stats.totalRequests}</span>
             </div>
          </div>

          <a 
            href="https://aistudio.google.com/app/plan_and_billing" 
            target="_blank" 
            rel="noreferrer"
            className="flex items-center justify-center gap-2 py-2 bg-slate-900 hover:bg-black text-white text-[10px] font-black rounded-xl transition-all shadow-md active:scale-95"
          >
            <ExternalLink className="w-3 h-3" />
            {isRTL ? 'مشاهده داشبورد رسمی گوگل' : 'View Official Dashboard'}
          </a>
        </div>
      </div>
    </div>
  );
};

export default UsageMonitor;