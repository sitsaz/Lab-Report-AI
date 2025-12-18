import React, { useRef } from 'react';
import { Upload, FileText } from 'lucide-react';

interface FileUploaderProps {
  onFileSelect: (file: File) => void;
  isProcessing: boolean;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onFileSelect, isProcessing }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.docx')) {
        onFileSelect(file);
      } else {
        alert('Please upload a .docx file.');
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div
      onClick={isProcessing ? undefined : handleClick}
      onDrop={isProcessing ? undefined : handleDrop}
      onDragOver={isProcessing ? undefined : handleDragOver}
      className={`
        border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all
        ${isProcessing ? 'border-gray-300 bg-gray-50 cursor-not-allowed opacity-50' : 'border-indigo-300 bg-indigo-50/30 hover:bg-indigo-50 hover:border-indigo-500'}
        h-64 w-full max-w-lg mx-auto
      `}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".docx"
        className="hidden"
        disabled={isProcessing}
      />
      <div className="bg-white p-4 rounded-full shadow-sm mb-4">
        <Upload className="w-8 h-8 text-indigo-600" />
      </div>
      <h3 className="text-lg font-semibold text-slate-700">
        {isProcessing ? 'Processing...' : 'Upload your Lab Report'}
      </h3>
      <p className="text-slate-500 text-sm mt-2">
        Drag & drop a .docx file here, or click to browse
      </p>
      <div className="mt-4 flex items-center gap-2 text-xs text-slate-400 bg-white px-3 py-1 rounded-full border border-slate-200">
        <FileText className="w-3 h-3" />
        <span>Supports .docx</span>
      </div>
    </div>
  );
};

export default FileUploader;
