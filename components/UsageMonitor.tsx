
import React from 'react';
import { Activity, Zap } from 'lucide-react';
import { UsageStats } from '../types';

interface UsageMonitorProps {
  stats: UsageStats;
  isRTL: boolean;
}

const UsageMonitor: React.FC<UsageMonitorProps> = ({ stats, isRTL }) => {
  // Assuming a soft limit of 10 requests per minute for the UI visualization
  const progress = Math.min((stats.requestsInLastMinute / 10) * 100, 100);
  
  return (
    <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse text-right' : 'text-left'}`}>
      <div className={`flex flex-col ${isRTL ? 'items-start' : 'items-end'}`}>
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
          <Activity className="w-3 h-3 text-emerald-500" />
          <span>{isRTL ? 'محدودیت سرعت' : 'Rate Limit'}</span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${progress > 80 ? 'bg-red-500' : progress > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-[10px] font-black text-slate-700">{stats.requestsInLastMinute}/10</span>
        </div>
      </div>
      
      <div className="h-8 w-[1px] bg-slate-200" />
      
      <div className={`flex flex-col ${isRTL ? 'items-start' : 'items-end'}`}>
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
          <Zap className="w-3 h-3 text-indigo-500" />
          <span>{isRTL ? 'توکن‌ها' : 'Tokens'}</span>
        </div>
        <span className="text-[10px] font-black text-slate-700 mt-1">{(stats.totalTokens / 1000).toFixed(1)}k</span>
      </div>
    </div>
  );
};

export default UsageMonitor;
