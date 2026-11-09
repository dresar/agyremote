import React, { useState, useEffect } from 'react';
import { fetchWorkerTranscripts } from '../../services/api.ts';
import type { WorkerProfile, TranscriptItem } from '../../types/telemetry.ts';
import { Clock, Loader2, RefreshCw } from 'lucide-react';

interface TranscriptsTabProps {
  workers: WorkerProfile[];
}

export const TranscriptsTab: React.FC<TranscriptsTabProps> = ({ workers }) => {
  const activeWorkers = workers.filter((w) => w.authenticated);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>(
    activeWorkers[0]?.id || 'agy01'
  );
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeWorkers.length > 0 && !activeWorkers.some((w) => w.id === selectedWorkerId)) {
      setSelectedWorkerId(activeWorkers[0].id);
    }
  }, [activeWorkers, selectedWorkerId]);

  const loadTranscripts = () => {
    if (!selectedWorkerId) return;
    setLoading(true);
    fetchWorkerTranscripts(selectedWorkerId)
      .then((items) => setTranscripts(items))
      .catch(() => setTranscripts([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTranscripts();
  }, [selectedWorkerId]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-zinc-100 font-mono">Log Sesi Transkrip</h2>
        <button
          onClick={loadTranscripts}
          className="btn-deep p-1.5 text-zinc-300"
          title="Segarkan"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
        {workers.map((w) => {
          const isSelected = selectedWorkerId === w.id;
          return (
            <button
              key={w.id}
              onClick={() => setSelectedWorkerId(w.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-mono font-medium whitespace-nowrap transition-colors uppercase border ${
                isSelected
                  ? 'bg-zinc-800 text-blue-400 border-zinc-700 font-bold shadow-sm'
                  : 'bg-[#121318] border-[#272832] text-zinc-400 hover:bg-[#1a1b22]'
              }`}
            >
              {w.id}
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-zinc-500 gap-1.5 text-xs">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />
            Memuat transkrip...
          </div>
        ) : transcripts.length === 0 ? (
          <div className="card text-center py-8 text-zinc-500 text-xs border-[#272832] bg-[#16171d]">
            Tidak ada riwayat untuk {selectedWorkerId.toUpperCase()}
          </div>
        ) : (
          transcripts.map((t) => (
            <div
              key={t.conversation_id}
              className="card p-3 space-y-2 border-[#272832] bg-[#16171d]"
            >
              <div className="flex items-center justify-between text-[10px] text-zinc-400 pb-1.5 border-b border-[#20222a] font-mono">
                <span className="text-zinc-200 font-semibold">
                  {t.conversation_id.slice(0, 8)}
                </span>
                <span className="flex items-center gap-1 text-zinc-400">
                  <Clock className="w-2.5 h-2.5" />
                  {new Date(t.last_updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <div>
                <div className="text-[10px] uppercase font-bold text-zinc-400 font-mono mb-0.5">
                  Prompt
                </div>
                <div className="text-xs text-zinc-200 font-medium line-clamp-2">
                  {t.first_prompt}
                </div>
              </div>

              {t.last_response && (
                <div>
                  <div className="text-[10px] uppercase font-bold text-zinc-400 font-mono mb-0.5">
                    Respon Terakhir
                  </div>
                  <div className="text-xs text-zinc-300 line-clamp-3 bg-[#121318] p-2.5 rounded-lg border border-[#272832] font-mono leading-relaxed">
                    {t.last_response}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
