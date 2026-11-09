import React from 'react';
import { Cpu, HardDrive, MemoryStick, Clock } from 'lucide-react';
import type { SystemVitals } from '../../types/telemetry.ts';

interface SystemVitalsCardProps {
  vitals: SystemVitals | null;
  loading: boolean;
}

export const SystemVitalsCard: React.FC<SystemVitalsCardProps> = ({ vitals, loading }) => {
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

  if (loading && !vitals) {
    return (
      <div className="card p-4 rounded-2xl border-[#252736] bg-gradient-to-b from-[#181924] to-[#12131b] shadow-xl animate-pulse space-y-3">
        <div className="h-3.5 bg-[#252838] rounded-xl w-1/3" />
        <div className="grid grid-cols-3 gap-2">
          <div className="h-16 bg-[#202230] rounded-xl" />
          <div className="h-16 bg-[#202230] rounded-xl" />
          <div className="h-16 bg-[#202230] rounded-xl" />
        </div>
      </div>
    );
  }

  if (!vitals) {
    return (
      <div className="card p-4 rounded-2xl text-center py-6 border-[#252736] bg-gradient-to-b from-[#181924] to-[#12131b] shadow-xl">
        <p className="text-xs text-zinc-400">Data vitals belum tersedia</p>
      </div>
    );
  }

  const cpuLoad = typeof vitals.cpu?.load1 === 'number' ? vitals.cpu.load1.toFixed(1) : '0.0';
  const memPercent = typeof vitals.memory?.percent === 'number' ? vitals.memory.percent.toFixed(0) : '0';
  const diskPercent = typeof vitals.disk?.percent === 'number' ? vitals.disk.percent.toFixed(0) : '0';

  return (
    <div className="card p-4 rounded-2xl space-y-3 border-[#252736] bg-gradient-to-b from-[#181924] to-[#12131b] shadow-xl">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Status Resource VPS
        </span>
        <div className="flex items-center gap-1.5 text-xs text-zinc-300 bg-[#1e202c] px-2.5 py-0.5 rounded-full border border-[#2d3042]">
          <Clock className="w-3 h-3 text-zinc-400" />
          <span>{formatUptime(vitals.uptime || 0)}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <div className="p-3 rounded-xl bg-[#12131b] border border-[#232535] flex flex-col justify-between">
          <div className="flex items-center gap-1 text-zinc-400 mb-1">
            <Cpu className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[11px] font-medium">CPU</span>
          </div>
          <div>
            <div className="text-sm font-bold text-zinc-100">{cpuLoad} load</div>
            <div className="text-[10px] text-zinc-400">{vitals.cpu?.cores || 2} vCPU</div>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-[#12131b] border border-[#232535] flex flex-col justify-between">
          <div className="flex items-center gap-1 text-zinc-400 mb-1">
            <MemoryStick className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-[11px] font-medium">RAM</span>
          </div>
          <div>
            <div className="text-sm font-bold text-zinc-100">{memPercent}%</div>
            <div className="text-[10px] text-zinc-400">{formatBytes(vitals.memory?.used || 0)}</div>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-[#12131b] border border-[#232535] flex flex-col justify-between">
          <div className="flex items-center gap-1 text-zinc-400 mb-1">
            <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] font-medium">Disk</span>
          </div>
          <div>
            <div className="text-sm font-bold text-zinc-100">{diskPercent}%</div>
            <div className="text-[10px] text-zinc-400">{formatBytes(vitals.disk?.free || 0)} sisa</div>
          </div>
        </div>
      </div>
    </div>
  );
};
