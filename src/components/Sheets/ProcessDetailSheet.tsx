import React, { useState } from 'react';
import { BottomSheet } from './BottomSheet.tsx';
import { killProcess } from '../../services/api.ts';
import type { ProcessItem } from '../../types/telemetry.ts';
import { Trash2, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

interface ProcessDetailSheetProps {
  process: ProcessItem | null;
  isOpen: boolean;
  onClose: () => void;
  onTerminated: (pid: number) => void;
}

export const ProcessDetailSheet: React.FC<ProcessDetailSheetProps> = ({
  process: proc,
  isOpen,
  onClose,
  onTerminated
}) => {
  const [confirming, setConfirming] = useState(false);
  const [killing, setKilling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  if (!proc) return null;

  const handleKill = async () => {
    setKilling(true);
    setError(null);
    setResult(null);

    try {
      const res = await killProcess(proc.pid);
      if (res.success) {
        setResult(`PID ${proc.pid} dihentikan`);
        setTimeout(() => {
          onTerminated(proc.pid);
          onClose();
          setConfirming(false);
          setResult(null);
        }, 1000);
      } else {
        setError('Gagal menghentikan proses');
      }
    } catch (err: any) {
      setError(err.message || 'Gagal');
    } finally {
      setKilling(false);
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={`PID ${proc.pid}`}>
      <div className="space-y-3">
        <div className="p-3 rounded-lg bg-[#121318] border border-[#272832] space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-zinc-400">PID</span>
            <span className="font-mono text-zinc-100 font-semibold">{proc.pid}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">PPID</span>
            <span className="font-mono text-zinc-300">{proc.ppid}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">User</span>
            <span className="font-mono text-zinc-300">{proc.user}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">CPU</span>
            <span className="font-mono text-zinc-100 font-semibold">{proc.cpu.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">MEM</span>
            <span className="font-mono text-zinc-100 font-semibold">{proc.mem.toFixed(1)}%</span>
          </div>
        </div>

        <div className="space-y-1">
          <span className="text-[10px] font-semibold text-zinc-400 uppercase font-mono">
            Perintah
          </span>
          <div className="p-2.5 rounded-lg bg-[#0e0f12] border border-[#272832] font-mono text-[11px] text-zinc-200 break-all leading-relaxed">
            {proc.command}
          </div>
        </div>

        {error && (
          <div className="p-2.5 rounded-lg bg-rose-950/60 border border-rose-800 text-xs text-rose-300">
            {error}
          </div>
        )}

        {result && (
          <div className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-300 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            {result}
          </div>
        )}

        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="w-full btn-deep-danger py-2 text-xs font-semibold"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Hentikan Proses
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setConfirming(false)}
              disabled={killing}
              className="flex-1 btn-deep py-2 text-xs font-semibold"
            >
              Batal
            </button>
            <button
              onClick={handleKill}
              disabled={killing}
              className="flex-1 btn-deep-danger py-2 text-xs font-semibold"
            >
              {killing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Konfirmasi Hentikan
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </BottomSheet>
  );
};
