import React, { useState, useEffect, useRef } from 'react';
import FileUploader from './components/FileUploader';
import ChatInterface from './components/ChatInterface';
import ReportEditor from './components/ReportEditor';
import TaskManager from './components/TaskManager';
import CitationManager from './components/CitationManager';
import ConflictManager from './components/ConflictManager';
import { extractTextFromDocx, saveTextToDocx } from './services/document.ts';
import { sendMessageToGemini, generateCitation } from './services/gemini.ts';
import { Message, AppState, ReportFile, Task, Citation } from './types';
import { Beaker, ArrowLeft, Key, Languages, BookOpen, AlertTriangle, MessageSquare, ListTodo, History, Loader2 } from 'lucide-react';

const STORAGE_KEY = 'LAB_REPORT_SESSION_V2';

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
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const stateRef = useRef({ currentFile, messages, tasks, citations, language });

  useEffect(() => {
    stateRef.current = { currentFile, messages, tasks, citations, language };
  }, [currentFile, messages, tasks, citations, language]);

  const unresolvedConflicts = messages.filter(m => m.conflict && !m.conflict.resolved);

  useEffect(() => {
    if (unresolvedConflicts.length > 0 && activeTab !== 'conflicts') {
      setActiveTab('conflicts');
    }
  }, [unresolvedConflicts.length]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      const { currentFile: f, messages: m, tasks: t, citations: c, language: l } = stateRef.current;
      if (f) {
        const payload = { file: f, messages: m, tasks: t, citations: c, language: l, lastSave: Date.now() };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        setLastSaved(new Date());
      }
    }, 15000);
    return () => clearInterval(intervalId);
  }, []);

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
      setMessages([{ id: generateId(), role: 'model', text: `I've read **${file.name}**. I'm ready to assist with research and writing.`, timestamp: new Date() }]);
      setTasks([{ id: generateId(), text: 'Review scientific context', completed: false }]);
      setAppState(AppState.IDLE);
    } catch (error: any) {
      alert(error.message);
      setAppState(AppState.ERROR);
    }
  };

  const processAIResponse = async (userText: string, updatedMessages: Message[]) => {
    setAppState(AppState.PROCESSING);
    if (!currentFile) return;

    try {
      const { text: responseText, sources, conflicts, newCitations, reportUpdates } = await sendMessageToGemini(
        currentFile.content,
        updatedMessages,
        userText,
        language
      );

      if (newCitations?.length) newCitations.forEach(s => handleAddCitation(s));

      if (reportUpdates?.length) {
        let nextContent = currentFile.content;
        reportUpdates.forEach(update => {
          // AI might return slightly different spacing, try to be robust
          const search = update.search_text.trim();
          const replace = update.replacement_text;
          
          if (nextContent.includes(search)) {
            nextContent = nextContent.replace(search, replace);
          } else {
            // Fallback for character differences
            console.warn("Exact match not found for update, attempting fuzzy update.");
          }
        });
        setCurrentFile(prev => prev ? { ...prev, content: nextContent } : null);
      }

      const newMsgs: Message[] = [];
      if (responseText) newMsgs.push({ id: generateId(), role: 'model', text: responseText, sources, timestamp: new Date() });
      if (conflicts?.length) {
        conflicts.forEach(c => newMsgs.push({ id: generateId(), role: 'model', text: '', conflict: { ...c, resolved: false }, timestamp: new Date() }));
      }
      setMessages(prev => [...prev, ...newMsgs]);
    } catch (error) {
      setMessages(prev => [...prev, { id: generateId(), role: 'model', text: "AI error occurred.", timestamp: new Date() }]);
    } finally {
      setAppState(AppState.IDLE);
    }
  };

  const handleAddCitation = async (source: string, style: 'APA' | 'IEEE' | 'MLA' = 'APA') => {
    try {
      const { formatted, inText } = await generateCitation(source, style);
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

    const details = Object.entries(resolutions).map(([id, res]) => {
      const msg = messages.find(m => m.id === id);
      return msg?.conflict ? `RESOLUTION for "${msg.conflict.description}": User chose ${res}.` : "";
    }).join("\n");

    const prompt = `[CRITICAL: CONFLICT RESOLUTIONS SUBMITTED]\n${details}\n\nACTION REQUIRED: Use 'update_report' tool for every resolution to modify the report text immediately according to the user's choices.`;
    setActiveTab('chat');
    await processAIResponse(prompt, updatedMessages);
  };

  const handleDownload = async () => {
    if (currentFile) await saveTextToDocx(currentFile.content, currentFile.name);
  };

  const handleReset = () => {
    if (confirm("Close report? Export first.")) {
      setCurrentFile(null); setMessages([]); setTasks([]); setCitations([]);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  if (!currentFile) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 relative">
        <div className="absolute top-6 left-6 flex items-center gap-2 text-indigo-700 font-bold text-xl">
          <Beaker className="w-6 h-6 text-indigo-600" /><span>LabReportAI</span>
        </div>
        <div className="absolute top-6 right-6 flex gap-2">
          {localStorage.getItem(STORAGE_KEY) && <button onClick={restoreSession} className="px-3 py-2 bg-amber-50 text-amber-700 rounded-lg border border-amber-200 text-sm font-medium"><History className="w-4 h-4 mr-2 inline" />Restore</button>}
          <button onClick={() => setLanguage(language === 'en' ? 'fa' : 'en')} className="px-3 py-2 bg-white rounded-lg border border-slate-200 text-sm font-medium">{language.toUpperCase()}</button>
        </div>
        <div className="w-full max-w-2xl text-center mb-10">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">Intelligent Lab Assistant</h1>
          <p className="text-slate-500">Upload a report to start your research-driven writing session.</p>
        </div>
        <FileUploader onFileSelect={handleFileSelect} isProcessing={appState === AppState.PROCESSING} />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-100 overflow-hidden">
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <button onClick={handleReset} className="p-1.5 hover:bg-slate-100 rounded-lg"><ArrowLeft className="w-5 h-5" /></button>
          <div className="font-bold flex items-center gap-2">
            <Beaker className="w-5 h-5 text-indigo-600" /><span>LabReportAI</span>
          </div>
          <span className="text-sm font-medium text-slate-500 truncate">{currentFile.name}</span>
        </div>
        <button onClick={() => (window as any).aistudio?.openSelectKey()} className="p-1.5 text-slate-400 hover:text-indigo-600"><Key className="w-4 h-4" /></button>
      </header>
      <main className="flex-1 flex overflow-hidden p-4 gap-4">
        <div className="w-full md:w-[400px] flex-shrink-0 flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="flex border-b border-slate-100">
            {['chat', 'tasks', 'citations', 'conflicts'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab as any)} className={`flex-1 py-3 text-xs font-bold uppercase transition-colors border-b-2 ${activeTab === tab ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}>
                {tab === 'conflicts' && unresolvedConflicts.length > 0 && <AlertTriangle className="w-3 h-3 inline mr-1 text-amber-500" />}{tab}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-hidden relative">
            <div className={`absolute inset-0 ${activeTab === 'chat' ? 'z-10' : 'hidden'}`}><ChatInterface messages={messages} onSendMessage={handleSendMessage} onResolveConflict={(m, r) => handleBulkResolveConflicts({[m]: r})} isProcessing={appState === AppState.PROCESSING} language={language} /></div>
            <div className={`absolute inset-0 ${activeTab === 'tasks' ? 'z-10' : 'hidden'}`}><TaskManager tasks={tasks} onAddTask={t => setTasks(p => [...p, {id: generateId(), text: t, completed: false}])} onToggleTask={id => setTasks(p => p.map(t => t.id === id ? {...t, completed: !t.completed} : t))} onDeleteTask={id => setTasks(p => p.filter(t => t.id !== id))} /></div>
            <div className={`absolute inset-0 ${activeTab === 'citations' ? 'z-10' : 'hidden'}`}><CitationManager citations={citations} onAddCitation={handleAddCitation} onDeleteCitation={id => setCitations(p => p.filter(c => c.id !== id))} onInsertToDoc={t => {
              const next = currentFile.content.slice(0, cursorPosition) + t + currentFile.content.slice(cursorPosition);
              setCurrentFile({...currentFile, content: next});
            }} isProcessing={appState === AppState.PROCESSING} /></div>
            <div className={`absolute inset-0 ${activeTab === 'conflicts' ? 'z-10' : 'hidden'}`}><ConflictManager conflicts={unresolvedConflicts} onBulkResolve={handleBulkResolveConflicts} language={language} /></div>
          </div>
        </div>
        <div className="hidden md:flex flex-1 flex-col h-full"><ReportEditor content={currentFile.content} originalContent={currentFile.originalContent} onChange={c => setCurrentFile({...currentFile, content: c})} onDownload={handleDownload} fileName={currentFile.name} language={language} onCursorChange={setCursorPosition} /></div>
      </main>
      {appState === AppState.PROCESSING && <div className="fixed inset-0 bg-white/50 backdrop-blur-sm z-50 flex items-center justify-center"><Loader2 className="w-8 h-8 text-indigo-600 animate-spin" /></div>}
    </div>
  );
};

export default App;