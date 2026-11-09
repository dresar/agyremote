import React from 'react';
import { Terminal, Trash2 } from 'lucide-react';
import type { ProcessItem } from '../../types/telemetry.ts';

interface ProcessCardProps {
  process: ProcessItem;
  onSelect: (process: ProcessItem) => void;
  onKill: (process: ProcessItem) => void;
}

export const ProcessCard: React.FC<ProcessCardProps> = ({ process, onSelect, onKill }) => {
  const isHighCpu = process.cpu > 5.0;

  return (
    <div
      onClick={() => onSelect(process)}
      className={`card p-3 transition-all cursor-pointer border-[#272832] bg-[#16171d] hover:border-[#383a4c] ${
        isHighCpu ? 'card--accent' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 rounded-md bg-[#1d1f27] text-zinc-300 shrink-0 border border-[#2d2f3c]">
            <Terminal className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs font-semibold text-zinc-100">
                PID {process.pid}
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#1e2028] text-zinc-400 font-mono border border-[#2c2e3a]">
                {process.user}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 font-mono truncate mt-0.5">
              {process.command}
            </p>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2">
          <div className="text-right">
            <div className="text-xs font-semibold font-mono text-zinc-200">
              {process.cpu.toFixed(1)}% <span className="text-[9px] text-zinc-500 font-normal">CPU</span>
            </div>
            <div className="text-xs font-semibold font-mono text-zinc-300">
              {process.mem.toFixed(1)}% <span className="text-[9px] text-zinc-500 font-normal">MEM</span>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onKill(process);
            }}
            className="p-1.5 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
            title="Hentikan proses"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
