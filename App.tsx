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
import { Beaker, ArrowLeft, Info, MessageSquare, ListTodo, Key, Languages, BookOpen, AlertTriangle } from 'lucide-react';

const STORAGE_KEY = 'LAB_REPORT_AUTOSAVE_V1';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [currentFile, setCurrentFile] = useState<ReportFile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [activeTab, setActiveTab] = useState<'chat' | 'tasks' | 'citations' | 'conflicts'>('chat');
  const [cursorPosition, setCursorPosition] = useState<number>(0);
  const [language, setLanguage] = useState<'en' | 'fa'>('en');

  const stateRef = useRef({ currentFile, messages, tasks, citations });

  useEffect(() => {
      stateRef.current = { currentFile, messages, tasks, citations };
  }, [currentFile, messages, tasks, citations]);

  const unresolvedConflicts = messages.filter(m => m.conflict && !m.conflict.resolved);

  useEffect(() => {
    if (unresolvedConflicts.length > 0 && activeTab !== 'conflicts') {
        setActiveTab('conflicts');
    }
  }, [unresolvedConflicts.length]);

  useEffect(() => {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData) {
        try {
            const parsed = JSON.parse(savedData);
            if (parsed.file && parsed.lastSave) {
                if (!parsed.file.originalContent) {
                    parsed.file.originalContent = parsed.file.content;
                }
                const dateStr = new Date(parsed.lastSave).toLocaleString();
                setTimeout(() => {
                    if (window.confirm(`Found an unsaved report from ${dateStr}. Do you want to restore your session?`)) {
                        setCurrentFile(parsed.file);
                        setMessages(parsed.messages || []);
                        setTasks(parsed.tasks || []);
                        setCitations(parsed.citations || []);
                    } else {
                        localStorage.removeItem(STORAGE_KEY);
                    }
                }, 100);
            }
        } catch (e) {
            localStorage.removeItem(STORAGE_KEY);
        }
    }

    const intervalId = setInterval(() => {
        const { currentFile: f, messages: m, tasks: t, citations: c } = stateRef.current;
        if (f) {
            const payload = { file: f, messages: m, tasks: t, citations: c, lastSave: Date.now() };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        }
    }, 2 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, []);

  const handleFileSelect = async (file: File) => {
    setAppState(AppState.PROCESSING);
    try {
      const text = await extractTextFromDocx(file);
      setCurrentFile({
        name: file.name,
        content: text,
        originalContent: text,
        lastModified: file.lastModified,
      });
      setMessages([
        {
          id: crypto.randomUUID(),
          role: 'model',
          text: `I've successfully read **${file.name}**. \n\nYou can see the content on the right.`,
          timestamp: new Date(),
        },
      ]);
      setTasks([
          { id: crypto.randomUUID(), text: 'Review abstract', completed: false },
          { id: crypto.randomUUID(), text: 'Check citations', completed: false }
      ]);
      setCitations([]);
      setAppState(AppState.IDLE);
    } catch (error) {
      alert("Error reading file.");
      setAppState(AppState.ERROR);
    }
  };

  const handleAddCitation = async (source: string, style: 'APA' | 'IEEE' | 'MLA' = 'APA') => {
    try {
        const { formatted, inText } = await generateCitation(source, style);
        const newCitation: Citation = { id: crypto.randomUUID(), source, formatted, inText, style };
        setCitations(prev => prev.some(c => c.source === source) ? prev : [...prev, newCitation]);
    } catch (e) {
        console.error(e);
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

        // Sequential multi-update application
        if (reportUpdates && reportUpdates.length > 0) {
            let nextContent = currentFile.content;
            let appliedCount = 0;
            
            reportUpdates.forEach(update => {
                const updated = nextContent.replace(update.search_text, update.replacement_text);
                if (updated !== nextContent) {
                    nextContent = updated;
                    appliedCount++;
                } else {
                    console.warn("Could not find exact text for replacement:", update.search_text);
                }
            });

            if (appliedCount > 0) {
                setCurrentFile({ ...currentFile, content: nextContent });
            }
        }

        const newMessages: Message[] = [];
        if (responseText) {
            newMessages.push({ id: crypto.randomUUID(), role: 'model', text: responseText, sources, timestamp: new Date() });
        }

        if (conflicts && conflicts.length > 0) {
            conflicts.forEach(c => {
                newMessages.push({ id: crypto.randomUUID(), role: 'model', text: '', conflict: { ...c, resolved: false }, timestamp: new Date() });
            });
        }

        setMessages((prev) => [...prev, ...newMessages]);
      } catch (error) {
        setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'model', text: "An error occurred. Please check your API key.", timestamp: new Date() }]);
      } finally {
        setAppState(AppState.IDLE);
      }
  }

  const handleSendMessage = async (text: string) => {
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', text, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    await processAIResponse(text, [...messages, userMsg]);
  };

  const handleFileUploadFromChat = async (file: File) => {
    if (!currentFile) return;
    setAppState(AppState.PROCESSING);
    try {
        const extractedText = await extractTextFromDocx(file);
        await handleSendMessage(`[Input Data from File: ${file.name}]\n\n${extractedText}`);
    } catch (e) {
        setAppState(AppState.IDLE);
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
          
          if (res === 'updated_new') {
              return `Conflict "${msg.conflict.description}": USER DECISION = OVERWRITE. Replace existing text block exactly matching "${msg.conflict.existing_info}" with new data: "${msg.conflict.new_info}".`;
          } else if (res === 'combined') {
              return `Conflict "${msg.conflict.description}": USER DECISION = COMBINE/MERGE. 
              Existing: "${msg.conflict.existing_info}"
              New: "${msg.conflict.new_info}"
              Action: Synthesize BOTH into a professional rewrite using 'update_report'.`;
          } else {
              return `Conflict "${msg.conflict.description}": USER DECISION = KEEP ORIGINAL. Do not call update_report for this item.`;
          }
      }).filter(Boolean).join("\n");

      const finalPrompt = `
      [SYSTEM: RESOLUTION MANIFEST]
      The user has submitted choices for all pending conflicts:
      
      ${resolutionDetails}
      
      CRITICAL INSTRUCTION:
      1. For EVERY 'OVERWRITE' or 'COMBINE' decision, you MUST call the 'update_report' tool NOW.
      2. Ensure search_text matches the current document content exactly.
      3. Proceed to finish the report based on these resolutions.
      `;

      setActiveTab('chat');
      await processAIResponse(finalPrompt, updatedMessages);
  };

  const handleDeleteCitation = (id: string) => setCitations(prev => prev.filter(c => c.id !== id));

  const handleInsertToDoc = (textToInsert: string) => {
    if (!currentFile) return;
    const { content } = currentFile;
    const newContent = content.substring(0, cursorPosition) + textToInsert + content.substring(cursorPosition);
    setCurrentFile({ ...currentFile, content: newContent });
    setCursorPosition(cursorPosition + textToInsert.length);
  };

  const handleContentChange = (newContent: string) => {
    if (currentFile) setCurrentFile({ ...currentFile, content: newContent });
  };

  const handleDownload = () => {
    if (currentFile) saveTextToDocx(currentFile.content, `Updated_${currentFile.name}`);
  };

  const handleReset = () => {
    if (window.confirm("Close this session? Unsaved data will be lost.")) {
        setCurrentFile(null);
        setMessages([]);
        setTasks([]);
        setCitations([]);
        setAppState(AppState.IDLE);
        localStorage.removeItem(STORAGE_KEY);
    }
  }

  const handleChangeKey = async () => {
    if ((window as any).aistudio?.openSelectKey) await (window as any).aistudio.openSelectKey();
  };
  
  const toggleLanguage = () => setLanguage(prev => prev === 'en' ? 'fa' : 'en');

  if (!currentFile) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 relative">
        <div className="absolute top-6 left-6 flex items-center gap-2 text-indigo-700 font-bold text-xl">
             <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-200"><Beaker className="w-6 h-6 text-white" /></div>
             <span>LabReportAI</span>
        </div>
        <div className="absolute top-6 right-6 flex items-center gap-2">
            <button onClick={toggleLanguage} className="px-3 py-2 bg-white text-slate-600 rounded-lg border border-slate-200 shadow-sm hover:text-indigo-600 hover:border-indigo-300 transition-all text-sm font-medium uppercase w-[80px] justify-center flex items-center gap-2">
                <Languages className="w-4 h-4" /><span>{language}</span>
            </button>
            <button onClick={handleChangeKey} className="flex items-center gap-2 px-3 py-2 bg-white text-slate-600 rounded-lg border border-slate-200 shadow-sm hover:text-indigo-600 hover:border-indigo-300 transition-all text-sm font-medium">
                <Key className="w-4 h-4" /><span>API Key</span>
            </button>
        </div>
        <div className="w-full max-w-2xl text-center mb-10">
            <h1 className="text-4xl font-bold text-slate-900 mb-4 tracking-tight">Scientific Lab Report Assistant</h1>
            <p className="text-lg text-slate-500">Upload your <span className="font-mono text-indigo-600 bg-indigo-50 px-1 rounded">.docx</span> report. I'll help you research and intelligently merge data conflicts.</p>
        </div>
        <FileUploader onFileSelect={handleFileSelect} isProcessing={appState === AppState.PROCESSING} />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-100 overflow-hidden">
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 shadow-sm z-10">
            <div className="flex items-center gap-4">
                <button onClick={handleReset} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"><ArrowLeft className="w-5 h-5" /></button>
                <div className="flex items-center gap-2 font-bold text-slate-800"><Beaker className="w-5 h-5 text-indigo-600" /><span>LabReportAI</span></div>
                <div className="h-4 w-[1px] bg-slate-300 mx-2"></div>
                <span className="text-sm font-medium text-slate-600 truncate max-w-xs">{currentFile.name}</span>
            </div>
            <div className="flex items-center gap-3">
                 <button onClick={toggleLanguage} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1 font-semibold uppercase text-xs border border-transparent hover:border-indigo-100">
                    <Languages className="w-4 h-4" /><span>{language}</span>
                 </button>
                 <button onClick={handleChangeKey} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Key className="w-4 h-4" /></button>
            </div>
        </header>

        <main className="flex-1 flex overflow-hidden p-4 gap-4">
            <div className="w-full md:w-[400px] lg:w-[450px] flex-shrink-0 flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                 <div className="flex border-b border-slate-100 overflow-x-auto scrollbar-hide">
                    <button onClick={() => setActiveTab('chat')} className={`flex-1 min-w-[80px] flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'chat' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/10' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}><MessageSquare className="w-4 h-4" />Chat</button>
                    <div className="w-[1px] bg-slate-100"></div>
                    {unresolvedConflicts.length > 0 ? (
                        <button onClick={() => setActiveTab('conflicts')} className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 py-3 text-sm font-bold transition-colors border-b-2 ${activeTab === 'conflicts' ? 'border-amber-500 text-amber-700 bg-amber-50' : 'border-transparent text-amber-600 hover:bg-amber-50/50'}`}><AlertTriangle className="w-4 h-4 text-amber-500" />Conflicts<span className="bg-amber-100 text-amber-700 text-[10px] px-1.5 rounded-full ml-1">{unresolvedConflicts.length}</span></button>
                    ) : (
                        <button onClick={() => setActiveTab('tasks')} className={`flex-1 min-w-[80px] flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'tasks' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/10' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}><ListTodo className="w-4 h-4" />Tasks</button>
                    )}
                    <div className="w-[1px] bg-slate-100"></div>
                    <button onClick={() => setActiveTab('citations')} className={`flex-1 min-w-[80px] flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'citations' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/10' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}><BookOpen className="w-4 h-4" />Citations</button>
                 </div>

                 <div className="flex-1 overflow-hidden relative">
                    <div className={`absolute inset-0 flex flex-col transition-opacity duration-200 ${activeTab === 'chat' ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none'}`}>
                        <ChatInterface messages={messages} onSendMessage={handleSendMessage} onResolveConflict={(mid, res) => handleBulkResolveConflicts({[mid]: res})} onFileUpload={handleFileUploadFromChat} onAddCitation={(source) => handleAddCitation(source, 'APA')} isProcessing={appState === AppState.PROCESSING} language={language} />
                    </div>
                    <div className={`absolute inset-0 flex flex-col transition-opacity duration-200 ${activeTab === 'tasks' && unresolvedConflicts.length === 0 ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none'}`}>
                        <TaskManager tasks={tasks} onAddTask={text => setTasks(prev => [...prev, {id: crypto.randomUUID(), text, completed: false}])} onToggleTask={id => setTasks(prev => prev.map(t => t.id === id ? {...t, completed: !t.completed} : t))} onDeleteTask={id => setTasks(prev => prev.filter(t => t.id !== id))} />
                    </div>
                    <div className={`absolute inset-0 flex flex-col transition-opacity duration-200 ${activeTab === 'citations' ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none'}`}>
                        <CitationManager citations={citations} onAddCitation={handleAddCitation} onDeleteCitation={handleDeleteCitation} onInsertToDoc={handleInsertToDoc} isProcessing={appState === AppState.PROCESSING} />
                    </div>
                    <div className={`absolute inset-0 flex flex-col transition-opacity duration-200 ${activeTab === 'conflicts' ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none'}`}>
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