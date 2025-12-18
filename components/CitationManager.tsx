import React, { useState } from 'react';
import { BookOpen, Plus, Copy, Check, Trash2, ArrowRightToLine } from 'lucide-react';
import { Citation } from '../types';

interface CitationManagerProps {
  citations: Citation[];
  onAddCitation: (source: string, style: 'APA' | 'IEEE' | 'MLA') => Promise<void>;
  onDeleteCitation: (id: string) => void;
  onInsertToDoc: (text: string) => void;
  isProcessing: boolean;
}

const CitationManager: React.FC<CitationManagerProps> = ({ 
  citations, 
  onAddCitation, 
  onDeleteCitation, 
  onInsertToDoc,
  isProcessing 
}) => {
  const [newSource, setNewSource] = useState('');
  const [style, setStyle] = useState<'APA' | 'IEEE' | 'MLA'>('APA');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newSource.trim()) {
      await onAddCitation(newSource.trim(), style);
      setNewSource('');
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/30">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 bg-white">
        <div className="flex items-center gap-2 font-semibold text-slate-700 mb-1">
            <BookOpen className="w-5 h-5 text-indigo-600" />
            <span>Citations</span>
        </div>
        <p className="text-xs text-slate-500">Generate and manage references.</p>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
         {citations.length === 0 && (
             <div className="text-center text-slate-400 mt-10 p-4">
                 <p className="text-sm font-medium">No citations yet</p>
                 <p className="text-xs mt-1">Add a URL or title to generate one.</p>
             </div>
         )}
         
         {citations.map((cite) => (
           <div key={cite.id} className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm group">
              <div className="flex justify-between items-start gap-2 mb-2">
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded uppercase tracking-wider">{cite.style}</span>
                  <button 
                    onClick={() => onDeleteCitation(cite.id)}
                    className="text-slate-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
              </div>
              
              <div className="text-sm text-slate-800 font-medium mb-1 line-clamp-2" title={cite.formatted}>
                {cite.formatted}
              </div>
              <div className="text-xs text-indigo-600 font-mono mb-3 bg-indigo-50 inline-block px-1.5 rounded">
                {cite.inText}
              </div>

              <div className="flex items-center gap-2 mt-1">
                 <button
                    onClick={() => onInsertToDoc(cite.inText)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 hover:text-indigo-600 border border-slate-200 rounded-lg transition-colors"
                    title="Insert citation marker at cursor"
                 >
                    <ArrowRightToLine className="w-3.5 h-3.5" />
                    Insert In-Text
                 </button>
                 <button
                    onClick={() => onInsertToDoc(`\n\n${cite.formatted}`)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 hover:text-indigo-600 border border-slate-200 rounded-lg transition-colors"
                    title="Append to document end"
                 >
                    <Plus className="w-3.5 h-3.5" />
                    Add to Biblio
                 </button>
              </div>
           </div>
         ))}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-100 bg-white">
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <div className="flex gap-2">
                <select 
                    value={style}
                    onChange={(e) => setStyle(e.target.value as any)}
                    className="text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-indigo-500"
                >
                    <option value="APA">APA</option>
                    <option value="IEEE">IEEE</option>
                    <option value="MLA">MLA</option>
                </select>
                <input
                    type="text"
                    value={newSource}
                    onChange={(e) => setNewSource(e.target.value)}
                    placeholder="URL, DOI, or Title..."
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-xs"
                    disabled={isProcessing}
                />
            </div>
            <button
                type="submit"
                disabled={!newSource.trim() || isProcessing}
                className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors text-sm font-medium"
            >
                {isProcessing ? 'Generating...' : 'Generate Citation'}
            </button>
        </form>
      </div>
    </div>
  );
};

export default CitationManager;