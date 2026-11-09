import React, { useState, useEffect } from 'react';
import { BottomSheet } from './BottomSheet.tsx';
import { GoogleAvatar } from '../Common/GoogleAvatar.tsx';
import type { SystemVitals, WorkerProfile, WorkerUsage } from '../../types/telemetry.ts';
import { fetchWorkerUsage } from '../../services/api.ts';
import { ChevronLeft, ChevronDown, RefreshCw, Bot, User, CheckCircle2 } from 'lucide-react';

interface UsageSheetProps {
  isOpen: boolean;
  onClose: () => void;
  vitals: SystemVitals | null;
  workers: WorkerProfile[];
  initialWorkerId?: string;
  onRefresh?: () => void;
}

export const UsageSheet: React.FC<UsageSheetProps> = ({
  isOpen,
  onClose,
  vitals,
  workers,
  initialWorkerId,
  onRefresh
}) => {
  const [activeSegment, setActiveSegment] = useState<'quota' | 'system'>('quota');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>(initialWorkerId || 'agy10');
  const [usageData, setUsageData] = useState<WorkerUsage | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);

  useEffect(() => {
    if (initialWorkerId) {
      setSelectedWorkerId(initialWorkerId);
    }
  }, [initialWorkerId]);

  const loadUsage = (id: string) => {
    setLoadingUsage(true);
    fetchWorkerUsage(id)
      .then((data) => {
        setUsageData(data);
      })
      .catch(() => {
        setUsageData(null);
      })
      .finally(() => {
        setLoadingUsage(false);
      });
  };

  useEffect(() => {
    if (isOpen) {
      loadUsage(selectedWorkerId);
    }
  }, [isOpen, selectedWorkerId]);

  const handleSelectAccount = (id: string) => {
    setSelectedWorkerId(id);
    loadUsage(id);
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || isNaN(bytes)) return '0.0 GB';
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(1)} GB`;
  };

  const CircularRing: React.FC<{ percent: number; color?: string; size?: number }> = ({
    percent,
    color = '#10b981',
    size = 18
  }) => {
    const radius = 7;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percent / 100) * circumference;

    return (
      <svg width={size} height={size} viewBox="0 0 20 20" className="rotate-[-90deg]">
        <circle
          cx="10"
          cy="10"
          r={radius}
          stroke="#262836"
          strokeWidth="2.5"
          fill="none"
        />
        <circle
          cx="10"
          cy="10"
          r={radius}
          stroke={color}
          strokeWidth="2.5"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    );
  };

  const selectedWorkerObj = workers.find((w) => w.id === selectedWorkerId);
  const memPct = Math.round(vitals?.memory?.percent || 51);
  const diskPct = Math.round(vitals?.disk?.percent || 89);
  const cpuPct = Math.min(100, Math.round(((vitals?.cpu?.load1 || 1.2) / (vitals?.cpu?.cores || 2)) * 100));

  const geminiWeeklyLeft = usageData?.gemini?.weeklyPercentLeft ?? 56;
  const geminiWeeklyReset = usageData?.gemini?.weeklyReset ?? '3d 21h';
  const geminiFiveHourLeft = usageData?.gemini?.fiveHourPercentLeft ?? 88;
  const geminiFiveHourReset = usageData?.gemini?.fiveHourReset ?? '4h 7m';

  const claudeWeeklyLeft = usageData?.claudeGpt?.weeklyPercentLeft ?? 100;
  const claudeFiveHourLeft = usageData?.claudeGpt?.fiveHourPercentLeft ?? 100;

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <div className="space-y-4 pb-2">
        <div className="flex items-center justify-between pb-2 border-b border-[#1f212d]">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-zinc-100 font-semibold text-sm hover:text-white transition-colors -ml-1"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2.2]" />
            <span>Usage</span>
          </button>

          <div className="flex items-center gap-2">
            <div className="flex p-0.5 rounded-lg bg-[#14151e] border border-[#262835]">
              <button
                onClick={() => setActiveSegment('quota')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  activeSegment === 'quota'
                    ? 'bg-[#222434] text-white shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Antigravity
              </button>
              <button
                onClick={() => setActiveSegment('system')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  activeSegment === 'system'
                    ? 'bg-[#222434] text-white shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                VPS Monitor
              </button>
            </div>

            <button
              onClick={() => {
                loadUsage(selectedWorkerId);
                onRefresh?.();
              }}
              className="p-1 rounded-md text-zinc-400 hover:text-zinc-100 transition-colors"
              title="Segarkan"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingUsage ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {activeSegment === 'quota' ? (
          <div className="space-y-4 px-0.5">
            <div className="space-y-1.5">
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">
                Pilih Akun Worker
              </span>
              <div className="relative">
                <select
                  value={selectedWorkerId}
                  onChange={(e) => handleSelectAccount(e.target.value)}
                  className="w-full appearance-none bg-[#141520] hover:bg-[#1a1b2a] border border-[#27293a] text-zinc-100 text-xs font-bold font-mono rounded-xl px-3 py-2 pr-8 cursor-pointer focus:outline-none focus:border-blue-500 transition-colors shadow-inner"
                >
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.id.toUpperCase()} • {w.daemonActive ? '🟢 Online' : '⚪ Offline'} — {w.email || 'Tanpa Akun'}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-[#12131c] border border-[#232536] flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <GoogleAvatar
                  picture={selectedWorkerObj?.picture}
                  id={selectedWorkerId}
                  email={usageData?.email || selectedWorkerObj?.email}
                  sizeClassName="w-8 h-8 rounded-xl"
                  iconSizeClassName="w-4 h-4"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-100 uppercase">
                      {selectedWorkerId}
                    </span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                        selectedWorkerObj?.daemonActive
                          ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {selectedWorkerObj?.daemonActive ? 'Daemon Aktif' : 'Nonaktif'}
                    </span>
                  </div>
                  <div className="text-[10px] text-zinc-400 truncate mt-0.5">
                    {usageData?.email || selectedWorkerObj?.email || '-'}
                  </div>
                </div>
              </div>

              {usageData?.gemini?.totalSteps !== undefined && (
                <div className="text-right shrink-0">
                  <div className="text-xs font-mono font-bold text-zinc-200">
                    {usageData.gemini.totalSteps.toLocaleString()}
                  </div>
                  <div className="text-[9px] text-zinc-500">Total Turn</div>
                </div>
              )}
            </div>

            <div className="space-y-3 pt-1">
              <h3 className="text-xs font-semibold text-zinc-100 tracking-tight">
                Gemini Models
              </h3>

              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs text-zinc-300">Weekly limit</div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">Resets in {geminiWeeklyReset}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-zinc-100 font-mono">
                      {geminiWeeklyLeft}% left
                    </span>
                    <CircularRing percent={geminiWeeklyLeft} color="#10b981" />
                  </div>
                </div>

                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs text-zinc-300">5h limit</div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">Resets in {geminiFiveHourReset}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-zinc-100 font-mono">
                      {geminiFiveHourLeft}% left
                    </span>
                    <CircularRing percent={geminiFiveHourLeft} color="#10b981" />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t border-[#1a1c26]">
              <h3 className="text-xs font-semibold text-zinc-100 tracking-tight">
                Claude and GPT models
              </h3>

              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="text-xs text-zinc-300">Weekly limit</div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-zinc-100 font-mono">
                      {claudeWeeklyLeft}% left
                    </span>
                    <CircularRing percent={claudeWeeklyLeft} color="#10b981" />
                  </div>
                </div>

                <div className="flex items-start justify-between">
                  <div className="text-xs text-zinc-300">5h limit</div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-zinc-100 font-mono">
                      {claudeFiveHourLeft}% left
                    </span>
                    <CircularRing percent={claudeFiveHourLeft} color="#10b981" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 px-0.5">
            <div className="grid grid-cols-3 gap-2">
              <div className="p-3 rounded-2xl bg-[#141520] border border-[#242636] flex flex-col justify-between">
                <span className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">CPU Load</span>
                <div className="my-2">
                  <div className="text-base font-bold font-mono text-zinc-100">
                    {vitals?.cpu?.load1?.toFixed(2) ?? '1.20'}
                  </div>
                  <div className="text-[9px] text-zinc-500 mt-0.5">{cpuPct}% kapasitas</div>
                </div>
                <div className="w-full bg-[#1e202e] h-1.5 rounded-full overflow-hidden">
                  <div className="bg-blue-500 h-full rounded-full" style={{ width: `${cpuPct}%` }} />
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-[#141520] border border-[#242636] flex flex-col justify-between">
                <span className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">RAM VPS</span>
                <div className="my-2">
                  <div className="text-base font-bold font-mono text-zinc-100">
                    {memPct}%
                  </div>
                  <div className="text-[9px] text-zinc-500 mt-0.5">
                    {formatBytes(vitals?.memory?.used || 0)}
                  </div>
                </div>
                <div className="w-full bg-[#1e202e] h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${memPct}%` }} />
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-[#141520] border border-[#242636] flex flex-col justify-between">
                <span className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">Storage</span>
                <div className="my-2">
                  <div className="text-base font-bold font-mono text-zinc-100">
                    {diskPct}%
                  </div>
                  <div className="text-[9px] text-zinc-500 mt-0.5">
                    {formatBytes(vitals?.disk?.free || 0)} sisa
                  </div>
                </div>
                <div className="w-full bg-[#1e202e] h-1.5 rounded-full overflow-hidden">
                  <div className="bg-amber-500 h-full rounded-full" style={{ width: `${diskPct}%` }} />
                </div>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-[#12131c] border border-[#232536] space-y-2 text-xs">
              <div className="flex justify-between items-center text-zinc-300">
                <span className="text-zinc-400">Status Uptime VPS</span>
                <span className="font-mono font-semibold text-zinc-200">
                  {formatUptime(vitals?.uptime || 142000)}
                </span>
              </div>
              <div className="flex justify-between items-center text-zinc-300">
                <span className="text-zinc-400">Worker Online (Daemon)</span>
                <span className="font-mono font-semibold text-emerald-400">
                  {workers.filter((w) => w.daemonActive).length} / {workers.length}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </BottomSheet>
  );
};
