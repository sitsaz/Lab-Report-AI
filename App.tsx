
import React, { useState, useEffect, useRef } from 'react';
import FileUploader from './components/FileUploader.tsx';
import ChatInterface from './components/ChatInterface.tsx';
import ReportEditor from './components/ReportEditor.tsx';
import TaskManager from './components/TaskManager.tsx';
import CitationManager from './components/CitationManager.tsx';
import ConflictManager from './components/ConflictManager.tsx';
import UsageMonitor from './components/UsageMonitor.tsx';
import { extractTextFromDocx } from './services/document.ts';
import { sendMessageToGemini, generateCitation } from './services/gemini.ts';
import { sendMessageToOpenAI } from './services/openai.ts';
import { sendMessageToOpenRouter } from './services/openrouter.ts';
import { sendMessageToAvalAI } from './services/avalai.ts';
import { Message, AppState, ReportFile, Task, Citation, UsageStats, AIProvider } from './types.ts';
import { Beaker, ArrowLeft, Key, Zap, Globe, Cpu, Sparkles, ShieldCheck, Eye, EyeOff, CheckCircle2, Info, Layers } from 'lucide-react';

const STORAGE_KEY = 'LAB_REPORT_SESSION_V2';
const USAGE_KEY = 'LAB_REPORT_USAGE_V1';
const KEYS_STORAGE_KEY = 'LAB_REPORT_API_KEYS';
const MODELS_STORAGE_KEY = 'LAB_REPORT_API_MODELS';

const generateId = () => {
  try {
    return crypto.randomUUID();
  } catch (e) {
    return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
  }
};

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [currentFile, setCurrentFile] = useState<ReportFile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [activeTab, setActiveTab] = useState<'chat' | 'tasks' | 'citations' | 'conflicts'>('chat');
  const [cursorPosition, setCursorPosition] = useState<number>(0);
  const [language, setLanguage] = useState<'en' | 'fa'>('en');
  const [provider, setProvider] = useState<AIProvider>('gemini');
  const [showKey, setShowKey] = useState<string | null>(null);
  
  const [apiKeys, setApiKeys] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem(KEYS_STORAGE_KEY);
    return saved ? JSON.parse(saved) : { openai: '', openrouter: '', avalai: '' };
  });

  const [apiModels, setApiModels] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem(MODELS_STORAGE_KEY);
    return saved ? JSON.parse(saved) : { 
      openai: 'gpt-4o', 
      openrouter: 'anthropic/claude-3.5-sonnet', 
      avalai: 'gpt-4o' 
    };
  });

  const [usageStats, setUsageStats] = useState<UsageStats>(() => {
    const saved = localStorage.getItem(USAGE_KEY);
    const today = new Date().toDateString();
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.lastResetDate === today) return { ...parsed, requestsInLastMinute: 0, requestTimestamps: [] };
    }
    return {
      requestsInLastMinute: 0, totalRequests: 0, dailyRequestsCount: 0, totalTokens: 0,
      requestTimestamps: [], lastResetDate: today
    };
  });

  const stateRef = useRef({ currentFile, messages, tasks, citations, language, usageStats, provider, apiKeys, apiModels });
  useEffect(() => { stateRef.current = { currentFile, messages, tasks, citations, language, usageStats, provider, apiKeys, apiModels }; }, [currentFile, messages, tasks, citations, language, usageStats, provider, apiKeys, apiModels]);
  useEffect(() => { localStorage.setItem(KEYS_STORAGE_KEY, JSON.stringify(apiKeys)); }, [apiKeys]);
  useEffect(() => { localStorage.setItem(MODELS_STORAGE_KEY, JSON.stringify(apiModels)); }, [apiModels]);
  useEffect(() => { localStorage.setItem(USAGE_KEY, JSON.stringify(usageStats)); }, [usageStats]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setUsageStats(prev => {
        const filtered = prev.requestTimestamps.filter(ts => ts > now - 60000);
        return { ...prev, requestTimestamps: filtered, requestsInLastMinute: filtered.length };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleKeyChange = (providerId: string, value: string) => setApiKeys(prev => ({ ...prev, [providerId]: value }));
  const handleModelChange = (providerId: string, value: string) => setApiModels(prev => ({ ...prev, [providerId]: value }));

  const handleFileSelect = async (file: File) => {
    setAppState(AppState.PROCESSING);
    try {
      const text = await extractTextFromDocx(file);
      setCurrentFile({ name: file.name, content: text, originalContent: text, lastModified: file.lastModified });
      setMessages([{ id: generateId(), role: 'model', provider, text: `I've read **${file.name}**. Engine: **${provider.toUpperCase()}**. How can I help?`, timestamp: new Date() }]);
      setAppState(AppState.IDLE);
    } catch (error) { setAppState(AppState.ERROR); }
  };

  const updateUsageFromAPI = (usage: any) => {
    if (!usage) return;
    const now = Date.now();
    setUsageStats(prev => ({
      ...prev,
      totalRequests: prev.totalRequests + 1,
      dailyRequestsCount: prev.dailyRequestsCount + 1,
      totalTokens: prev.totalTokens + (usage.totalTokenCount || 0),
      requestTimestamps: [...prev.requestTimestamps, now],
      requestsInLastMinute: prev.requestTimestamps.filter(ts => ts > now - 60000).length + 1
    }));
  };

  const processAIResponse = async (userText: string, updatedMessages: Message[]) => {
    setAppState(AppState.PROCESSING);
    if (!currentFile) return;
    try {
      let result;
      const effectiveKey = apiKeys[provider] || process.env.API_KEY;
      const selectedModel = apiModels[provider];
      if (provider === 'gemini') result = await sendMessageToGemini(currentFile.content, updatedMessages, userText, language);
      else if (provider === 'openai') result = await sendMessageToOpenAI(currentFile.content, updatedMessages, userText, effectiveKey, selectedModel);
      else if (provider === 'openrouter') result = await sendMessageToOpenRouter(currentFile.content, updatedMessages, userText, effectiveKey, selectedModel);
      else result = await sendMessageToAvalAI(currentFile.content, updatedMessages, userText, effectiveKey, selectedModel);

      updateUsageFromAPI(result.usage);
      if (result.reportUpdates?.length) {
        let nextContent = currentFile.content;
        result.reportUpdates.forEach(update => { 
          if (nextContent.includes(update.search_text)) {
            nextContent = nextContent.replace(update.search_text, update.replacement_text); 
          }
        });
        setCurrentFile(prev => prev ? { ...prev, content: nextContent } : null);
      }
      const newMsgs: Message[] = [];
      if (result.text) newMsgs.push({ id: generateId(), role: 'model', provider, text: result.text, sources: result.sources, timestamp: new Date() });
      if (result.conflicts?.length) result.conflicts.forEach(c => newMsgs.push({ id: generateId(), role: 'model', provider, text: '', conflict: { ...c, resolved: false }, timestamp: new Date() }));
      setMessages(prev => [...prev, ...newMsgs]);
    } catch (error: any) {
      setMessages(prev => [...prev, { id: generateId(), role: 'model', text: `⚠️ Error: ${error.message || "Connection failed."}`, timestamp: new Date() }]);
    } finally { setAppState(AppState.IDLE); }
  };

  const handleSendMessage = async (text: string) => {
    const userMsg: Message = { id: generateId(), role: 'user', text, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    await processAIResponse(text, [...stateRef.current.messages, userMsg]);
  };

  const handleBulkResolve = async (resolutions: Record<string, 'kept_existing' | 'updated_new' | 'combined'>) => {
    // 1. Mark conflicts as resolved locally immediately for UI snappiness
    setMessages(prev => prev.map(m => resolutions[m.id] ? { 
      ...m, 
      conflict: { ...m.conflict!, resolved: true, resolution: resolutions[m.id] } 
    } : m));

    // 2. Prepare manifest for AI
    const manifestParts = Object.entries(resolutions).map(([id, choice]) => {
      const msg = messages.find(m => m.id === id);
      if (!msg || !msg.conflict) return null;
      return `- Conflict: ${msg.conflict.description}\n  Choice: ${choice.toUpperCase()}\n  Search context: ${msg.conflict.existing_info}\n  New data: ${msg.conflict.new_info}`;
    }).filter(Boolean);

    if (manifestParts.length === 0) return;

    const manifestPrompt = `[RESOLUTION MANIFEST]\nPlease apply the following data resolutions to the report text:\n\n${manifestParts.join('\n\n')}\n\nExecute the updates character-for-character using the 'update_report' tool. For 'COMBINED', synthesize the text scientifically as instructed.`;

    // 3. Send to AI to get the actual text replacement function calls
    await processAIResponse(manifestPrompt, stateRef.current.messages);
    
    // 4. Return to chat or editor
    setActiveTab('chat');
  };

  const providers = [
    { id: 'gemini', icon: <Cpu className="w-4 h-4" />, name: 'Gemini', color: 'indigo', models: ['gemini-3-flash-preview'] },
    { id: 'openai', icon: <Sparkles className="w-4 h-4" />, name: 'OpenAI', color: 'emerald', models: ['gpt-4o', 'gpt-4o-mini'] },
    { id: 'openrouter', icon: <Globe className="w-4 h-4" />, name: 'OpenRouter', color: 'amber', models: ['anthropic/claude-3.5-sonnet', 'openai/gpt-4o'] },
    { id: 'avalai', icon: <ShieldCheck className="w-4 h-4" />, name: 'AvalAI', color: 'cyan', models: ['gpt-4o', 'gpt-4o-mini'] }
  ];

  if (!currentFile) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col p-6 items-center justify-center">
        <div className="max-w-xl w-full text-center mb-10">
          <div className="flex items-center justify-center gap-2 text-indigo-700 font-black text-3xl mb-4">
            <Beaker className="w-10 h-10" /><span>LabReportAI</span>
          </div>
          <p className="text-slate-500 font-medium leading-relaxed">Your intelligent scientific research & writing workspace.</p>
        </div>

        <div className="max-w-md w-full bg-white rounded-[2rem] shadow-xl border border-slate-200 overflow-hidden mb-6">
          <div className="p-2 border-b border-slate-100 flex gap-1 bg-slate-50/50">
            {providers.map(p => (
              <button 
                key={p.id} 
                onClick={() => setProvider(p.id as AIProvider)}
                className={`flex-1 py-3 rounded-2xl flex flex-col items-center gap-1.5 transition-all ${provider === p.id ? 'bg-white shadow-md text-indigo-600 ring-1 ring-slate-200' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
              >
                {p.icon}
                <span className="text-[10px] font-black uppercase tracking-widest">{p.name}</span>
              </button>
            ))}
          </div>

          <div className="p-6 space-y-5">
            {provider !== 'gemini' ? (
              <>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 ml-1">
                    <Layers className="w-3 h-3" /> Select Model
                  </label>
                  <select 
                    value={apiModels[provider]}
                    onChange={(e) => handleModelChange(provider, e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all appearance-none"
                  >
                    {providers.find(p => p.id === provider)?.models.map(m => (
                      <option key={m} value={m}>{m.split('/').pop()?.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 ml-1">
                    <Key className="w-3 h-3" /> API Credentials
                  </label>
                  <div className="relative group">
                    <input 
                      type={showKey === provider ? 'text' : 'password'}
                      value={apiKeys[provider]}
                      onChange={(e) => handleKeyChange(provider, e.target.value)}
                      placeholder={`Enter ${provider} key...`}
                      className={`w-full bg-slate-50 border rounded-xl py-3 pl-4 pr-10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${apiKeys[provider] ? 'border-emerald-200 bg-emerald-50/10' : 'border-slate-200'}`}
                    />
                    <button 
                      onMouseDown={() => setShowKey(provider)} onMouseUp={() => setShowKey(null)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
                    >
                      {showKey === provider ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <Zap className="w-5 h-5 text-indigo-600 mt-0.5" />
                  <div>
                    <span className="text-xs font-black text-indigo-900 uppercase block">Gemini Primary Engine</span>
                    <p className="text-[11px] text-indigo-600 font-medium leading-relaxed mt-1">Native search grounding and high-speed processing. Requires system key selection.</p>
                  </div>
                </div>
                <button 
                  onClick={() => (window as any).aistudio?.openSelectKey()}
                  className="w-full py-2.5 bg-white hover:bg-indigo-600 hover:text-white text-indigo-600 rounded-xl border border-indigo-200 font-black text-[11px] uppercase tracking-wider transition-all shadow-sm"
                >
                  Configure System Key
                </button>
              </div>
            )}
            
            <FileUploader onFileSelect={handleFileSelect} isProcessing={appState === AppState.PROCESSING} />
          </div>
        </div>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Ready for Scientific Inquiry</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-100 overflow-hidden">
      <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-6 shadow-sm z-50">
        <div className="flex items-center gap-6">
          <button onClick={() => window.location.reload()} className="p-2 hover:bg-slate-100 rounded-xl transition-all"><ArrowLeft className="w-5 h-5 text-slate-400" /></button>
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg"><Beaker className="w-5 h-5 text-white" /></div>
             <div className="flex flex-col"><span className="font-black text-slate-900 leading-none">LabReportAI</span><span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{provider.toUpperCase()} ACTIVE</span></div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <UsageMonitor stats={usageStats} isRTL={language === 'fa'} />
          <div className="h-6 w-[1px] bg-slate-200" />
          <button onClick={() => (window as any).aistudio?.openSelectKey()} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 transition-all rounded-xl border border-slate-200 shadow-sm"><Info className="w-4.5 h-4.5" /></button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden p-4 gap-4">
        <div className="w-full md:w-[450px] flex-shrink-0 flex flex-col h-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="flex border-b border-slate-100 bg-slate-50/50 p-1">
            {['chat', 'tasks', 'citations', 'conflicts'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab as any)} className={`flex-1 py-3 text-[10px] font-black uppercase transition-all rounded-lg tracking-widest relative ${activeTab === tab ? 'text-indigo-600 bg-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{tab}</button>
            ))}
          </div>
          <div className="flex-1 overflow-hidden relative">
            <div className={`absolute inset-0 ${activeTab === 'chat' ? 'z-10' : 'hidden'}`}>
              <ChatInterface 
                messages={messages} 
                onSendMessage={handleSendMessage} 
                onResolveConflict={(id, res) => handleBulkResolve({ [id]: res })} 
                isProcessing={appState === AppState.PROCESSING} 
                language={language} 
              />
            </div>
            <div className={`absolute inset-0 ${activeTab === 'tasks' ? 'z-10' : 'hidden'}`}><TaskManager tasks={tasks} onAddTask={t => setTasks(p => [...p, {id: generateId(), text: t, completed: false}])} onToggleTask={id => setTasks(p => p.map(t => t.id === id ? {...t, completed: !t.completed} : t))} onDeleteTask={id => setTasks(p => p.filter(t => t.id !== id))} /></div>
            <div className={`absolute inset-0 ${activeTab === 'citations' ? 'z-10' : 'hidden'}`}><CitationManager citations={citations} onAddCitation={async () => {}} onDeleteCitation={id => setCitations(p => p.filter(c => c.id !== id))} onInsertToDoc={() => {}} isProcessing={appState === AppState.PROCESSING} /></div>
            <div className={`absolute inset-0 ${activeTab === 'conflicts' ? 'z-10' : 'hidden'}`}>
              <ConflictManager 
                conflicts={messages.filter(m => m.conflict && !m.conflict.resolved)} 
                onBulkResolve={handleBulkResolve} 
                language={language} 
              />
            </div>
          </div>
        </div>
        <div className="hidden md:flex flex-1 flex-col h-full"><ReportEditor content={currentFile.content} originalContent={currentFile.originalContent} onChange={c => setCurrentFile({...currentFile, content: c})} fileName={currentFile.name} language={language} onCursorChange={setCursorPosition} /></div>
      </main>
      {appState === AppState.PROCESSING && <div className="fixed inset-0 bg-slate-900/10 backdrop-blur-[3px] z-[100] flex items-center justify-center"><div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4"><div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" /><span className="text-xs font-black text-slate-800 uppercase tracking-widest">Processing...</span></div></div>}
    </div>
  );
};

export default App;
