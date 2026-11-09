import React, { useState } from 'react';
import { WorkerCard } from '../Cards/WorkerCard.tsx';
import type { WorkerProfile } from '../../types/telemetry.ts';
import { Search, RefreshCw } from 'lucide-react';

interface WorkersTabProps {
  workers: WorkerProfile[];
  loading: boolean;
  onRefresh: () => void;
  onSelectWorker: (worker: WorkerProfile) => void;
  onLaunchPrompt: (worker: WorkerProfile) => void;
  onOpenUsage?: () => void;
  onOpenAccount?: () => void;
}

export const WorkersTab: React.FC<WorkersTabProps> = ({
  workers,
  loading,
  onRefresh,
  onSelectWorker,
  onLaunchPrompt,
  onOpenUsage,
  onOpenAccount
}) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'idle' | 'off'>('all');

  const filtered = workers.filter((w) => {
    const matchesSearch =
      w.id.toLowerCase().includes(search.toLowerCase()) ||
      (w.name && w.name.toLowerCase().includes(search.toLowerCase())) ||
      (w.email && w.email.toLowerCase().includes(search.toLowerCase())) ||
      (w.hostname && w.hostname.toLowerCase().includes(search.toLowerCase()));

    if (!matchesSearch) return false;

    if (filter === 'active') return w.status === 'running' || !!w.activeSession;
    if (filter === 'idle') return w.authenticated && w.status !== 'running';
    if (filter === 'off') return !w.authenticated;
    return true;
  });

  return (
    <div className="space-y-3.5 pb-6">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#14151e] border border-[#262836] text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-blue-500 shadow-inner"
          />
        </div>

        <button
          onClick={onRefresh}
          className="btn-deep p-2 rounded-xl text-zinc-300 hover:text-white shrink-0"
          title="Segarkan"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
        {[
          { id: 'all', label: 'Semua' },
          { id: 'idle', label: 'Online' },
          { id: 'active', label: 'Prompting' },
          { id: 'off', label: 'Offline' }
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setFilter(item.id as any)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
              filter === item.id
                ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                : 'bg-[#151620] text-zinc-400 border-[#262836] hover:bg-[#1d1f2c]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center py-10 text-zinc-400 text-xs border-[#252736] bg-[#14151e] rounded-2xl shadow-xl">
          Kosong
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.map((worker) => (
            <WorkerCard
              key={worker.id}
              worker={worker}
              onSelect={onSelectWorker}
              onLaunchPrompt={onLaunchPrompt}
              onOpenUsage={onOpenUsage}
              onOpenAccount={onOpenAccount}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
};
