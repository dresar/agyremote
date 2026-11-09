import React, { useState, useRef, useEffect } from 'react';
import { GoogleAvatar } from '../Common/GoogleAvatar.tsx';
import {
  Bot,
  MoreVertical,
  Sparkles,
  LogIn,
  Cpu,
  Shield,
  Activity,
  Power
} from 'lucide-react';
import type { WorkerProfile } from '../../types/telemetry.ts';
import { startWorkerDaemon, stopWorkerDaemon } from '../../services/api.ts';

interface WorkerCardProps {
  worker: WorkerProfile;
  onSelect: (worker: WorkerProfile) => void;
  onLaunchPrompt: (worker: WorkerProfile) => void;
  onOpenUsage?: () => void;
  onOpenAccount?: () => void;
  onRefresh?: () => void;
}

export const WorkerCard: React.FC<WorkerCardProps> = ({
  worker,
  onSelect,
  onLaunchPrompt,
  onOpenUsage,
  onOpenAccount,
  onRefresh
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isTogglingPower, setIsTogglingPower] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isRunning = worker.status === 'running' || !!worker.activeSession;
  const isAuth = worker.authenticated;
  const isDaemonActive = !!worker.daemonActive;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  const handleTogglePower = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isTogglingPower) return;
    setIsTogglingPower(true);
    try {
      if (isDaemonActive) {
        await stopWorkerDaemon(worker.id);
      } else {
        await startWorkerDaemon(worker.id);
      }
      onRefresh?.();
    } catch {
    } finally {
      setIsTogglingPower(false);
    }
  };

  return (
    <div
      onClick={() => onSelect(worker)}
      className="card aspect-square rounded-2xl p-3 flex flex-col justify-between border-[#252736] bg-gradient-to-b from-[#181924] to-[#12131b] hover:border-[#383d54] shadow-xl transition-all cursor-pointer relative select-none"
    >
      <div className="flex items-center justify-between w-full">
        <div className="relative">
          <GoogleAvatar
            picture={worker.picture}
            id={worker.id}
            email={worker.email}
            sizeClassName="w-8 h-8 rounded-xl"
            iconSizeClassName="w-4 h-4 stroke-[1.9]"
          />
          <span
            className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#181924] ${
              isRunning
                ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.9)]'
                : isDaemonActive
                ? 'bg-emerald-500'
                : isAuth
                ? 'bg-zinc-600'
                : 'bg-zinc-700'
            }`}
          />
        </div>

        <div className="relative" ref={menuRef}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsMenuOpen((prev) => !prev);
            }}
            className="p-1 rounded-full text-zinc-400 hover:text-zinc-100 hover:bg-[#202232] transition-colors"
            title="Menu Pilihan"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-44 rounded-xl bg-[#181924] border border-[#2d3042] shadow-2xl py-1 z-30 text-xs animate-in fade-in zoom-in-95 duration-100">
              {isAuth && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMenuOpen(false);
                    onLaunchPrompt(worker);
                  }}
                  className="w-full px-3 py-2 text-left text-zinc-200 hover:bg-[#222538] flex items-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  <span>Prompt</span>
                </button>
              )}

              {isAuth && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMenuOpen(false);
                    handleTogglePower(e);
                  }}
                  className="w-full px-3 py-2 text-left text-zinc-200 hover:bg-[#222538] flex items-center gap-2 cursor-pointer"
                >
                  <Power className={`w-3.5 h-3.5 ${isDaemonActive ? 'text-rose-400' : 'text-emerald-400'}`} />
                  <span>{isDaemonActive ? 'Matikan' : 'Hidupkan'}</span>
                </button>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMenuOpen(false);
                  onOpenUsage?.();
                }}
                className="w-full px-3 py-2 text-left text-zinc-200 hover:bg-[#222538] flex items-center gap-2 cursor-pointer"
              >
                <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                <span>Usage</span>
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMenuOpen(false);
                  onOpenAccount?.();
                }}
                className="w-full px-3 py-2 text-left text-zinc-200 hover:bg-[#222538] flex items-center gap-2 cursor-pointer"
              >
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                <span>Akun</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="my-auto py-1 text-center">
        <h4 className="text-sm font-bold text-zinc-100 uppercase tracking-tight">
          {worker.id}
        </h4>
        <span className="text-[10px] text-zinc-400 truncate block mt-0.5">
          {worker.hostname || worker.name}
        </span>
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-[#1e202d] text-zinc-400">
        <div className="flex items-center gap-1 text-[10px]">
          {isRunning ? (
            <span className="text-emerald-400 font-medium flex items-center gap-1">
              <Activity className="w-3 h-3 animate-spin" />
              <span>Prompting</span>
            </span>
          ) : isDaemonActive ? (
            <span className="text-emerald-400 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Aktif</span>
            </span>
          ) : isAuth ? (
            <span className="text-zinc-500 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
              <span>Mati</span>
            </span>
          ) : (
            <span className="text-zinc-500">Offline</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {isAuth && (
            <button
              onClick={handleTogglePower}
              disabled={isTogglingPower}
              className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-all ${
                isDaemonActive
                  ? 'bg-emerald-950/50 text-emerald-300 border-emerald-700/60 hover:bg-rose-950/50 hover:text-rose-300 hover:border-rose-700'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-emerald-950/40 hover:text-emerald-400 hover:border-emerald-600'
              }`}
              title={isDaemonActive ? 'Klik untuk matikan worker' : 'Klik untuk hidupkan worker'}
            >
              <Power className={`w-3.5 h-3.5 ${isTogglingPower ? 'animate-spin' : ''}`} />
            </button>
          )}

          {isAuth ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onLaunchPrompt(worker);
              }}
              className="w-7 h-7 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white flex items-center justify-center border border-blue-500/40 transition-colors"
              title="Kirim Prompt"
            >
              <Sparkles className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelect(worker);
              }}
              className="w-7 h-7 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white flex items-center justify-center border border-zinc-700 transition-colors"
              title="Login Google"
            >
              <LogIn className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
