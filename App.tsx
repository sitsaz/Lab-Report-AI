
import React, { useState, useEffect, useRef } from 'react';
import FileUploader from './components/FileUploader';
import ChatInterface from './components/ChatInterface';
import ReportEditor from './components/ReportEditor';
import TaskManager from './components/TaskManager';
import CitationManager from './components/CitationManager';
import ConflictManager from './components/ConflictManager';
import UsageMonitor from './components/UsageMonitor';
import { extractTextFromDocx, saveTextToDocx } from './services/document.ts';
import { sendMessageToGemini, generateCitation, GeminiError } from './services/gemini.ts';
import { sendMessageToOpenAI } from './services/openai.ts';
import { sendMessageToOpenRouter } from './services/openrouter.ts';
import { sendMessageToAvalAI } from './services/avalai.ts';
import { Message, AppState, ReportFile, Task, Citation, UsageStats, AIProvider } from './types';
// Fixed: Added missing Info icon to the lucide-react import list
import { Beaker, ArrowLeft, Key, Zap, Settings, Globe, Loader2, AlertTriangle, History, Cpu, Sparkles, ShieldCheck, Lock, Eye, EyeOff, Layers, CheckCircle2, Info } from 'lucide-react';

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
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
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
      requestsInLastMinute: 0,
      totalRequests: 0,
      dailyRequestsCount: 0,
      totalTokens: 0,
      requestTimestamps: [],
      lastResetDate: today
    };
  });

  const stateRef = useRef({ currentFile, messages, tasks, citations, language, usageStats, provider, apiKeys, apiModels });

  useEffect(() => {
    stateRef.current = { currentFile, messages, tasks, citations, language, usageStats, provider, apiKeys, apiModels };
  }, [currentFile, messages, tasks, citations, language, usageStats, provider, apiKeys, apiModels]);

  useEffect(() => {
    localStorage.setItem(KEYS_STORAGE_KEY, JSON.stringify(apiKeys));
  }, [apiKeys]);

  useEffect(() => {
    localStorage.setItem(MODELS_STORAGE_KEY, JSON.stringify(apiModels));
  }, [apiModels]);

  useEffect(() => {
    localStorage.setItem(USAGE_KEY, JSON.stringify(usageStats));
  }, [usageStats]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      const oneMinuteAgo = now - 60000;
      setUsageStats(prev => {
        const filtered = prev.requestTimestamps.filter(ts => ts > oneMinuteAgo);
        if (filtered.length !== prev.requestsInLastMinute) {
          return { ...prev, requestTimestamps: filtered, requestsInLastMinute: filtered.length };
        }
        return prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const unresolvedConflicts = messages.filter(m => m.conflict && !m.conflict.resolved);

  const handleKeyChange = (providerId: string, value: string) => {
    setApiKeys(prev => ({ ...prev, [providerId]: value }));
  };

  const handleModelChange = (providerId: string, value: string) => {
    setApiModels(prev => ({ ...prev, [providerId]: value }));
  };

  const restoreSession = () => {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData) {
      try {
        const data = JSON.parse(savedData);
        setCurrentFile(data.file);
        setMessages((data.messages || []).map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })));
        setTasks(data.tasks || []);
        setCitations(data.citations || []);
        setLanguage(data.language || 'en');
        setLastSaved(new Date(data.lastSave));
      } catch (e) { console.error(e); }
    }
  };

  const handleFileSelect = async (file: File) => {
    setAppState(AppState.PROCESSING);
    try {
      const text = await extractTextFromDocx(file);
      setCurrentFile({ name: file.name, content: text, originalContent: text, lastModified: file.lastModified });
      setMessages([{ id: generateId(), role: 'model', provider, text: `I've read **${file.name}**. I'm using **${provider.toUpperCase()}** (${apiModels[provider] || 'native'}) to assist you.`, timestamp: new Date() }]);
      setTasks([{ id: generateId(), text: 'Initial context review', completed: false }]);
      setAppState(AppState.IDLE);
    } catch (error: any) {
      setAppState(AppState.ERROR);
    }
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

      if (provider === 'gemini') {
        result = await sendMessageToGemini(currentFile.content, updatedMessages, userText, language);
      } else if (provider === 'openai') {
        result = await sendMessageToOpenAI(currentFile.content, updatedMessages, userText, effectiveKey, selectedModel);
      } else if (provider === 'openrouter') {
        result = await sendMessageToOpenRouter(currentFile.content, updatedMessages, userText, effectiveKey, selectedModel);
      } else {
        result = await sendMessageToAvalAI(currentFile.content, updatedMessages, userText, effectiveKey, selectedModel);
      }

      const { text: responseText, sources, conflicts, newCitations, reportUpdates, usage } = result;
      updateUsageFromAPI(usage);

      if (newCitations?.length) newCitations.forEach(s => handleAddCitation(s));

      if (reportUpdates?.length) {
        let nextContent = currentFile.content;
        reportUpdates.forEach(update => {
          const search = update.search_text;
          const replace = update.replacement_text;
          if (nextContent.includes(search)) {
            nextContent = nextContent.replace(search, replace);
          }
        });
        setCurrentFile(prev => prev ? { ...prev, content: nextContent } : null);
      }

      const newMsgs: Message[] = [];
      if (responseText) newMsgs.push({ id: generateId(), role: 'model', provider, text: responseText, sources, timestamp: new Date() });
      if (conflicts?.length) {
        conflicts.forEach(c => newMsgs.push({ id: generateId(), role: 'model', provider, text: '', conflict: { ...c, resolved: false }, timestamp: new Date() }));
      }
      setMessages(prev => [...prev, ...newMsgs]);
    } catch (error: any) {
      setMessages(prev => [...prev, { id: generateId(), role: 'model', text: `⚠️ Error (${provider.toUpperCase()}): ${error.message || "Connection failed."}`, timestamp: new Date() }]);
    } finally {
      setAppState(AppState.IDLE);
    }
  };

  const handleAddCitation = async (source: string, style: 'APA' | 'IEEE' | 'MLA' = 'APA') => {
    try {
      const { formatted, inText, usage } = await generateCitation(source, style);
      updateUsageFromAPI(usage);
      setCitations(prev => prev.some(c => c.source === source) ? prev : [...prev, { id: generateId(), source, formatted, inText, style }]);
    } catch (e) {}
  };

  const handleSendMessage = async (text: string) => {
    const userMsg: Message = { id: generateId(), role: 'user', text, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    await processAIResponse(text, [...stateRef.current.messages, userMsg]);
  };

  const handleBulkResolveConflicts = async (resolutions: Record<string, 'kept_existing' | 'updated_new' | 'combined'>) => {
    setAppState(AppState.PROCESSING);
    const updatedMessages = messages.map(msg => resolutions[msg.id] 
      ? { ...msg, conflict: { ...msg.conflict!, resolved: true, resolution: resolutions[msg.id] } } 
      : msg
    );
    setMessages(updatedMessages);
    const resolutionPrompt = `Conflict resolutions submitted. Please apply updates.`;
    setActiveTab('chat');
    await processAIResponse(resolutionPrompt, updatedMessages);
  };

  const handleReset = () => {
    if (confirm("Reset session?")) { localStorage.removeItem(STORAGE_KEY); window.location.reload(); }
  };

  if (!currentFile) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col p-6 relative overflow-y-auto">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.05),transparent)] pointer-events-none" />
        
        {/* Header */}
        <div className="max-w-6xl mx-auto w-full flex items-center justify-between mb-12">
          <div className="flex items-center gap-2 text-indigo-700 font-bold text-xl">
            <Beaker className="w-8 h-8 text-indigo-600" /><span>LabReportAI</span>
          </div>
          <div className="flex gap-2">
            {localStorage.getItem(STORAGE_KEY) && <button onClick={restoreSession} className="px-4 py-2 bg-white text-slate-600 rounded-xl border border-slate-200 text-sm font-bold hover:bg-slate-50 transition-all shadow-sm"><History className="w-4 h-4 mr-2 inline" />History</button>}
            <button onClick={() => setLanguage(language === 'en' ? 'fa' : 'en')} className="px-4 py-2 bg-white text-slate-600 rounded-xl border border-slate-200 text-sm font-bold hover:bg-slate-50 transition-all shadow-sm">{language.toUpperCase()}</button>
          </div>
        </div>

        {/* Hero Section */}
        <div className="max-w-4xl mx-auto w-full text-center mb-12">
          <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">Intelligent Research Hub</h1>
          <p className="text-slate-500 text-lg leading-relaxed max-w-2xl mx-auto">Select your scientific engine, configure keys, and upload your draft.</p>
        </div>

        {/* Config Grid */}
        <div className="max-w-6xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {[
            { 
              id: 'gemini', 
              name: 'Google Gemini', 
              icon: <Cpu className="w-6 h-6" />, 
              color: 'indigo', 
              desc: 'Native search & high speed', 
              models: ['gemini-3-flash-preview'] 
            },
            { 
              id: 'openai', 
              name: 'OpenAI', 
              icon: <Sparkles className="w-6 h-6" />, 
              color: 'emerald', 
              desc: 'Precise scientific reasoning',
              models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'] 
            },
            { 
              id: 'openrouter', 
              name: 'OpenRouter', 
              icon: <Globe className="w-6 h-6" />, 
              color: 'amber', 
              desc: 'Claude 3.5 & DeepSeek',
              models: ['anthropic/claude-3.5-sonnet', 'openai/gpt-4o', 'google/gemini-pro-1.5', 'meta-llama/llama-3.1-405b'] 
            },
            { 
              id: 'avalai', 
              name: 'AvalAI', 
              icon: <ShieldCheck className="w-6 h-6" />, 
              color: 'cyan', 
              desc: 'Persian-optimized models',
              models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1-mini'] 
            }
          ].map(opt => (
            <div 
              key={opt.id}
              onClick={() => setProvider(opt.id as AIProvider)}
              className={`relative p-6 rounded-3xl border-2 transition-all cursor-pointer flex flex-col h-full ${
                provider === opt.id 
                ? `bg-white border-${opt.color}-500 shadow-xl shadow-${opt.color}-100 ring-4 ring-${opt.color}-50` 
                : 'bg-white/50 border-slate-200 hover:border-slate-300 shadow-sm'
              }`}
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-all ${
                provider === opt.id ? `bg-${opt.color}-600 text-white shadow-lg` : 'bg-slate-100 text-slate-400'
              }`}>
                {opt.icon}
              </div>
              <h3 className={`font-black text-sm mb-1 ${provider === opt.id ? 'text-slate-900' : 'text-slate-600'}`}>{opt.name}</h3>
              <p className="text-[10px] text-slate-400 font-medium mb-6 uppercase tracking-tighter">{opt.desc}</p>
              
              <div className="mt-auto space-y-4" onClick={(e) => e.stopPropagation()}>
                {/* Model Selector */}
                {opt.id !== 'gemini' && (
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                      <Layers className="w-3 h-3" /> Model
                    </label>
                    <select 
                      value={apiModels[opt.id]}
                      onChange={(e) => handleModelChange(opt.id, e.target.value)}
                      className="w-full text-[11px] bg-slate-50 border border-slate-100 rounded-xl py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 appearance-none shadow-sm"
                    >
                      {opt.models.map(m => (
                        <option key={m} value={m}>{m.split('/').pop()?.toUpperCase()}</option>
                      ))}
                      {opt.id === 'openrouter' && <option value="custom">CUSTOM...</option>}
                    </select>
                  </div>
                )}

                {/* API Key Input / Gemini Action */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <Key className="w-3 h-3" /> API Credentials
                  </label>
                  
                  {opt.id === 'gemini' ? (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        (window as any).aistudio?.openSelectKey();
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl border border-indigo-200 transition-all text-[11px] font-black uppercase shadow-sm"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      Select Gemini Key
                    </button>
                  ) : (
                    <div className="relative group/input">
                      <input 
                        type={showKey === opt.id ? 'text' : 'password'}
                        value={apiKeys[opt.id]}
                        onChange={(e) => handleKeyChange(opt.id, e.target.value)}
                        placeholder="Enter Key..."
                        className={`w-full text-[11px] bg-slate-50 border rounded-xl py-2 pl-3 pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono ${apiKeys[opt.id] ? 'border-emerald-200' : 'border-slate-100'}`}
                      />
                      <button 
                        onMouseDown={() => setShowKey(opt.id)}
                        onMouseUp={() => setShowKey(null)}
                        onMouseLeave={() => setShowKey(null)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
                      >
                        {showKey === opt.id ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      {apiKeys[opt.id] && <div className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-white rounded-full p-0.5 shadow-sm"><CheckCircle2 className="w-3 h-3" /></div>}
                    </div>
                  )}
                </div>

                {opt.id === 'gemini' && (
                  <div className="text-[9px] text-indigo-400 font-medium leading-tight flex gap-1.5">
                     <Info className="w-3 h-3 flex-shrink-0" />
                     <span>Google models require system key selection.</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Uploader */}
        <div className="max-w-2xl mx-auto w-full">
           <FileUploader onFileSelect={handleFileSelect} isProcessing={appState === AppState.PROCESSING} />
           <p className="text-center text-[10px] text-slate-400 mt-6 font-medium uppercase tracking-widest">Supports .docx files up to 25MB</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-100 overflow-hidden font-sans">
      <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-6 shadow-sm z-50">
        <div className="flex items-center gap-6">
          <button onClick={handleReset} className="p-2 hover:bg-slate-100 rounded-xl transition-all"><ArrowLeft className="w-5 h-5 text-slate-500" /></button>
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
                <Beaker className="w-5 h-5 text-white" />
             </div>
             <div className="flex flex-col">
                <span className="font-black text-slate-900 leading-none">LabReportAI</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{provider.toUpperCase()} ({(apiModels[provider] || 'native').split('/').pop()})</span>
             </div>
          </div>
          <div className="h-6 w-[1px] bg-slate-200" />
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
             <div className={`w-2 h-2 rounded-full animate-pulse ${provider === 'gemini' ? 'bg-indigo-500' : provider === 'openai' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
             <span className="text-[10px] font-black uppercase text-slate-600">{provider} Active</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <UsageMonitor stats={usageStats} isRTL={language === 'fa'} />
          <div className="h-6 w-[1px] bg-slate-200" />
          <div className="flex items-center gap-2">
            {lastSaved && <span className="text-[10px] text-slate-400 font-bold uppercase bg-slate-50 px-2 py-1 rounded border border-slate-200">Saved {lastSaved.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
            <button onClick={() => (window as any).aistudio?.openSelectKey()} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 transition-all rounded-xl border border-slate-200 shadow-sm"><Settings className="w-4.5 h-4.5" /></button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden p-4 gap-4">
        <div className={`w-full md:w-[450px] flex-shrink-0 flex flex-col h-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden`}>
          <div className="flex border-b border-slate-100 bg-slate-50/50 p-1">
            {['chat', 'tasks', 'citations', 'conflicts'].map(tab => (
              <button 
                key={tab} 
                onClick={() => setActiveTab(tab as any)} 
                className={`flex-1 py-3 text-[10px] font-black uppercase transition-all rounded-lg tracking-widest relative ${activeTab === tab ? 'text-indigo-600 bg-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {tab === 'conflicts' && unresolvedConflicts.length > 0 && <span className="absolute top-1 right-2 flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span></span>}
                {tab}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-hidden relative bg-white">
            <div className={`absolute inset-0 ${activeTab === 'chat' ? 'z-10' : 'hidden'}`}><ChatInterface messages={messages} onSendMessage={handleSendMessage} onResolveConflict={(m, r) => handleBulkResolveConflicts({[m]: r})} isProcessing={appState === AppState.PROCESSING} language={language} /></div>
            <div className={`absolute inset-0 ${activeTab === 'tasks' ? 'z-10' : 'hidden'}`}><TaskManager tasks={tasks} onAddTask={t => setTasks(p => [...p, {id: generateId(), text: t, completed: false}])} onToggleTask={id => setTasks(p => p.map(t => t.id === id ? {...t, completed: !t.completed} : t))} onDeleteTask={id => setTasks(p => p.filter(t => t.id !== id))} /></div>
            <div className={`absolute inset-0 ${activeTab === 'citations' ? 'z-10' : 'hidden'}`}><CitationManager citations={citations} onAddCitation={handleAddCitation} onDeleteCitation={id => setCitations(p => p.filter(c => c.id !== id))} onInsertToDoc={t => {
              const next = currentFile.content.slice(0, cursorPosition) + t + currentFile.content.slice(cursorPosition);
              setCurrentFile({...currentFile, content: next});
            }} isProcessing={appState === AppState.PROCESSING} /></div>
            <div className={`absolute inset-0 ${activeTab === 'conflicts' ? 'z-10' : 'hidden'}`}><ConflictManager conflicts={unresolvedConflicts} onBulkResolve={handleBulkResolveConflicts} language={language} /></div>
          </div>
        </div>
        <div className="hidden md:flex flex-1 flex-col h-full"><ReportEditor content={currentFile.content} originalContent={currentFile.originalContent} onChange={c => setCurrentFile({...currentFile, content: c})} onDownload={() => saveTextToDocx(currentFile.content, currentFile.name)} fileName={currentFile.name} language={language} onCursorChange={setCursorPosition} /></div>
      </main>
      
      {appState === AppState.PROCESSING && <div className="fixed inset-0 bg-slate-900/10 backdrop-blur-[3px] z-[100] flex items-center justify-center"><div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-6 border border-slate-100"><div className="relative"><div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" /><Cpu className="w-6 h-6 text-indigo-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" /></div><div className="text-center"><span className="block text-sm font-black text-slate-800 uppercase tracking-widest">{provider.toUpperCase()} ANALYZING</span><span className="text-xs text-slate-400 font-medium mt-1 block">Executing {apiModels[provider]?.split('/').pop()?.toUpperCase()}...</span></div></div></div>}
    </div>
  );
};

export default App;
