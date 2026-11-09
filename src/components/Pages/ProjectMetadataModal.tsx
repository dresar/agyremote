import React, { useState } from 'react';
import {
  Folder,
  X,
  Sparkles,
  Loader2,
  Layers,
  FileCode,
  ShieldCheck,
  Calendar,
  Check
} from 'lucide-react';
import {
  type ProjectFolderMetadata,
  analyzeAndSaveProjectMetadata
} from '../../services/promptEnhancer.ts';

interface ProjectMetadataModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderPath: string;
  metadata: ProjectFolderMetadata;
  onMetadataUpdated: (newMeta: ProjectFolderMetadata) => void;
}

export const ProjectMetadataModal: React.FC<ProjectMetadataModalProps> = ({
  isOpen,
  onClose,
  folderPath,
  metadata,
  onMetadataUpdated
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleRunAiAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const updated = await analyzeAndSaveProjectMetadata(folderPath);
      onMetadataUpdated(updated);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCopySummary = () => {
    if (metadata.summary) {
      navigator.clipboard.writeText(metadata.summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-lg bg-[#0e0f17] border border-[#27293d] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="px-4 py-3 border-b border-[#1d1f2e] flex items-center justify-between bg-[#121420]">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Folder className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-mono font-bold text-zinc-100 truncate">
                {metadata.projectName || 'Metadata Proyek'}
              </h3>
              <p className="text-[10px] font-mono text-zinc-400 truncate">
                {folderPath}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#1f2133] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto text-xs font-mono">
          <div className="p-3 rounded-xl bg-[#141624] border border-[#23263b] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                Ringkasan
              </span>
              <button
                type="button"
                onClick={handleCopySummary}
                className="text-[10px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1 cursor-pointer"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : null}
                <span>{copied ? 'Tersalin' : 'Salin'}</span>
              </button>
            </div>
            <p className="text-zinc-300 leading-relaxed text-[11px]">
              {metadata.summary || 'Belum dianalisis oleh AI'}
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              <span>Tech Stack</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {metadata.techStack.length > 0 ? (
                metadata.techStack.map((tech, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded-md bg-[#181a29] border border-[#2a2d45] text-blue-300 text-[10px]"
                  >
                    {tech}
                  </span>
                ))
              ) : (
                <span className="text-zinc-500 text-[10px]">Belum terdeteksi</span>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              <FileCode className="w-3.5 h-3.5 text-emerald-400" />
              <span>Entry Points</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {metadata.entryPoints.length > 0 ? (
                metadata.entryPoints.map((ep, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded-md bg-[#181a29] border border-[#2a2d45] text-emerald-300 text-[10px]"
                  >
                    {ep}
                  </span>
                ))
              ) : (
                <span className="text-zinc-500 text-[10px]">Belum terdeteksi</span>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
              <span>Aturan Standar</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {metadata.rules.length > 0 ? (
                metadata.rules.map((rule, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded-md bg-[#181a29] border border-[#2a2d45] text-purple-300 text-[10px]"
                  >
                    {rule}
                  </span>
                ))
              ) : (
                <span className="text-zinc-500 text-[10px]">Belum terdeteksi</span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[#1d1f2e] text-[10px] text-zinc-500">
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>Pembaruan: {metadata.updatedAt || 'Hari ini'}</span>
            </div>
          </div>
        </div>

        <div className="p-3 border-t border-[#1d1f2e] bg-[#121420] flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl border border-[#2a2c3f] text-zinc-300 hover:text-white hover:bg-[#1a1c2a] text-xs font-mono cursor-pointer"
          >
            Tutup
          </button>

          <button
            type="button"
            onClick={handleRunAiAnalysis}
            disabled={isAnalyzing}
            className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:bg-purple-950 disabled:text-purple-400 text-white text-xs font-mono font-medium flex items-center gap-1.5 shadow-md transition-all cursor-pointer disabled:cursor-not-allowed"
          >
            {isAnalyzing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>{isAnalyzing ? 'Menganalisis...' : 'Analisis AI'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
