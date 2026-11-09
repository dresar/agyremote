import React, { useState, useEffect, useMemo } from 'react';
import { fetchWorkerTranscripts, fetchProcesses } from '../../services/api.ts';
import { ProcessCard } from '../Cards/ProcessCard.tsx';
import { ProcessDetailSheet } from '../Sheets/ProcessDetailSheet.tsx';
import type { WorkerProfile, TranscriptItem, ProcessItem } from '../../types/telemetry.ts';
import {
  Clock,
  Loader2,
  RefreshCw,
  MessageSquare,
  Terminal,
  Search,
  Sparkles,
  ArrowRight
} from 'lucide-react';

interface LogsTabProps {
  workers: WorkerProfile[];
  onOpenConversation: (worker: WorkerProfile, initialPrompt?: string) => void;
}

export const LogsTab: React.FC<LogsTabProps> = ({ workers, onOpenConversation }) => {
  const [activeSubTab, setActiveSubTab] = useState<'transcripts' | 'console'>('transcripts');

  const activeWorkers = workers.filter((w) => w.authenticated);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>(
    activeWorkers[0]?.id || workers[0]?.id || 'agy01'
  );
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [loadingTranscripts, setLoadingTranscripts] = useState(false);

  const [processes, setProcesses] = useState<ProcessItem[]>([]);
  const [loadingProcesses, setLoadingProcesses] = useState(false);
  const [searchProc, setSearchProc] = useState('');
  const [sortBy, setSortBy] = useState<'cpu' | 'mem' | 'pid'>('cpu');
  const [selectedProcess, setSelectedProcess] = useState<ProcessItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const selectedWorkerObj = workers.find((w) => w.id === selectedWorkerId) || workers[0];

  useEffect(() => {
    if (activeWorkers.length > 0 && !activeWorkers.some((w) => w.id === selectedWorkerId)) {
      setSelectedWorkerId(activeWorkers[0].id);
    }
  }, [activeWorkers, selectedWorkerId]);

  const loadTranscripts = () => {
    if (!selectedWorkerId) return;
    setLoadingTranscripts(true);
    fetchWorkerTranscripts(selectedWorkerId)
      .then((items) => setTranscripts(items))
      .catch(() => setTranscripts([]))
      .finally(() => setLoadingTranscripts(false));
  };

  const loadProcesses = () => {
    setLoadingProcesses(true);
    fetchProcesses()
      .then((items) => setProcesses(items))
      .catch(() => setProcesses([]))
      .finally(() => setLoadingProcesses(false));
  };

  useEffect(() => {
    if (activeSubTab === 'transcripts') {
      loadTranscripts();
    } else {
      loadProcesses();
    }
  }, [selectedWorkerId, activeSubTab]);

  const filteredProcesses = useMemo(() => {
    return processes
      .filter((p) => {
        const query = searchProc.toLowerCase();
        return (
          p.command.toLowerCase().includes(query) ||
          p.user.toLowerCase().includes(query) ||
          p.pid.toString().includes(query)
        );
      })
      .sort((a, b) => {
        if (sortBy === 'cpu') return b.cpu - a.cpu;
        if (sortBy === 'mem') return b.mem - a.mem;
        return b.pid - a.pid;
      });
  }, [processes, searchProc, sortBy]);

  return (
    <div className="space-y-3.5 pb-6">
      <div className="flex items-center justify-between pb-1 border-b border-[#1f212d]">
        <div className="flex p-0.5 rounded-xl bg-[#14151e] border border-[#262835]">
          <button
            onClick={() => setActiveSubTab('transcripts')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeSubTab === 'transcripts'
                ? 'bg-[#222434] text-white shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
            <span>Log Aktivitas Chat</span>
          </button>
          <button
            onClick={() => setActiveSubTab('console')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeSubTab === 'console'
                ? 'bg-[#222434] text-white shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-purple-400" />
            <span>Proses Konsol</span>
          </button>
        </div>

        <button
          onClick={activeSubTab === 'transcripts' ? loadTranscripts : loadProcesses}
          className="btn-deep p-2 rounded-xl text-zinc-300 hover:text-white"
          title="Segarkan"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${
              loadingTranscripts || loadingProcesses ? 'animate-spin' : ''
            }`}
          />
        </button>
      </div>

      {activeSubTab === 'transcripts' ? (
        <div className="space-y-3">
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            {workers.map((w) => {
              const isSelected = selectedWorkerId === w.id;
              return (
                <button
                  key={w.id}
                  onClick={() => setSelectedWorkerId(w.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors uppercase border ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                      : 'bg-[#151620] border-[#262836] text-zinc-400 hover:bg-[#1d1f2c]'
                  }`}
                >
                  {w.id}
                </button>
              );
            })}
          </div>

          <div className="space-y-2.5">
            {loadingTranscripts && transcripts.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-zinc-500 gap-2 text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                Memuat riwayat sesi...
              </div>
            ) : transcripts.length === 0 ? (
              <div className="card text-center py-12 text-zinc-400 text-xs border-[#252736] bg-[#14151e] rounded-2xl shadow-xl space-y-2">
                <p>Belum ada riwayat sesi transkrip untuk {selectedWorkerId.toUpperCase()}</p>
                {selectedWorkerObj && selectedWorkerObj.authenticated && (
                  <button
                    onClick={() => onOpenConversation(selectedWorkerObj)}
                    className="btn-deep-primary px-3 py-1 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Mulai Chat Pertama</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {transcripts.map((t) => (
                  <div
                    key={t.conversation_id}
                    onClick={() => selectedWorkerObj && onOpenConversation(selectedWorkerObj, t.first_prompt)}
                    className="card p-4 space-y-2.5 border-[#252736] bg-gradient-to-b from-[#181924] to-[#12131b] hover:border-[#3b3f55] rounded-2xl shadow-xl transition-all cursor-pointer"
                  >
                    <div className="flex items-center justify-between text-xs text-zinc-400 pb-2 border-b border-[#1f212e]">
                      <span className="font-semibold text-zinc-200 uppercase tracking-tight">
                        Sesi #{t.conversation_id.slice(0, 8)}
                      </span>
                      <span className="flex items-center gap-1.5 text-zinc-400 text-[11px]">
                        <Clock className="w-3 h-3" />
                        {new Date(t.last_updated_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>

                    <div>
                      <div className="text-[10px] uppercase font-semibold text-zinc-400 mb-1">
                        Prompt Awal
                      </div>
                      <div className="text-xs text-zinc-100 font-medium line-clamp-2">
                        {t.first_prompt}
                      </div>
                    </div>

                    {t.last_response && (
                      <div className="text-xs text-zinc-300 line-clamp-2 bg-[#12131b] p-2.5 rounded-xl border border-[#232535] leading-relaxed">
                        {t.last_response}
                      </div>
                    )}

                    <div className="pt-1 flex items-center justify-between text-blue-400 text-xs font-medium">
                      <span>{t.turn_count || 1} percakapan</span>
                      <span className="flex items-center gap-1 hover:underline">
                        <span>Lanjutkan Chat</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchProc}
              onChange={(e) => setSearchProc(e.target.value)}
              placeholder="Cari proses, user, atau command..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#14151e] border border-[#262836] text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-blue-500 shadow-inner"
            />
          </div>

          <div className="flex items-center justify-between px-1">
            <div className="flex gap-1.5">
              {(['cpu', 'mem', 'pid'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setSortBy(mode)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium uppercase transition-colors border ${
                    sortBy === mode
                      ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                      : 'bg-[#151620] border-[#262836] text-zinc-400 hover:bg-[#1d1f2c]'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            <span className="text-xs text-zinc-400">{filteredProcesses.length} proses</span>
          </div>

          <div className="space-y-2">
            {loadingProcesses && processes.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-zinc-500 gap-2 text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                Memuat proses sistem...
              </div>
            ) : filteredProcesses.length === 0 ? (
              <div className="card text-center py-10 rounded-2xl bg-[#14151e] border border-[#252736] text-zinc-400 text-xs shadow-xl">
                Tidak ada proses yang ditemukan
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {filteredProcesses.map((p) => (
                  <ProcessCard
                    key={p.pid}
                    process={p}
                    onSelect={(proc) => {
                      setSelectedProcess(proc);
                      setIsDetailOpen(true);
                    }}
                    onKill={(proc) => {
                      setSelectedProcess(proc);
                      setIsDetailOpen(true);
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          <ProcessDetailSheet
            process={selectedProcess}
            isOpen={isDetailOpen}
            onClose={() => setIsDetailOpen(false)}
            onTerminated={(pid) => {
              setProcesses((prev) => prev.filter((p) => p.pid !== pid));
            }}
          />
        </div>
      )}
    </div>
  );
};
