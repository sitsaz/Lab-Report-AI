import React, { useRef, useEffect, useState } from 'react';
import { Send, Bot, User, Globe, ExternalLink, AlertTriangle, Check, Info, Paperclip, PlusCircle, Shield, Layers, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message } from '../types';

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (text: string) => void;
  // onCompareData removed as it is now automatic
  onResolveConflict: (messageId: string, resolution: 'kept_existing' | 'updated_new' | 'combined') => void;
  onFileUpload?: (file: File) => void;
  onAddCitation?: (source: string) => void;
  isProcessing: boolean;
  language: 'en' | 'fa';
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, onSendMessage, onResolveConflict, onFileUpload, onAddCitation, isProcessing, language }) => {
  const [input, setInput] = React.useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isRTL = language === 'fa';
  const dir = isRTL ? 'rtl' : 'ltr';
  const fontClass = isRTL ? 'font-persian' : '';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isProcessing) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const handleFileIconClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        if (onFileUpload) {
            onFileUpload(e.target.files[0]);
        }
        // Reset input so same file can be selected again if needed
        e.target.value = '';
    }
  };

  return (
    <div className={`flex flex-col h-full bg-white overflow-hidden ${fontClass}`}>
      {/* Header */}
      <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
            <div className="p-1 bg-indigo-100 rounded-lg">
                 <Bot className="w-4 h-4 text-indigo-600" />
            </div>
            <h2 className="font-semibold text-slate-800 text-sm">
                {isRTL ? 'دستیار هوشمند' : 'Research Assistant'}
            </h2>
        </div>
        <div className="text-[10px] uppercase font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 tracking-wide">
            Gemini
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30">
        {messages.length === 0 && (
          <div className="text-center text-slate-400 mt-10">
            <p className="mb-2">👋 {isRTL ? 'سلام! من دستیار آزمایشگاه شما هستم.' : "Hi! I'm your lab assistant."}</p>
            <p className="text-sm">
                {isRTL 
                    ? 'گزارش خود را بارگذاری کنید تا شروع کنیم.' 
                    : 'Upload a report to get started. I will automatically detect any conflicts if you provide contradictory data.'}
            </p>
          </div>
        )}
        
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-none'
                  : 'bg-white border border-slate-100 text-slate-800 rounded-bl-none'
              }`}
              dir="auto"
            >
              <div className="flex items-center gap-2 mb-1 opacity-75 text-xs">
                {msg.role === 'user' ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                <span className="capitalize font-medium">
                    {msg.role === 'model' 
                        ? (isRTL ? 'دستیار' : 'Assistant') 
                        : (isRTL ? 'شما' : 'You')}
                </span>
              </div>
              
              <div className="prose prose-sm prose-invert-only max-w-none">
                 <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
              </div>

              {/* Conflict Resolution UI */}
              {msg.conflict && !msg.conflict.resolved && (
                <div className="mt-4 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="bg-amber-50/60 border-b border-amber-100 p-3 flex items-start gap-2.5">
                         <div className="p-1 bg-amber-100 rounded text-amber-600">
                            <AlertTriangle className="w-3.5 h-3.5" />
                         </div>
                         <div>
                             <p className="text-xs font-bold text-slate-800">{msg.conflict.description}</p>
                             {msg.conflict.reasoning && (
                                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{msg.conflict.reasoning}</p>
                             )}
                         </div>
                    </div>
                    
                    <div className="p-3 grid gap-3">
                         <div className="bg-slate-50 rounded-lg p-2 border border-slate-100">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Original</span>
                            <p className="text-xs text-slate-700">{msg.conflict.existing_info}</p>
                         </div>
                         <div className="bg-indigo-50/50 rounded-lg p-2 border border-indigo-100">
                            <span className="text-[10px] font-bold text-indigo-400 uppercase block mb-1">New Input</span>
                            <p className="text-xs text-slate-800 font-medium">{msg.conflict.new_info}</p>
                         </div>
                    </div>

                    <div className="grid grid-cols-3 divide-x divide-slate-100 border-t border-slate-100">
                         <button
                            onClick={() => onResolveConflict(msg.id, 'kept_existing')}
                            className="py-2.5 px-2 hover:bg-slate-50 flex flex-col items-center gap-1 transition-colors group"
                         >
                             <Shield className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600" />
                             <span className="text-[10px] font-medium text-slate-500 group-hover:text-slate-700">Discard</span>
                         </button>
                         <button
                            onClick={() => onResolveConflict(msg.id, 'combined')}
                            className="py-2.5 px-2 hover:bg-amber-50 flex flex-col items-center gap-1 transition-colors group"
                         >
                             <Layers className="w-3.5 h-3.5 text-amber-500 group-hover:text-amber-600" />
                             <span className="text-[10px] font-medium text-amber-600 group-hover:text-amber-700">Merge</span>
                         </button>
                         <button
                            onClick={() => onResolveConflict(msg.id, 'updated_new')}
                            className="py-2.5 px-2 hover:bg-indigo-50 flex flex-col items-center gap-1 transition-colors group"
                         >
                             <RefreshCw className="w-3.5 h-3.5 text-indigo-500 group-hover:text-indigo-600" />
                             <span className="text-[10px] font-medium text-indigo-600 group-hover:text-indigo-700">Overwrite</span>
                         </button>
                    </div>
                </div>
              )}

              {/* Resolved Conflict State */}
              {msg.conflict && msg.conflict.resolved && (
                  <div className="mt-3 p-2 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-2 text-xs text-slate-500">
                      <Check className="w-3.5 h-3.5 text-green-500" />
                      <span>
                          {msg.conflict.resolution === 'updated_new' && 'Updated report.'}
                          {msg.conflict.resolution === 'kept_existing' && 'Kept original.'}
                          {msg.conflict.resolution === 'combined' && 'Merged info.'}
                      </span>
                  </div>
              )}

              {/* Sources */}
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100/20">
                    <div className="flex items-center gap-1.5 text-xs font-semibold mb-2 opacity-90">
                        <Globe className="w-3 h-3" />
                        <span>Sources (Web)</span>
                    </div>
                    <ul className="space-y-1">
                        {msg.sources.map((source, idx) => (
                            <li key={idx} className="flex items-center justify-between gap-2 group/source bg-white/50 p-1 rounded hover:bg-white/80 transition-colors">
                                <a 
                                    href={source.uri} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className={`text-xs flex items-center gap-1 hover:underline truncate max-w-full flex-1 ${msg.role === 'user' ? 'text-indigo-100' : 'text-blue-600'}`}
                                >
                                    <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
                                    {source.title || source.uri}
                                </a>
                                {onAddCitation && (
                                    <button 
                                        onClick={() => onAddCitation(source.uri)}
                                        className="text-slate-400 hover:text-indigo-600 opacity-0 group-hover/source:opacity-100 transition-all p-1"
                                        title="Add to Citations Manager"
                                    >
                                        <PlusCircle className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
              )}
            </div>
          </div>
        ))}
        {isProcessing && (
           <div className="flex justify-start">
             <div className="bg-white border border-slate-100 rounded-2xl rounded-bl-none p-4 shadow-sm flex items-center gap-2">
                <Bot className="w-4 h-4 text-indigo-600 animate-pulse" />
                <span className="text-sm text-slate-500 animate-pulse">
                    {isRTL ? 'در حال بررسی...' : 'Researching and writing...'}
                </span>
             </div>
           </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t border-slate-100">
        <form onSubmit={handleSubmit} className="relative">
          {/* File Upload Input */}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept=".docx" 
            className="hidden" 
          />
          
          <input
            type="text"
            dir={dir}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isRTL ? 'سوال خود را بپرسید...' : 'Ask to find papers, constants, or fill gaps...'}
            className={`w-full border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm py-3 bg-slate-50 border-slate-200 placeholder:text-slate-400 ${isRTL ? 'pr-12 pl-12' : 'pl-12 pr-12'}`}
            disabled={isProcessing}
          />
          
          {/* Left Icon (Upload) */}
          <div className={`absolute top-1/2 -translate-y-1/2 flex items-center gap-1 ${isRTL ? 'right-2' : 'left-2'}`}>
              <button
                type="button"
                onClick={handleFileIconClick}
                disabled={isProcessing}
                className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition-colors"
                title="Upload .docx as input"
              >
                <Paperclip className="w-4 h-4" />
              </button>
          </div>

          {/* Right Icon (Send) */}
          <div className={`absolute top-1/2 -translate-y-1/2 flex items-center gap-1 ${isRTL ? 'left-2' : 'right-2'}`}>
              <button
                type="submit"
                disabled={!input.trim() || isProcessing}
                className="p-2 rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;