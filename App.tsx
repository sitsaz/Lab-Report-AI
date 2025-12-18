
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
import { Beaker, ArrowLeft, Key, Languages, BookOpen, AlertTriangle, MessageSquare, ListTodo, History, Info, Loader2 } from 'lucide-react';

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
        const restoredMessages = (data.messages || []).map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        }));
        setMessages(restoredMessages);
        setTasks(data.tasks || []);
        setCitations(data.citations || []);
        setLanguage(data.language || 'en');
        setLastSaved(new Date(data.lastSave));
      } catch (e) {
        console.error("Failed to restore session:", e);
      }
    }
  };

  const handleFileSelect = async (file: File) => {
    console.log("App: handleFileSelect called for", file.name);
    setAppState(AppState.PROCESSING);
    try {
      const text = await extractTextFromDocx(file);
      console.log("App: Extraction successful.");
      
      setCurrentFile({
        name: file.name,
        content: text,
        originalContent: text,
        lastModified: file.lastModified,
      });
      setMessages([
        {
          id: generateId(),
          role: 'model',
          text: `I've successfully read **${file.name}**. \n\nYou can see the content and its tables on the right in the preview pane.`,
          timestamp: new Date(),
        },
      ]);
      setTasks([
        { id: generateId(), text: 'Review abstract', completed: false },
        { id: generateId(), text: 'Check data accuracy', completed: false }
      ]);
      setAppState(AppState.IDLE);
    } catch (error: any) {
      console.error("App: Extraction failed:", error);
      alert(`Error reading file "${file.name}": ${error.message || 'Unknown error'}`);
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

      if (newCitations && newCitations.length > 0) {
        newCitations.forEach(source => handleAddCitation(source, 'APA'));
      }

      if (reportUpdates && reportUpdates.length > 0) {
        let nextContent = currentFile.content;
        let appliedCount = 0;
        reportUpdates.forEach(update => {
          const updated = nextContent.replace(update.search_text, update.replacement_text);
          if (updated !== nextContent) {
            nextContent = updated;
            appliedCount++;
          }
        });
        if (appliedCount > 0) {
          setCurrentFile({ ...currentFile, content: nextContent });
        }
      }

      const newMessages: Message[] = [];
      if (responseText) {
        newMessages.push({ id: generateId(), role: 'model', text: responseText, sources, timestamp: new Date() });
      }
      if (conflicts && conflicts.length > 0) {
        conflicts.forEach(c => {
          newMessages.push({ id: generateId(), role: 'model', text: '', conflict: { ...c, resolved: false }, timestamp: new Date() });
        });
      }
      setMessages((prev) => [...prev, ...newMessages]);
    } catch (error) {
      setMessages((prev) => [...prev, { id: generateId(), role: 'model', text: "An error occurred with the AI connection.", timestamp: new Date() }]);
    } finally {
      setAppState(AppState.IDLE);
    }
  };

  const handleAddCitation = async (source: string, style: 'APA' | 'IEEE' | 'MLA' = 'APA') => {
    try {
      const { formatted, inText } = await generateCitation(source, style);
      const newCitation: Citation = { id: generateId(), source, formatted, inText, style };
      setCitations(prev => prev.some(c => c.source === source) ? prev : [...prev, newCitation]);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendMessage = async (text: string) => {
    const userMsg: Message = { id: generateId(), role: 'user', text, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    await processAIResponse(text, [...messages, userMsg]);
  };

  const handleDeleteCitation = (id: string) => {
    setCitations(prev => prev.filter(c => c.id !== id));
  };

  const handleInsertToDoc = (textToInsert: string) => {
    if (!currentFile) return;
    const { content } = currentFile;
    const newContent = content.slice(0, cursorPosition) + textToInsert + content.slice(cursorPosition);
    setCurrentFile({ ...currentFile, content: newContent });
    setCursorPosition(cursorPosition + textToInsert.length);
  };

  const handleContentChange = (newContent: string) => {
    if (currentFile) {
      setCurrentFile({ ...currentFile, content: newContent });
    }
  };

  const handleDownload = async () => {
    if (currentFile) {
      await saveTextToDocx(currentFile.content, currentFile.name);
    }
  };

  const handleBulkResolveConflicts = async (resolutions: Record<string, 'kept_existing' | 'updated_new' | 'combined'>) => {
    setAppState(AppState.PROCESSING);
    const updatedMessages = messages.map(msg => {
      if (resolutions[msg.id]) {
        return { ...msg, conflict: { ...msg.conflict!, resolved: true, resolution: resolutions[msg.id] } };
      }
      return msg;
    });
    setMessages(updatedMessages);

    const resolutionDetails = Object.entries(resolutions).map(([id, res]) => {
      const msg = messages.find(m => m.id === id);
      if (!msg || !msg.conflict) return "";
      return `Conflict "${msg.conflict.description}": Decision = ${res}.`;
    }).join("\n");

    const finalPrompt = `[SYSTEM: CONFLICT RESOLUTIONS]\n${resolutionDetails}\n\nApply the requested updates and continue.`;
    setActiveTab('chat');
    await processAIResponse(finalPrompt, updatedMessages);
  };

  const handleReset = () => {
    if (window.confirm("Close this report? Ensure you have exported your work.")) {
      setCurrentFile(null);
      setMessages([]);
      setTasks([]);
      setCitations([]);
      setAppState(AppState.IDLE);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const handleChangeKey = async () => {
    if ((window as any).aistudio?.openSelectKey) await (window as any).aistudio.openSelectKey();
  };

  if (!currentFile) {
    const hasSavedSession = !!localStorage.getItem(STORAGE_KEY);
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 relative">
        <div className="absolute top-6 left-6 flex items-center gap-2 text-indigo-700 font-bold text-xl">
          <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-200"><Beaker className="w-6 h-6 text-white" /></div>
          <span>LabReportAI</span>
        </div>
        <div className="absolute top-6 right-6 flex items-center gap-2">
          {hasSavedSession && (
            <button onClick={restoreSession} className="flex items-center gap-2 px-3 py-2 bg-amber-50 text-amber-700 rounded-lg border border-amber-200 shadow-sm hover:bg-amber-100 transition-all text-sm font-medium">
              <History className="w-4 h-4" /><span>Restore Last Session</span>
            </button>
          )}
          <button onClick={() => setLanguage(language === 'en' ? 'fa' : 'en')} className="px-3 py-2 bg-white text-slate-600 rounded-lg border border-slate-200 shadow-sm hover:text-indigo-600 transition-all text-sm font-medium uppercase">
            <Languages className="w-4 h-4 mr-2 inline-block" />{language}
          </button>
          <button onClick={handleChangeKey} className="flex items-center gap-2 px-3 py-2 bg-white text-slate-600 rounded-lg border border-slate-200 shadow-sm hover:text-indigo-600 transition-all text-sm font-medium">
            <Key className="w-4 h-4" /><span>API Key</span>
          </button>
        </div>
        <div className="w-full max-w-2xl text-center mb-10">
          <h1 className="text-4xl font-bold text-slate-900 mb-4 tracking-tight">Intelligent Lab Report Assistant</h1>
          <p className="text-lg text-slate-500">Upload your report to start writing, researching, and fixing formatting.</p>
        </div>
        <FileUploader onFileSelect={handleFileSelect} isProcessing={appState === AppState.PROCESSING} />
        
        {appState === AppState.PROCESSING && (
           <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
              <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
              <p className="text-lg font-bold text-slate-700">Converting Document...</p>
              <p className="text-sm text-slate-500">This may take a moment for large files.</p>
           </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-100 overflow-hidden">
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <button onClick={handleReset} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500"><ArrowLeft className="w-5 h-5" /></button>
          <div className="flex items-center gap-2 font-bold text-slate-800">
            <Beaker className="w-5 h-5 text-indigo-600" />
            <span>LabReportAI</span>
            {lastSaved && (
              <span className="text-[10px] font-normal text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100 ml-2">
                Autosaved {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          <div className="h-4 w-[1px] bg-slate-300 mx-2"></div>
          <span className="text-sm font-medium text-slate-600 truncate max-w-xs">{currentFile.name}</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setLanguage(language === 'en' ? 'fa' : 'en')} className="p-1.5 text-slate-400 hover:text-indigo-600 uppercase text-xs font-bold px-2 rounded-lg hover:bg-indigo-50 transition-colors">
            <Languages className="w-4 h-4 mr-1 inline-block" />{language}
          </button>
          <button onClick={handleChangeKey} className="p-1.5 text-slate-400 hover:text-indigo-600"><Key className="w-4 h-4" /></button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden p-4 gap-4">
        <div className="w-full md:w-[400px] lg:w-[450px] flex-shrink-0 flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="flex border-b border-slate-100 overflow-x-auto">
            <button onClick={() => setActiveTab('chat')} className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'chat' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/10' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}><MessageSquare className="w-4 h-4 inline mr-2" />Chat</button>
            <button onClick={() => setActiveTab(unresolvedConflicts.length > 0 ? 'conflicts' : 'tasks')} className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'tasks' || activeTab === 'conflicts' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/10' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>
              {unresolvedConflicts.length > 0 ? <AlertTriangle className="w-4 h-4 inline mr-2 text-amber-500" /> : <ListTodo className="w-4 h-4 inline mr-2" />}
              {unresolvedConflicts.length > 0 ? 'Conflicts' : 'Tasks'}
            </button>
            <button onClick={() => setActiveTab('citations')} className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'citations' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/10' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}><BookOpen className="w-4 h-4 inline mr-2" />Citations</button>
          </div>

          <div className="flex-1 overflow-hidden relative">
            <div className={`absolute inset-0 flex flex-col transition-opacity ${activeTab === 'chat' ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none'}`}>
              <ChatInterface messages={messages} onSendMessage={handleSendMessage} onResolveConflict={(mid, res) => handleBulkResolveConflicts({[mid]: res})} onAddCitation={(source) => handleAddCitation(source, 'APA')} isProcessing={appState === AppState.PROCESSING} language={language} />
            </div>
            <div className={`absolute inset-0 flex flex-col transition-opacity ${activeTab === 'tasks' ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none'}`}>
              <TaskManager tasks={tasks} onAddTask={text => setTasks(prev => [...prev, {id: generateId(), text, completed: false}])} onToggleTask={id => setTasks(prev => prev.map(t => t.id === id ? {...t, completed: !t.completed} : t))} onDeleteTask={id => setTasks(prev => prev.filter(t => t.id !== id))} />
            </div>
            <div className={`absolute inset-0 flex flex-col transition-opacity ${activeTab === 'citations' ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none'}`}>
              <CitationManager citations={citations} onAddCitation={handleAddCitation} onDeleteCitation={handleDeleteCitation} onInsertToDoc={handleInsertToDoc} isProcessing={appState === AppState.PROCESSING} />
            </div>
            <div className={`absolute inset-0 flex flex-col transition-opacity ${activeTab === 'conflicts' ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none'}`}>
              <ConflictManager conflicts={unresolvedConflicts} onBulkResolve={handleBulkResolveConflicts} language={language} />
            </div>
          </div>
        </div>

        <div className="hidden md:flex flex-1 flex-col h-full min-w-0">
          <ReportEditor content={currentFile.content} originalContent={currentFile.originalContent} onChange={handleContentChange} onDownload={handleDownload} fileName={currentFile.name} language={language} onCursorChange={setCursorPosition} />
        </div>
      </main>
    </div>
  );
};

export default App;
