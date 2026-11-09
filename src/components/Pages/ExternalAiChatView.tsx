import React, { useState } from 'react';
import {
  Brain,
  Bot,
  Copy,
  Check,
  SendHorizontal,
  Sparkles,
  Trash2,
  Folder,
  Layers,
  ArrowRight
} from 'lucide-react';
import type { ExternalChatMessage, ProjectFolderMetadata } from '../../services/promptEnhancer.ts';

interface ExternalAiChatViewProps {
  messages: ExternalChatMessage[];
  isThinking: boolean;
  onClear: () => void;
  onTransferToAgy: (promptText: string) => void;
  onSelectSuggestion: (text: string) => void;
  metadata?: ProjectFolderMetadata;
  onOpenMetadataModal: () => void;
  providerName: string;
  modelName: string;
}

export const ExternalAiChatView: React.FC<ExternalAiChatViewProps> = ({
  messages,
  isThinking,
  onClear,
  onTransferToAgy,
  onSelectSuggestion,
  metadata,
  onOpenMetadataModal,
  providerName,
  modelName
}) => {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const suggestions = [
    'Rancang prompt terperinci untuk fitur ini',
    'Analisis arsitektur & dependensi proyek ini',
    'Review efisiensi token & kepatuhan NOKOMEN',
    'Jelaskan alur data dan routing endpoint'
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#08090d]">
      <div className="px-4 py-2 border-b border-[#1b1c28] bg-[#0c0d14] flex items-center justify-between text-xs font-mono shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-300">
            <Brain className="w-3.5 h-3.5 text-purple-400" />
            <span className="font-semibold uppercase tracking-wider text-[10px]">
              {providerName}: {modelName}
            </span>
          </div>

          <button
            type="button"
            onClick={onOpenMetadataModal}
            className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#161723] hover:bg-[#1d1f30] border border-[#27293d] text-zinc-300 text-[10px] transition-colors cursor-pointer"
          >
            <Folder className="w-3 h-3 text-amber-400" />
            <span className="truncate max-w-[120px]">
              {metadata?.projectName || 'Metadata'}
            </span>
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                metadata?.summary ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
          </button>
        </div>

        {messages.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="p-1 text-zinc-500 hover:text-rose-400 hover:bg-[#1a1b26] rounded transition-colors cursor-pointer"
            title="Bersihkan Diskusi"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 max-w-md mx-auto space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600/20 to-blue-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-xl">
              <Brain className="w-6 h-6 stroke-[1.8]" />
            </div>

            <div className="space-y-1">
              <h3 className="text-sm font-semibold font-mono text-zinc-100">
                Diskusi Proyek AI
              </h3>
              <p className="text-xs text-zinc-400">
                Gunakan AI eksternal untuk merancang prompt, bedah kode, atau konsultasi sebelum eksekusi di worker.
              </p>
            </div>

            {metadata && (
              <div
                onClick={onOpenMetadataModal}
                className="w-full text-left p-3 rounded-xl bg-[#11121c] border border-[#202234] hover:border-purple-500/40 cursor-pointer transition-all space-y-1 font-mono text-[11px]"
              >
                <div className="flex items-center justify-between text-zinc-400 text-[10px]">
                  <span className="uppercase font-bold text-amber-400">Konteks Proyek</span>
                  <span className="text-zinc-500">Buka Detail →</span>
                </div>
                <div className="text-zinc-200 font-medium truncate">
                  {metadata.projectName}
                </div>
                <div className="text-zinc-400 text-[10px] line-clamp-2">
                  {metadata.summary}
                </div>
              </div>
            )}

            <div className="w-full space-y-1.5 pt-2">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block text-left">
                Rekomendasi Diskusi
              </span>
              <div className="grid grid-cols-1 gap-1.5">
                {suggestions.map((sug, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onSelectSuggestion(sug)}
                    className="w-full text-left p-2 rounded-xl bg-[#0f1019] hover:bg-[#181928] border border-[#1e2030] text-xs font-mono text-zinc-300 hover:text-white transition-all flex items-center justify-between group cursor-pointer"
                  >
                    <span className="truncate">{sug}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-purple-400 shrink-0 ml-1" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${
                msg.role === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div
                className={`max-w-[92%] sm:max-w-[80%] rounded-2xl p-3.5 font-mono text-xs leading-relaxed shadow-lg ${
                  msg.role === 'user'
                    ? 'bg-purple-600/90 text-white rounded-br-xs'
                    : 'bg-[#121420] border border-[#222538] text-zinc-200 rounded-bl-xs'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5 pb-1 border-b border-white/10 text-[10px] text-zinc-400">
                  <span className="font-semibold uppercase tracking-wider">
                    {msg.role === 'user' ? 'Anda' : `${providerName} AI`}
                  </span>
                  <span>{msg.timestamp || ''}</span>
                </div>

                <div className="whitespace-pre-wrap select-text break-words">
                  {msg.content}
                </div>

                {msg.role === 'assistant' && (
                  <div className="mt-3 pt-2 border-t border-[#1d2033] flex items-center justify-end gap-2 text-[10px]">
                    <button
                      type="button"
                      onClick={() => handleCopy(msg.content, idx)}
                      className="px-2 py-1 rounded-md bg-[#191b2c] hover:bg-[#22253d] text-zinc-300 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      {copiedIdx === idx ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>{copiedIdx === idx ? 'Tersalin' : 'Salin'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onTransferToAgy(msg.content)}
                      className="px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Bot className="w-3 h-3" />
                      <span>Kirim ke AGY</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {isThinking && (
          <div className="flex items-start">
            <div className="p-3 rounded-2xl bg-[#121420] border border-[#222538] flex items-center gap-2 text-xs font-mono text-purple-300 animate-pulse">
              <Sparkles className="w-4 h-4 text-purple-400 animate-spin" />
              <span>Memproses analisis...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
