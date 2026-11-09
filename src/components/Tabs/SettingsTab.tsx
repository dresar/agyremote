import React, { useState, useEffect } from 'react';
import {
  getAuthToken,
  setAuthToken,
  fetchAntigravityVersion,
  triggerAntigravityUpdate,
  fetchAntigravityChangelog,
  stopWorkerDaemon,
  startWorkerDaemon
} from '../../services/api.ts';
import type { WorkerProfile } from '../../types/telemetry.ts';
import { PromptEnhancerSettings } from '../Settings/PromptEnhancerSettings.tsx';
import {
  Key,
  Globe,
  Check,
  RefreshCw,
  Power,
  ChevronDown,
  ChevronUp,
  FileText,
  Zap,
  Terminal,
  Layers,
  LogOut
} from 'lucide-react';

interface SettingsTabProps {
  workers?: WorkerProfile[];
  onRefreshWorkers?: () => void;
  onOpenSkillManager?: () => void;
  onLogout?: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  workers = [],
  onRefreshWorkers,
  onOpenSkillManager,
  onLogout
}) => {
  const [tokenInput, setTokenInput] = useState(getAuthToken());
  const [saved, setSaved] = useState(false);

  const [agyVersion, setAgyVersion] = useState<string>('Memeriksa...');
  const [agyBinPath, setAgyBinPath] = useState<string>('');
  const [isUpdatingAgy, setIsUpdatingAgy] = useState(false);
  const [updateOutput, setUpdateOutput] = useState<string | null>(null);

  const [showChangelog, setShowChangelog] = useState(false);
  const [changelogText, setChangelogText] = useState<string | null>(null);
  const [loadingChangelog, setLoadingChangelog] = useState(false);

  const [isPowerManaging, setIsPowerManaging] = useState(false);
  const [powerMsg, setPowerMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchAntigravityVersion()
      .then((res) => {
        setAgyVersion(res.version || '1.4.9');
        setAgyBinPath(res.binPath || '/opt/data/home/.local/bin/agy');
      })
      .catch(() => {
        setAgyVersion('1.4.9');
      });
  }, []);

  const handleSaveToken = () => {
    setAuthToken(tokenInput.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleUpdateAntigravity = async () => {
    setIsUpdatingAgy(true);
    setUpdateOutput(null);
    try {
      const res = await triggerAntigravityUpdate();
      setUpdateOutput(res.output || 'Pemeriksaan pembaruan selesai');
      if (res.version) {
        setAgyVersion(res.version);
      }
    } catch (err: any) {
      setUpdateOutput(`Gagal perbarui: ${err.message || 'Error jaringan'}`);
    } finally {
      setIsUpdatingAgy(false);
    }
  };

  const handleToggleChangelog = async () => {
    if (showChangelog) {
      setShowChangelog(false);
      return;
    }
    setShowChangelog(true);
    if (!changelogText) {
      setLoadingChangelog(true);
      try {
        const res = await fetchAntigravityChangelog();
        setChangelogText(res.changelog || 'Catatan rilis tidak tersedia.');
      } catch {
        setChangelogText('Gagal memuat catatan rilis.');
      } finally {
        setLoadingChangelog(false);
      }
    }
  };

  const handleStopAllExceptActive = async () => {
    setIsPowerManaging(true);
    setPowerMsg(null);
    try {
      const targets = workers.filter(
        (w) => w.id !== 'agy10' && (w.daemonActive || w.status === 'running')
      );
      for (const w of targets) {
        await stopWorkerDaemon(w.id).catch(() => null);
      }
      onRefreshWorkers?.();
      setPowerMsg('Semua worker lain berhasil dimatikan. Hanya AGY10 yang aktif.');
      setTimeout(() => setPowerMsg(null), 4000);
    } finally {
      setIsPowerManaging(false);
    }
  };

  const handleStartActiveWorker = async () => {
    setIsPowerManaging(true);
    setPowerMsg(null);
    try {
      await startWorkerDaemon('agy10').catch(() => null);
      onRefreshWorkers?.();
      setPowerMsg('Worker AGY10 berhasil dihidupkan.');
      setTimeout(() => setPowerMsg(null), 4000);
    } finally {
      setIsPowerManaging(false);
    }
  };

  const handleStartAllWorkers = async () => {
    setIsPowerManaging(true);
    setPowerMsg(null);
    try {
      const targets = workers.filter((w) => w.authenticated && !w.daemonActive);
      for (const w of targets) {
        await startWorkerDaemon(w.id).catch(() => null);
      }
      onRefreshWorkers?.();
      setPowerMsg('Semua worker terotentikasi berhasil dihidupkan.');
      setTimeout(() => setPowerMsg(null), 4000);
    } finally {
      setIsPowerManaging(false);
    }
  };

  const activeDaemonsCount = workers.filter((w) => w.daemonActive).length;

  return (
    <div className="space-y-3 pb-8 select-none">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold text-zinc-300 uppercase tracking-wider font-mono">
          Pengaturan
        </h2>
        <span className="text-[11px] font-mono text-zinc-400">
          Daemon: <strong className="text-emerald-400">{activeDaemonsCount}</strong>/{workers.length}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="md:col-span-2">
          <PromptEnhancerSettings />
        </div>

        <div className="card p-3 space-y-2.5 border-[#242636] bg-[#141520] rounded-2xl shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
                <Zap className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-zinc-100 font-mono">Antigravity CLI</h3>
            </div>

            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-blue-950/80 text-blue-300 border border-blue-800">
              v{agyVersion}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-0.5">
            <button
              type="button"
              onClick={handleUpdateAntigravity}
              disabled={isUpdatingAgy}
              className="btn-deep-primary py-1.5 px-3 text-xs font-mono font-medium rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isUpdatingAgy ? 'animate-spin' : ''}`} />
              <span>{isUpdatingAgy ? 'Update...' : 'Perbarui'}</span>
            </button>

            <button
              type="button"
              onClick={handleToggleChangelog}
              className="btn-deep py-1.5 px-3 text-xs font-mono font-medium text-zinc-300 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-zinc-400" />
              <span>Changelog</span>
              {showChangelog ? (
                <ChevronUp className="w-3 h-3 text-zinc-400" />
              ) : (
                <ChevronDown className="w-3 h-3 text-zinc-400" />
              )}
            </button>
          </div>

          {updateOutput && (
            <div className="p-2.5 rounded-xl bg-[#0a0b10] border border-[#222432] text-[11px] font-mono text-zinc-300 whitespace-pre-wrap leading-relaxed">
              <div className="flex items-center gap-1.5 text-emerald-400 mb-1 font-semibold">
                <Terminal className="w-3 h-3" />
                <span>Output:</span>
              </div>
              {updateOutput}
            </div>
          )}

          {showChangelog && (
            <div className="p-2.5 rounded-xl bg-[#0a0b10] border border-[#222432] text-[10px] font-mono text-zinc-300 max-h-48 overflow-y-auto leading-relaxed">
              {loadingChangelog ? (
                <div className="py-2 text-center text-zinc-500">Memuat...</div>
              ) : (
                <pre className="whitespace-pre-wrap font-sans text-[11px] text-zinc-300">
                  {changelogText}
                </pre>
              )}
            </div>
          )}
        </div>

        <div className="card p-3 space-y-2.5 border-[#242636] bg-[#141520] rounded-2xl shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-zinc-100 font-mono">Manajemen Skill</h3>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-purple-950/80 text-purple-300 border border-purple-800">
              15 Worker
            </span>
          </div>

          <div className="space-y-1.5 pt-0.5">
            <button
              type="button"
              onClick={onOpenSkillManager}
              className="w-full btn-deep-primary py-1.5 px-3 text-xs font-mono font-medium rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Kelola Skill</span>
            </button>
            <div className="flex justify-between items-center p-1.5 px-2 rounded-lg bg-[#0a0b10] border border-[#222432] text-[11px] font-mono">
              <span className="text-zinc-500">Metode</span>
              <span className="text-zinc-200">NPX • Git • Buat • Unggah</span>
            </div>
          </div>
        </div>

        <div className="card p-3 space-y-2.5 border-[#242636] bg-[#141520] rounded-2xl shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                <Power className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-zinc-100 font-mono">Kontrol Daya</h3>
            </div>
          </div>

          {powerMsg && (
            <div className="p-1.5 px-2.5 rounded-xl bg-emerald-950/60 border border-emerald-800 text-[11px] font-mono text-emerald-300 flex items-center gap-1.5">
              <Check className="w-3 h-3 shrink-0" />
              <span>{powerMsg}</span>
            </div>
          )}

          <div className="space-y-1.5 pt-0.5">
            <button
              type="button"
              onClick={handleStopAllExceptActive}
              disabled={isPowerManaging}
              className="w-full btn-deep py-1.5 px-3 text-xs font-mono font-medium text-rose-300 hover:text-rose-200 border-rose-900/50 bg-rose-950/30 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Power className="w-3.5 h-3.5 text-rose-400" />
              <span>Matikan Selain AGY10</span>
            </button>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={handleStartActiveWorker}
                disabled={isPowerManaging}
                className="btn-deep py-1.5 px-2 text-xs font-mono font-medium text-emerald-300 hover:text-emerald-200 border-emerald-900/50 bg-emerald-950/30 rounded-xl flex items-center justify-center gap-1 cursor-pointer"
              >
                <Power className="w-3 h-3 text-emerald-400" />
                <span>Mulai AGY10</span>
              </button>

              <button
                type="button"
                onClick={handleStartAllWorkers}
                disabled={isPowerManaging}
                className="btn-deep py-1.5 px-2 text-xs font-mono font-medium text-zinc-300 hover:text-zinc-100 border-[#222432] bg-[#161724] rounded-xl flex items-center justify-center gap-1 cursor-pointer"
              >
                <Power className="w-3 h-3 text-blue-400" />
                <span>Mulai Semua</span>
              </button>
            </div>
          </div>
        </div>

        <div className="card p-3 space-y-2 border-[#242636] bg-[#141520] rounded-2xl shadow-xl">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-600/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <Key className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-zinc-100 font-mono">Token API</h3>
          </div>

          <div className="space-y-1.5 pt-0.5">
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Bearer token..."
              className="w-full p-2 rounded-xl bg-[#0a0b10] border border-[#222432] text-xs text-zinc-100 font-mono focus:outline-none focus:border-blue-500"
            />
            <button
              type="button"
              onClick={handleSaveToken}
              className="w-full btn-deep-primary py-1.5 text-xs font-mono font-medium rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {saved ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Tersimpan</span>
                </>
              ) : (
                'Simpan'
              )}
            </button>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="w-full py-1.5 text-xs font-mono font-medium rounded-xl flex items-center justify-center gap-1.5 text-red-400 bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Keluar</span>
              </button>
            )}
          </div>
        </div>

        <div className="card p-3 space-y-2 border-[#242636] bg-[#141520] rounded-2xl shadow-xl">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
              <Globe className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-zinc-100 font-mono">Jaringan</h3>
          </div>

          <div className="space-y-1 text-xs font-mono pt-0.5">
            <div className="flex justify-between items-center p-1.5 px-2 rounded-lg bg-[#0a0b10] border border-[#222432]">
              <span className="text-zinc-500">Domain</span>
              <span className="text-zinc-200 font-medium">remote.agentai.my.id</span>
            </div>
            <div className="flex justify-between items-center p-1.5 px-2 rounded-lg bg-[#0a0b10] border border-[#222432]">
              <span className="text-zinc-500">Port</span>
              <span className="text-zinc-200 font-medium">8787</span>
            </div>
            <div className="flex justify-between items-center p-1.5 px-2 rounded-lg bg-[#0a0b10] border border-[#222432]">
              <span className="text-zinc-500">Protokol</span>
              <span className="text-zinc-200 font-medium">HTTP/2 SSE</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
