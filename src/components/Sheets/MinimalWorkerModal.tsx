import React, { useState } from 'react';
import { BottomSheet } from './BottomSheet.tsx';
import type { WorkerProfile } from '../../types/telemetry.ts';
import {
  Bot,
  Sparkles,
  LogIn,
  Mail,
  Globe,
  CheckCircle2,
  AlertCircle,
  Power
} from 'lucide-react';
import { startWorkerDaemon, stopWorkerDaemon } from '../../services/api.ts';

interface MinimalWorkerModalProps {
  worker: WorkerProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onLaunchPrompt: (worker: WorkerProfile) => void;
  onOpenAccount: () => void;
  onRefreshWorkers?: () => void;
}

export const MinimalWorkerModal: React.FC<MinimalWorkerModalProps> = ({
  worker,
  isOpen,
  onClose,
  onLaunchPrompt,
  onOpenAccount,
  onRefreshWorkers
}) => {
  const [isTogglingPower, setIsTogglingPower] = useState(false);

  if (!worker) return null;

  const isRunning = worker.status === 'running' || !!worker.activeSession;
  const isAuth = worker.authenticated;
  const isDaemonActive = !!worker.daemonActive;

  const handleTogglePower = async () => {
    if (isTogglingPower) return;
    setIsTogglingPower(true);
    try {
      if (isDaemonActive) {
        await stopWorkerDaemon(worker.id);
      } else {
        await startWorkerDaemon(worker.id);
      }
      onRefreshWorkers?.();
    } catch {
    } finally {
      setIsTogglingPower(false);
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <div className="space-y-4 pb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#1d1f2d] text-blue-400 border border-[#2b2e42] flex items-center justify-center shadow-inner shrink-0">
            <Bot className="w-5 h-5 stroke-[1.9]" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-tight">
                {worker.id}
              </h3>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                  isRunning
                    ? 'bg-emerald-950/70 text-emerald-400 border-emerald-800'
                    : isDaemonActive
                    ? 'bg-emerald-950/50 text-emerald-300 border-emerald-800/60'
                    : isAuth
                    ? 'bg-zinc-800 text-zinc-400 border-zinc-700'
                    : 'bg-zinc-800 text-zinc-500 border-zinc-700'
                }`}
              >
                {isRunning ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Prompting Aktif
                  </>
                ) : isDaemonActive ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    Daemon Aktif
                  </>
                ) : isAuth ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                    Mati (Siaga)
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3 h-3" />
                    Offline (Belum Login)
                  </>
                )}
              </span>
            </div>

            <p className="text-xs text-zinc-400 truncate mt-0.5">
              {worker.hostname || worker.name}
            </p>
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-[#13141c] border border-[#232535] space-y-2 text-xs">
          <div className="flex items-center justify-between text-zinc-300">
            <span className="text-zinc-500 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-zinc-400" />
              <span>Email Akun</span>
            </span>
            <span className="font-medium text-zinc-200 truncate max-w-[200px]">
              {worker.email || 'Belum ditautkan'}
            </span>
          </div>

          <div className="flex items-center justify-between text-zinc-300">
            <span className="text-zinc-500 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-zinc-400" />
              <span>Hostname</span>
            </span>
            <span className="font-medium text-zinc-200">
              {worker.hostname || worker.id}
            </span>
          </div>

          <div className="flex items-center justify-between text-zinc-300 pt-1 border-t border-[#1e202d]">
            <span className="text-zinc-500 flex items-center gap-1.5">
              <Power className="w-3.5 h-3.5 text-zinc-400" />
              <span>Status Daya</span>
            </span>
            <span
              className={`font-semibold ${
                isDaemonActive ? 'text-emerald-400' : isAuth ? 'text-zinc-400' : 'text-zinc-500'
              }`}
            >
              {isDaemonActive ? 'Menyala (Online)' : isAuth ? 'Mati (Hemat RAM)' : 'Nonaktif'}
            </span>
          </div>
        </div>

        {isAuth && (
          <div className="pt-0.5">
            <button
              onClick={handleTogglePower}
              disabled={isTogglingPower}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition-all ${
                isDaemonActive
                  ? 'bg-rose-950/40 text-rose-300 border-rose-800/60 hover:bg-rose-900/60'
                  : 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60 hover:bg-emerald-900/60'
              }`}
            >
              <Power className={`w-4 h-4 ${isTogglingPower ? 'animate-spin' : ''}`} />
              <span>
                {isTogglingPower
                  ? 'Memproses...'
                  : isDaemonActive
                  ? 'Matikan Worker Ini (Stop Daemon)'
                  : 'Hidupkan Worker Ini (Start Daemon)'}
              </span>
            </button>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          {isAuth ? (
            <button
              onClick={() => {
                onClose();
                onLaunchPrompt(worker);
              }}
              className="flex-1 btn-deep-primary py-2.5 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Buka Remote Chat</span>
            </button>
          ) : (
            <button
              onClick={() => {
                onClose();
                onOpenAccount();
              }}
              className="flex-1 btn-deep-primary py-2.5 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Login Google OAuth</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="btn-deep px-4 py-2.5 text-xs font-medium text-zinc-300 rounded-xl"
          >
            Tutup
          </button>
        </div>
      </div>
    </BottomSheet>
  );
};
