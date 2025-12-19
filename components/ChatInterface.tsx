import React, { useRef, useEffect, useState } from 'react';
import { Send, Bot, User, Globe, ExternalLink, AlertTriangle, Check, Info, Paperclip, PlusCircle, Shield, Layers, RefreshCw, Sparkles, Cpu, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message } from '../types';

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (text: string) => void;
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

  return (
    <div className={`flex flex-col h-full bg-white overflow-hidden ${fontClass}`}>
      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50/20">
        {messages.length === 0 && (
          <div className="text-center text-slate-400 mt-10">
            <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-slate-200">
               <Bot className="w-8 h-8 text-slate-300" />
            </div>
            <p className="font-black text-slate-600 uppercase tracking-tighter mb-1">Session Inactive</p>
            <p className="text-xs text-slate-400">Ask a question to start the scientific inquiry.</p>
          </div>
        )}
        
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[90%] rounded-2xl p-4 shadow-sm border transition-all ${
                msg.role === 'user'
                  ? 'bg-slate-900 text-white border-slate-800 rounded-br-none'
                  : 'bg-white border-slate-200 text-slate-800 rounded-bl-none'
              }`}
              dir="auto"
            >
              <div className="flex items-center justify-between gap-4 mb-2">
                <div className="flex items-center gap-1.5 opacity-60 text-[10px] font-black uppercase tracking-widest">
                  {msg.role === 'user' ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                  <span>{msg.role === 'model' ? (isRTL ? 'دستیار' : 'Assistant') : (isRTL ? 'شما' : 'User')}</span>
                </div>
                {msg.role === 'model' && msg.provider && (
                  <div className={`px-2 py-0.5 rounded-full text-[9px] font-black border uppercase ${
                    msg.provider === 'gemini' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                    msg.provider === 'openai' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                    msg.provider === 'avalai' ? 'bg-cyan-50 text-cyan-600 border-cyan-100' :
                    'bg-amber-50 text-amber-600 border-amber-100'
                  }`}>
                    {msg.provider}
                  </div>
                )}
              </div>
              
              <div className="prose prose-sm prose-invert-only max-w-none text-sm leading-relaxed font-medium">
                 <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
              </div>

              {/* Conflict UI - Redesigned */}
              {msg.conflict && !msg.conflict.resolved && (
                <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
                    <div className="p-3 border-b border-slate-200 flex items-center gap-2 bg-white">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        <span className="text-xs font-black uppercase tracking-tight">{msg.conflict.description}</span>
                    </div>
                    <div className="p-3 grid gap-2">
                        <div className="text-[10px] text-slate-400 font-bold uppercase">Discrepancy:</div>
                        <div className="p-2.5 bg-white border border-slate-200 rounded-lg text-xs leading-relaxed italic text-slate-600">
                           {msg.conflict.reasoning}
                        </div>
                    </div>
                    <div className="grid grid-cols-3 divide-x divide-slate-200 border-t border-slate-200">
                         <button onClick={() => onResolveConflict(msg.id, 'kept_existing')} className="py-3 px-1 text-[10px] font-black uppercase text-slate-500 hover:bg-white hover:text-slate-900 transition-all">Keep</button>
                         <button onClick={() => onResolveConflict(msg.id, 'combined')} className="py-3 px-1 text-[10px] font-black uppercase text-amber-600 hover:bg-amber-50 transition-all">Merge</button>
                         <button onClick={() => onResolveConflict(msg.id, 'updated_new')} className="py-3 px-1 text-[10px] font-black uppercase text-indigo-600 hover:bg-indigo-50 transition-all">Replace</button>
                    </div>
                </div>
              )}

              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                        <Globe className="w-3 h-3" />
                        <span>Research references</span>
                    </div>
                    <ul className="grid gap-1.5">
                        {msg.sources.map((source, idx) => (
                            <li key={idx} className="flex items-center justify-between group bg-slate-50 border border-slate-100 p-1.5 rounded-lg">
                                <a href={source.uri} target="_blank" rel="noreferrer" className="text-[11px] font-bold text-indigo-600 hover:underline truncate max-w-[200px]">
                                    {source.title || source.uri}
                                </a>
                                <ExternalLink className="w-2.5 h-2.5 text-slate-300" />
                            </li>
                        ))}
                    </ul>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white border-t border-slate-200">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              dir={dir}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isRTL ? 'دستور خود را بنویسید...' : 'Ask for research, verification, or edits...'}
              className={`w-full border-2 border-slate-100 rounded-2xl focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all text-sm py-3.5 ${isRTL ? 'pr-4 pl-12' : 'pl-4 pr-12'} font-medium bg-slate-50/50`}
              disabled={isProcessing}
            />
            <button
                type="submit"
                disabled={!input.trim() || isProcessing}
                className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'left-2' : 'right-2'} p-2 rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-30 disabled:scale-95 transition-all shadow-lg shadow-indigo-100`}
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;