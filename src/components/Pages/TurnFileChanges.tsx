import React, { useState } from 'react';
import { ChevronDown, ChevronUp, FileText } from 'lucide-react';
import type { FileChangeDetail } from '../../services/transcript.ts';

interface TurnFileChangesProps {
  files: FileChangeDetail[];
  totalAdditions?: number;
  totalDeletions?: number;
  onSelectFile: (path: string) => void;
  onOpenReview: () => void;
}

export const TurnFileChanges: React.FC<TurnFileChangesProps> = ({
  files,
  totalAdditions,
  totalDeletions,
  onSelectFile,
  onOpenReview
}) => {
  const [expanded, setExpanded] = useState(true);

  if (!files || files.length === 0) return null;

  const adds = totalAdditions ?? files.reduce((acc, f) => acc + (f.additions || 0), 0);
  const dels = totalDeletions ?? files.reduce((acc, f) => acc + (f.deletions || 0), 0);
  const fileCountText = files.length === 1 ? '1 file changed' : `${files.length} files changed`;

  return (
    <div className="mt-3 rounded-xl bg-[#0f1019] border border-[#222538] overflow-hidden text-xs shadow-sm">
      <div className="p-2.5 flex items-center justify-between bg-[#121320] border-b border-[#1f2133]">
        <button
          onClick={() => setExpanded((prev) => !prev)}
          className="flex items-center gap-2 font-mono text-zinc-300 hover:text-white transition-colors cursor-pointer"
        >
          <span className="font-semibold text-zinc-200">{fileCountText}</span>
          {adds > 0 && <span className="text-emerald-400 font-semibold font-mono">+{adds}</span>}
          {dels > 0 && <span className="text-rose-400 font-semibold font-mono">-{dels}</span>}
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-zinc-500" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
          )}
        </button>

        <button
          onClick={onOpenReview}
          className="btn-deep py-1 px-2.5 rounded-lg text-xs font-semibold text-zinc-200 hover:text-white flex items-center gap-1.5 cursor-pointer shadow-sm"
        >
          <FileText className="w-3.5 h-3.5 text-blue-400" />
          <span>Review</span>
        </button>
      </div>

      {expanded && (
        <div className="divide-y divide-[#1b1c2b] bg-[#0c0d15]">
          {files.map((f) => (
            <div
              key={f.path}
              onClick={() => onSelectFile(f.path)}
              className="px-3 py-2 flex items-center justify-between gap-3 hover:bg-[#161826] transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span
                  className={`text-[10px] font-mono px-1 py-0.5 rounded font-bold shrink-0 ${
                    f.action === 'created'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  }`}
                >
                  {f.action === 'created' ? '+' : 'M*'}
                </span>
                <span className="font-mono text-zinc-100 font-medium text-xs group-hover:text-blue-300 transition-colors shrink-0">
                  {f.name}
                </span>
                {f.dir && (
                  <span className="font-mono text-[11px] text-zinc-500 truncate min-w-0">
                    {f.dir}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
                {f.additions > 0 && (
                  <span className="text-emerald-400 font-semibold">+{f.additions}</span>
                )}
                {f.deletions > 0 && (
                  <span className="text-rose-400 font-semibold">-{f.deletions}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
