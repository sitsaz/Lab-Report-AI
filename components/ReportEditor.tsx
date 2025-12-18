
import React, { useState, useRef, useMemo } from 'react';
import { Download, FilePenLine, Eye, Bold, Italic, List, Heading, Quote, Code, Split, Table as TableIcon, FileCode } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { diffWords } from 'diff';

interface ReportEditorProps {
  content: string;
  originalContent?: string;
  onChange: (newContent: string) => void;
  onDownload: () => void;
  fileName: string;
  language: 'en' | 'fa';
  onCursorChange?: (position: number) => void;
}

type ViewMode = 'write' | 'preview' | 'split';

const ReportEditor: React.FC<ReportEditorProps> = ({ content, originalContent, onChange, onDownload, fileName, language, onCursorChange }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('write');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isRTL = language === 'fa';
  const dir = isRTL ? 'rtl' : 'ltr';
  const fontClass = isRTL ? 'font-persian' : 'font-mono';
  const previewFontClass = isRTL ? 'font-persian' : '';

  const diffedMarkdown = useMemo(() => {
    if (!originalContent) return content;
    const changes = diffWords(originalContent, content);
    let result = '';
    changes.forEach((part) => {
        if (part.added) {
            result += `<span class="bg-indigo-100 text-indigo-800 border-b-2 border-indigo-200 px-0.5 rounded-sm">${part.value}</span>`;
        } else if (!part.removed) {
            result += part.value;
        }
    });
    return result;
  }, [content, originalContent]);

  const handleSelect = () => {
    if (textareaRef.current && onCursorChange) {
        onCursorChange(textareaRef.current.selectionEnd);
    }
  };

  const generateTableMarkdown = (rows: number, cols: number) => {
    let header = '|';
    let separator = '|';
    for (let i = 1; i <= cols; i++) {
        header += ` Header ${i} |`;
        separator += ` --- |`;
    }
    let body = '';
    for (let r = 1; r <= rows; r++) {
        body += '\n|';
        for (let c = 1; c <= cols; c++) {
            body += ` Cell ${r}-${c} |`;
        }
    }
    return `\n${header}\n${separator}${body}\n`;
  };

  const handleToolbarClick = (action: string) => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selection = text.substring(start, end);
    let newText = text;
    let newCursorPos = end;

    switch (action) {
      case 'bold':
        newText = text.substring(0, start) + `**${selection}**` + text.substring(end);
        newCursorPos = end + 4;
        break;
      case 'italic':
        newText = text.substring(0, start) + `*${selection}*` + text.substring(end);
        newCursorPos = end + 2;
        break;
      case 'heading':
        const prefix = start > 0 && text[start - 1] !== '\n' ? '\n### ' : '### ';
        newText = text.substring(0, start) + prefix + selection + text.substring(end);
        newCursorPos = start + prefix.length + selection.length;
        break;
      case 'list':
        if (selection.includes('\n')) {
             const listified = selection.split('\n').map(l => `- ${l}`).join('\n');
             const pre = start > 0 && text[start - 1] !== '\n' ? '\n' : '';
             newText = text.substring(0, start) + pre + listified + text.substring(end);
             newCursorPos = start + pre.length + listified.length;
        } else {
             const pre = start > 0 && text[start - 1] !== '\n' ? '\n- ' : '- ';
             newText = text.substring(0, start) + pre + selection + text.substring(end);
             newCursorPos = start + pre.length + selection.length;
        }
        break;
      case 'quote':
        const quotePre = start > 0 && text[start - 1] !== '\n' ? '\n> ' : '> ';
        newText = text.substring(0, start) + quotePre + selection + text.substring(end);
        newCursorPos = start + quotePre.length + selection.length;
        break;
      case 'code':
        newText = text.substring(0, start) + `\`${selection}\`` + text.substring(end);
        newCursorPos = end + 2;
        break;
      case 'codeblock':
        const codeBlock = `\`\`\`\n${selection || 'code'}\n\`\`\``;
        const cbPre = start > 0 && text[start - 1] !== '\n' ? '\n' : '';
        newText = text.substring(0, start) + cbPre + codeBlock + text.substring(end);
        newCursorPos = start + cbPre.length + 4 + (selection.length || 4);
        break;
      case 'table':
        const rowsStr = window.prompt("Number of data rows:", "2");
        if (rowsStr === null) return;
        const colsStr = window.prompt("Number of columns:", "2");
        if (colsStr === null) return;
        const tableTemplate = generateTableMarkdown(parseInt(rowsStr) || 1, parseInt(colsStr) || 1);
        const tblPre = start > 0 && text[start - 1] !== '\n' ? '\n' : '';
        newText = text.substring(0, start) + tblPre + tableTemplate + text.substring(end);
        newCursorPos = start + tblPre.length + tableTemplate.length;
        break;
    }

    onChange(newText);
    setTimeout(() => {
        if(textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
            if(onCursorChange) onCursorChange(newCursorPos);
        }
    }, 0);
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-2 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between flex-wrap gap-2 min-h-[50px]">
        <div className="flex items-center gap-2 pl-2 mr-2">
            <div className="flex flex-col">
                <span className="font-semibold text-slate-800 text-xs leading-tight">Live Editor</span>
                <span className="text-[10px] text-slate-500 truncate max-w-[100px]">{fileName}</span>
            </div>
        </div>

        {(viewMode === 'write' || viewMode === 'split') && (
            <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1 shadow-sm gap-0.5 overflow-x-auto">
                <ToolbarButton icon={<Bold className="w-3.5 h-3.5" />} onClick={() => handleToolbarClick('bold')} title="Bold" />
                <ToolbarButton icon={<Italic className="w-3.5 h-3.5" />} onClick={() => handleToolbarClick('italic')} title="Italic" />
                <div className="w-[1px] h-4 bg-slate-200 mx-1 flex-shrink-0"></div>
                <ToolbarButton icon={<Heading className="w-3.5 h-3.5" />} onClick={() => handleToolbarClick('heading')} title="Heading" />
                <ToolbarButton icon={<List className="w-3.5 h-3.5" />} onClick={() => handleToolbarClick('list')} title="List" />
                <ToolbarButton icon={<Quote className="w-3.5 h-3.5" />} onClick={() => handleToolbarClick('quote')} title="Quote" />
                <div className="w-[1px] h-4 bg-slate-200 mx-1 flex-shrink-0"></div>
                <ToolbarButton icon={<Code className="w-3.5 h-3.5" />} onClick={() => handleToolbarClick('code')} title="Inline Code" />
                <ToolbarButton icon={<FileCode className="w-3.5 h-3.5" />} onClick={() => handleToolbarClick('codeblock')} title="Code Block" />
                <ToolbarButton icon={<TableIcon className="w-3.5 h-3.5" />} onClick={() => handleToolbarClick('table')} title="Insert Table" />
            </div>
        )}

        <div className="flex items-center gap-2 ml-auto">
             <div className="flex bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                <button onClick={() => setViewMode('write')} className={`p-1.5 rounded-md transition-all ${viewMode === 'write' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`} title="Edit Mode"><FilePenLine className="w-3.5 h-3.5" /></button>
                <button onClick={() => setViewMode('split')} className={`hidden md:block p-1.5 rounded-md transition-all ${viewMode === 'split' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`} title="Split View"><Split className="w-3.5 h-3.5" /></button>
                <button onClick={() => setViewMode('preview')} className={`p-1.5 rounded-md transition-all ${viewMode === 'preview' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`} title="Preview Mode"><Eye className="w-3.5 h-3.5" /></button>
             </div>
             <div className="h-4 w-[1px] bg-slate-200 mx-1"></div>
             <button onClick={onDownload} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"><Download className="w-3.5 h-3.5" /><span className="hidden sm:inline">Export</span></button>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden flex">
        {(viewMode === 'write' || viewMode === 'split') && (
            <div className={`h-full relative flex flex-col ${viewMode === 'split' ? 'w-1/2 border-r border-slate-200' : 'w-full'}`}>
                <textarea
                    ref={textareaRef}
                    value={content}
                    onChange={(e) => onChange(e.target.value)}
                    onSelect={handleSelect}
                    onKeyUp={handleSelect}
                    onClick={handleSelect}
                    dir={dir}
                    className={`flex-1 w-full resize-none p-6 focus:outline-none text-slate-800 text-sm leading-relaxed overflow-y-auto bg-white ${fontClass}`}
                    placeholder={isRTL ? 'متن خود را اینجا بنویسید...' : 'Start typing your report...'}
                    spellCheck={false}
                />
            </div>
        )}

        {(viewMode === 'preview' || viewMode === 'split') && (
             <div className={`h-full overflow-y-auto p-6 bg-slate-50/30 prose prose-sm prose-indigo max-w-none ${viewMode === 'split' ? 'w-1/2' : 'w-full'} ${previewFontClass}`} dir={dir}>
                <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw]}
                    components={{
                        table: ({node, ...props}) => (
                            <div className="overflow-x-auto my-6 rounded-lg border border-slate-300 shadow-md">
                                <table className="min-w-full divide-y divide-slate-300 bg-white" {...props} />
                            </div>
                        ),
                        thead: ({node, ...props}) => (<thead className="bg-slate-100" {...props} />),
                        th: ({node, ...props}) => (<th className={`px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-300 ${isRTL ? 'text-right' : 'text-left'}`} {...props} />),
                        td: ({node, ...props}) => (<td className="px-4 py-3 text-sm text-slate-800 border-b border-slate-200" {...props} />),
                    }}
                >
                    {diffedMarkdown}
                </ReactMarkdown>
             </div>
        )}
      </div>
      <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-xs text-slate-500 flex justify-between items-center">
        <span>{viewMode === 'write' ? 'Markdown Editor' : viewMode === 'preview' ? 'Preview' : 'Split View'}</span>
        <span className="font-mono">{content.length} chars</span>
      </div>
    </div>
  );
};

const ToolbarButton: React.FC<{ icon: React.ReactNode; onClick: () => void; title: string }> = ({ icon, onClick, title }) => (
    <button onClick={onClick} className="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-indigo-600 transition-colors" title={title}>{icon}</button>
);

export default ReportEditor;
