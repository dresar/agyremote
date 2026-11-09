import React, { useState } from 'react';
import { BottomSheet } from './BottomSheet.tsx';
import { GoogleAvatar } from '../Common/GoogleAvatar.tsx';
import type { WorkerProfile } from '../../types/telemetry.ts';
import {
  startWorkerLogin,
  submitWorkerAuthCode,
  logoutWorker
} from '../../services/api.ts';
import {
  Bot,
  LogIn,
  LogOut,
  ExternalLink,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface AccountSheetProps {
  isOpen: boolean;
  onClose: () => void;
  workers: WorkerProfile[];
  onWorkerUpdated: () => void;
}

export const AccountSheet: React.FC<AccountSheetProps> = ({
  isOpen,
  onClose,
  workers,
  onWorkerUpdated
}) => {
  const [expandedWorkerId, setExpandedWorkerId] = useState<string | null>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [authCode, setAuthCode] = useState('');
  const [activeWorkerId, setActiveWorkerId] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleStartLogin = async (id: string) => {
    setLoadingAction(`login_${id}`);
    setErrorMsg(null);
    setSuccessMsg(null);
    setActiveWorkerId(id);
    setAuthUrl(null);
    setAuthCode('');

    try {
      const res = await startWorkerLogin(id);
      if (res.success && res.authUrl) {
        setAuthUrl(res.authUrl);
        setExpandedWorkerId(id);
      } else {
        setErrorMsg('Gagal mendapatkan URL otorisasi Google');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memulai login Google');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSubmitCode = async (id: string) => {
    if (!authCode.trim()) return;
    setLoadingAction(`submit_${id}`);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await submitWorkerAuthCode(id, authCode.trim());
      if (res.success) {
        setSuccessMsg(`Otorisasi ${id.toUpperCase()} berhasil`);
        setAuthUrl(null);
        setAuthCode('');
        setExpandedWorkerId(null);
        onWorkerUpdated();
      } else {
        setErrorMsg('Verifikasi kode otorisasi gagal');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Kode otorisasi tidak valid');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleLogout = async (id: string) => {
    if (!window.confirm(`Yakin ingin logout ${id.toUpperCase()}?`)) return;
    setLoadingAction(`logout_${id}`);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await logoutWorker(id);
      if (res.success) {
        setSuccessMsg(`Sesi ${id.toUpperCase()} diputuskan`);
        onWorkerUpdated();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal logout');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sortedWorkers = [...workers].sort((a, b) => a.id.localeCompare(b.id));

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Kelola Akun Google (15 Worker)">
      <div className="space-y-3">
        {successMsg && (
          <div className="p-2.5 rounded-md bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-2.5 rounded-md bg-rose-950/60 border border-rose-800 text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="divide-y divide-[#20222a] rounded-lg border border-[#272832] bg-[#121318] overflow-hidden">
          {sortedWorkers.map((worker) => {
            const isExpanded = expandedWorkerId === worker.id;
            const isCurrentLoggingIn = activeWorkerId === worker.id && !!authUrl;

            return (
              <div key={worker.id} className="p-3 hover:bg-[#15161c] transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <GoogleAvatar
                      picture={worker.picture}
                      id={worker.id}
                      email={worker.email}
                      sizeClassName="w-8 h-8 rounded-full"
                      iconSizeClassName="w-4 h-4 text-blue-400"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-bold text-zinc-100 uppercase">
                          {worker.id}
                        </span>
                        <span
                          className={`text-[9px] font-semibold px-1.5 py-0.2 rounded border ${
                            worker.authenticated
                              ? 'bg-emerald-950/70 text-emerald-400 border-emerald-800'
                              : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                          }`}
                        >
                          {worker.authenticated ? 'Connected' : 'Disconnected'}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-400 truncate font-mono">
                        {worker.email || 'Belum ditautkan'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {worker.authenticated ? (
                      <button
                        onClick={() => handleLogout(worker.id)}
                        disabled={loadingAction === `logout_${worker.id}`}
                        className="btn-deep-danger px-2.5 py-1 text-[11px] font-medium"
                      >
                        {loadingAction === `logout_${worker.id}` ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <>
                            <LogOut className="w-3 h-3" />
                            <span>Logout</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleStartLogin(worker.id)}
                        disabled={loadingAction === `login_${worker.id}`}
                        className="btn-deep-primary px-2.5 py-1 text-[11px] font-medium"
                      >
                        {loadingAction === `login_${worker.id}` ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <>
                            <LogIn className="w-3 h-3" />
                            <span>Login</span>
                          </>
                        )}
                      </button>
                    )}

                    <button
                      onClick={() =>
                        setExpandedWorkerId(isExpanded ? null : worker.id)
                      }
                      className="p-1 rounded text-zinc-400 hover:text-zinc-200"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-3 pt-2.5 border-t border-[#20222a] space-y-2 text-xs">
                    <div className="flex justify-between text-zinc-400 font-mono text-[11px]">
                      <span>Host:</span>
                      <span className="text-zinc-200">{worker.hostname || worker.name}</span>
                    </div>

                    {isCurrentLoggingIn && (
                      <div className="p-3 rounded-lg bg-[#181920] border border-[#2c2d3a] space-y-2 mt-2">
                        <div className="font-semibold text-zinc-200 text-xs">
                          Otorisasi Google OAuth
                        </div>
                        <p className="text-[11px] text-zinc-400 leading-relaxed">
                          Buka Google login di bawah, berikan izin, lalu masukkan kode otorisasi:
                        </p>
                        <div className="flex gap-2">
                          <a
                            href={authUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-deep-primary flex-1 py-1.5 text-xs font-semibold"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Buka Link Google
                          </a>
                          <button
                            onClick={() => handleCopy(authUrl)}
                            className="btn-deep px-3 text-xs"
                          >
                            {copied ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-zinc-300" />
                            )}
                          </button>
                        </div>
                        <div className="space-y-1 pt-1">
                          <input
                            type="text"
                            value={authCode}
                            onChange={(e) => setAuthCode(e.target.value)}
                            placeholder="Tempel authorization code..."
                            className="w-full p-2 rounded-md bg-[#121318] border border-[#272832] text-xs text-zinc-100 font-mono focus:outline-none focus:border-blue-500"
                          />
                          <button
                            onClick={() => handleSubmitCode(worker.id)}
                            disabled={
                              loadingAction === `submit_${worker.id}` ||
                              !authCode.trim()
                            }
                            className="w-full btn-deep-primary py-1.5 text-xs font-semibold disabled:opacity-40"
                          >
                            {loadingAction === `submit_${worker.id}` ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              'Verifikasi & Simpan Token'
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </BottomSheet>
  );
};
