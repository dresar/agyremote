import React from 'react';
import { SystemVitalsCard } from '../Cards/SystemVitalsCard.tsx';
import type { SystemVitals, WorkerProfile } from '../../types/telemetry.ts';
import { RefreshCw, Activity, Sparkles, Bot, ArrowRight, Layers } from 'lucide-react';

interface OverviewTabProps {
  vitals: SystemVitals | null;
  workers: WorkerProfile[];
  loadingVitals: boolean;
  loadingWorkers: boolean;
  onRefresh: () => void;
  onSelectWorker: (worker: WorkerProfile) => void;
  onLaunchPrompt: (worker: WorkerProfile) => void;
  onNavigateToWorkers?: () => void;
  onOpenSkillManager?: (workerId?: string) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  vitals,
  workers,
  loadingVitals,
  loadingWorkers,
  onRefresh,
  onLaunchPrompt,
  onNavigateToWorkers,
  onOpenSkillManager
}) => {
  const onlineCount = workers.filter((w) => w.daemonActive).length;
  const runningWorkers = workers.filter((w) => w.status === 'running' || !!w.activeSession);
  const activeDaemons = workers.filter((w) => w.daemonActive);
  const offlineCount = workers.filter((w) => !w.daemonActive).length;

  return (
    <div className="space-y-3.5 pb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <div className="card p-4 rounded-2xl space-y-3 border-[#252736] bg-gradient-to-b from-[#181924] to-[#12131b] shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-400" />
              <h2 className="text-xs font-semibold text-zinc-100 uppercase tracking-wider">
                Kluster
              </h2>
            </div>
            <div className="flex items-center gap-1.5">
              {onOpenSkillManager && (
                <button
                  type="button"
                  onClick={() => onOpenSkillManager()}
                  className="btn-deep px-2.5 py-1.5 rounded-xl text-xs font-mono text-zinc-300 hover:text-white flex items-center gap-1.5 cursor-pointer"
                  title="Skill"
                >
                  <Layers className="w-3.5 h-3.5 text-purple-400" />
                  <span>Skill</span>
                </button>
              )}
              <button
                onClick={onRefresh}
                className="btn-deep p-2 rounded-xl text-zinc-300 hover:text-white"
                title="Segarkan"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingVitals || loadingWorkers ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5 pt-2 border-t border-[#1f212e]">
            <div className="p-2.5 rounded-xl bg-[#12131b] border border-[#232535] text-center">
              <div className="text-base font-bold text-emerald-400">{onlineCount}</div>
              <div className="text-[10px] text-zinc-400 font-medium uppercase mt-0.5">Online</div>
            </div>
            <div className="p-2.5 rounded-xl bg-[#12131b] border border-[#232535] text-center">
              <div className="text-base font-bold text-blue-400">{runningWorkers.length}</div>
              <div className="text-[10px] text-zinc-400 font-medium uppercase mt-0.5">Prompting</div>
            </div>
            <div className="p-2.5 rounded-xl bg-[#12131b] border border-[#232535] text-center">
              <div className="text-base font-bold text-zinc-500">{offlineCount}</div>
              <div className="text-[10px] text-zinc-500 font-medium uppercase mt-0.5">Offline</div>
            </div>
          </div>
        </div>

        <SystemVitalsCard vitals={vitals} loading={loadingVitals} />
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>Aktivitas</span>
          </h3>
          {runningWorkers.length > 0 && (
            <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-[2px] bg-emerald-400 animate-pulse inline-block" />
              {runningWorkers.length} Aktif
            </span>
          )}
        </div>

        {runningWorkers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {runningWorkers.map((w) => {
              const tasks = w.activeTasks && w.activeTasks.length > 0
                ? w.activeTasks
                : [
                    {
                      name: w.activeSession ? 'Sesi Aktif' : 'Antigravity Engine',
                      details: w.activeSession || `Port ${w.port || 8787} • Proses Berjalan`,
                      status: 'running'
                    }
                  ];

              return (
                <div
                  key={w.id}
                  className="card p-3.5 rounded-2xl border-[#252736] bg-gradient-to-b from-[#181924] to-[#12131b] shadow-xl flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/40 flex items-center justify-center shrink-0">
                        <Activity className="w-4 h-4 animate-spin" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-zinc-100 uppercase tracking-tight">
                          {w.id} • {w.hostname}
                        </div>
                        <div className="text-[11px] text-emerald-400 flex items-center gap-1 mt-0.5">
                          <span className="w-1.5 h-1.5 rounded-[2px] bg-emerald-400 animate-pulse shrink-0 inline-block" />
                          <span>Sedang memproses</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {onOpenSkillManager && (
                        <button
                          type="button"
                          onClick={() => onOpenSkillManager(w.id)}
                          className="btn-deep p-1.5 rounded-xl text-zinc-400 hover:text-zinc-200 text-xs"
                          title="Skill"
                        >
                          <Layers className="w-3.5 h-3.5 text-purple-400" />
                        </button>
                      )}
                      <button
                        onClick={() => onLaunchPrompt(w)}
                        className="btn-deep-primary px-3 py-1.5 text-xs font-semibold rounded-xl"
                      >
                        Buka Chat
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-[#1f212e] space-y-1.5">
                    <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                      Proses Berjalan
                    </div>
                    {tasks.map((task, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2 p-2 rounded-xl bg-[#0e0f16] border border-[#202230]"
                      >
                        <span className="w-1.5 h-1.5 rounded-[2px] bg-emerald-400 animate-pulse shrink-0 inline-block mt-1" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[11px] font-semibold text-zinc-200 font-mono truncate">
                              {task.name}
                            </span>
                            {task.pid && (
                              <span className="text-[9px] font-mono text-zinc-500 px-1.5 py-0.5 rounded bg-[#171822] border border-[#252838]">
                                PID {task.pid}
                              </span>
                            )}
                          </div>
                          {task.details && (
                            <div className="text-[10px] font-mono text-zinc-400 truncate mt-0.5">
                              {task.details}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : activeDaemons.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {activeDaemons.map((w) => {
              const tasks = w.activeTasks && w.activeTasks.length > 0
                ? w.activeTasks
                : [
                    {
                      name: 'Daemon Standby',
                      details: `Port ${w.port || 8787} • Siap Eksekusi`,
                      status: 'idle'
                    }
                  ];

              return (
                <div
                  key={w.id}
                  className="card p-3 rounded-2xl border-[#252736] bg-gradient-to-b from-[#181924] to-[#12131b] shadow-xl flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-emerald-950/40 text-emerald-400 border border-emerald-800/50 flex items-center justify-center shrink-0">
                        <Bot className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-zinc-100 uppercase tracking-tight flex items-center gap-1.5">
                          <span>{w.id}</span>
                          <span className="text-[10px] text-emerald-400 font-normal px-1.5 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800/40">
                            Siap Prompt
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                          {w.email || w.hostname || 'Antigravity Ready'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {onOpenSkillManager && (
                        <button
                          type="button"
                          onClick={() => onOpenSkillManager(w.id)}
                          className="btn-deep p-1.5 rounded-xl text-zinc-400 hover:text-zinc-200 text-xs"
                          title="Skill"
                        >
                          <Layers className="w-3.5 h-3.5 text-purple-400" />
                        </button>
                      )}
                      <button
                        onClick={() => onLaunchPrompt(w)}
                        className="btn-deep-primary px-3 py-1.5 text-xs font-semibold rounded-xl"
                      >
                        Prompt
                      </button>
                    </div>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-[#1f212e] space-y-1.5">
                    {tasks.map((task, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2 p-1.5 px-2 rounded-xl bg-[#0e0f16] border border-[#202230]"
                      >
                        <span className="w-1.5 h-1.5 rounded-[2px] bg-emerald-400 animate-pulse shrink-0 inline-block mt-1" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-semibold text-zinc-300 font-mono truncate">
                              {task.name}
                            </span>
                            {task.pid && (
                              <span className="text-[9px] font-mono text-zinc-500 px-1 py-0.2 rounded bg-[#171822]">
                                PID {task.pid}
                              </span>
                            )}
                          </div>
                          {task.details && (
                            <div className="text-[10px] font-mono text-zinc-400 truncate">
                              {task.details}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="card p-5 rounded-2xl text-center space-y-3 border-[#252736] bg-gradient-to-b from-[#181924] to-[#12131b] shadow-xl">
            <div className="w-10 h-10 rounded-2xl bg-[#1d1f2d] text-zinc-400 border border-[#2b2e42] flex items-center justify-center mx-auto shadow-inner">
              <Bot className="w-5 h-5 text-zinc-300" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-zinc-200">Standby</h4>
            </div>
            {onNavigateToWorkers && (
              <button
                onClick={onNavigateToWorkers}
                className="btn-deep-primary px-4 py-2 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
              >
                <span>Workers</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
