import React, { useRef } from 'react';
import { Upload, FileText, History } from 'lucide-react';

interface FileUploaderProps {
  onFileSelect: (file: File) => void;
  onImportSession?: (file: File) => void;
  isProcessing: boolean;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onFileSelect, onImportSession, isProcessing }) => {
  const docInputRef = useRef<HTMLInputElement>(null);
  const sessionInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.docx')) {
        onFileSelect(file);
      } else if (file.name.endsWith('.json') && onImportSession) {
        onImportSession(file);
      } else {
        alert('Please upload a .docx file or a .json session file.');
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'docx' | 'json') => {
    if (e.target.files && e.target.files.length > 0) {
      if (type === 'docx') onFileSelect(e.target.files[0]);
      else if (type === 'json' && onImportSession) onImportSession(e.target.files[0]);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto space-y-4">
      <div
        onClick={() => !isProcessing && docInputRef.current?.click()}
        onDrop={isProcessing ? undefined : handleDrop}
        onDragOver={isProcessing ? undefined : handleDragOver}
        className={`
          border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all h-64
          ${isProcessing ? 'border-gray-300 bg-gray-50 cursor-not-allowed opacity-50' : 'border-indigo-300 bg-white hover:bg-indigo-50/50 hover:border-indigo-500 shadow-xl shadow-indigo-100/20'}
        `}
      >
        <input type="file" ref={docInputRef} onChange={(e) => handleFileChange(e, 'docx')} accept=".docx" className="hidden" disabled={isProcessing} />
        <div className="bg-indigo-600 p-4 rounded-2xl shadow-lg shadow-indigo-200 mb-6">
          <Upload className="w-8 h-8 text-white" />
        </div>
        <h3 className="text-xl font-bold text-slate-800">
          {isProcessing ? 'Processing Lab Report...' : 'Upload Lab Report'}
        </h3>
        <p className="text-slate-500 text-sm mt-2 font-medium">
          Drag & drop your <span className="text-indigo-600 font-bold">.docx</span> here
        </p>
        <div className="mt-6 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
          <FileText className="w-3 h-3" />
          <span>Supports Word Documents</span>
        </div>
      </div>

      {!isProcessing && onImportSession && (
        <button
          onClick={() => sessionInputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 py-4 px-6 bg-slate-800 text-white rounded-2xl font-bold hover:bg-slate-900 transition-all shadow-lg hover:translate-y-[-2px] active:translate-y-[0px]"
        >
          <input type="file" ref={sessionInputRef} onChange={(e) => handleFileChange(e, 'json')} accept=".json" className="hidden" />
          <History className="w-5 h-5 text-indigo-400" />
          <span>Resume from Session File (.json)</span>
        </button>
      )}
    </div>
  );
};

export default FileUploader;