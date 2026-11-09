import React, { useState, useEffect } from 'react';
import { GoogleAvatar } from '../Common/GoogleAvatar.tsx';
import type { WorkerProfile, WorkerWorkspaceData, WorkspaceFolder, ConversationItem } from '../../types/telemetry.ts';
import { fetchWorkerConversations, createQuickFolderApi, startWorkerDaemon, stopWorkerDaemon } from '../../services/api.ts';
import {
  Folder,
  FolderPlus,
  MessageSquare,
  Search,
  ChevronDown,
  ChevronRight,
  Bot,
  Power,
  RefreshCw,
  Sparkles,
  ArrowRight,
  FolderGit2,
  Clock,
  Layers,
  FileCode2,
  X
} from 'lucide-react';

interface WorkerWorkspacePageProps {
  worker: WorkerProfile;
  workers?: WorkerProfile[];
  onSelectWorker?: (worker: WorkerProfile) => void;
  onBack: () => void;
  onSelectConversation: (conv: ConversationItem, folder?: WorkspaceFolder) => void;
  onNewChat: (folder?: WorkspaceFolder) => void;
  onOpenUsage?: () => void;
  onRefreshWorkers?: () => void;
}

export const WorkerWorkspacePage: React.FC<WorkerWorkspacePageProps> = ({
  worker,
  workers,
  onSelectWorker,
  onBack,
  onSelectConversation,
  onNewChat,
  onOpenUsage,
  onRefreshWorkers
}) => {
  const [data, setData] = useState<WorkerWorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolderFilter, setSelectedFolderFilter] = useState('all');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [isQuickFolderModalOpen, setIsQuickFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isTogglingPower, setIsTogglingPower] = useState(false);

  const loadData = () => {
    setLoading(true);
    fetchWorkerConversations(worker.id)
      .then((res) => {
        setData(res);
        const initialExpanded: Record<string, boolean> = {};
        if (res && res.folders) {
          res.folders.forEach((f, idx) => {
            if (f.conversations.length > 0 && idx < 3) {
              initialExpanded[f.path] = true;
            }
          });
        }
        setExpandedFolders(initialExpanded);
      })
      .catch(() => {
        setData(null);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    setSelectedFolderFilter('all');
    loadData();
  }, [worker.id]);

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderPath]: !prev[folderPath]
    }));
  };

  const handleTogglePower = async () => {
    if (isTogglingPower) return;
    setIsTogglingPower(true);
    try {
      if (worker.daemonActive) {
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

  const handleCreateQuickFolder = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isCreatingFolder) return;
    setIsCreatingFolder(true);
    try {
      const rawName = newFolderName.trim();
      const safeSlug = rawName
        ? rawName.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
        : `project-${Date.now().toString(36)}`;
      const res = await createQuickFolderApi(worker.id, safeSlug);
      if (res && res.success) {
        setIsQuickFolderModalOpen(false);
        setNewFolderName('');
        loadData();
        if (res.folder) {
          setExpandedFolders((prev) => ({
            ...prev,
            [res.folder.path]: true
          }));
          setSelectedFolderFilter(res.folder.path);
        }
      }
    } catch {
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    if (!dateStr || dateStr.startsWith('0001')) return '';
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHour = Math.floor(diffMin / 60);
      const diffDay = Math.floor(diffHour / 24);

      if (diffSec < 60) return 'Baru saja';
      if (diffMin < 60) return `${diffMin}m lalu`;
      if (diffHour < 24) return `${diffHour}j lalu`;
      if (diffDay < 7) return `${diffDay}h lalu`;
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const filteredFolders = (data?.folders || []).filter((f) => {
    if (selectedFolderFilter !== 'all' && f.path !== selectedFolderFilter) {
      return false;
    }
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    if (f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q)) return true;
    return f.conversations.some((c) => c.title.toLowerCase().includes(q) || c.preview.toLowerCase().includes(q));
  });

  const filteredNonProject = (data?.nonProjectConversations || []).filter((c) => {
    if (selectedFolderFilter !== 'all') {
      return false;
    }
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return c.title.toLowerCase().includes(q) || c.preview.toLowerCase().includes(q);
  });

  const totalConversationsCount =
    (data?.folders || []).reduce((acc, f) => acc + f.conversations.length, 0) +
    (data?.nonProjectConversations || []).length;

  const sortedWorkers = workers ? [...workers].sort((a, b) => a.id.localeCompare(b.id)) : [];

  return (
    <div className="w-full space-y-3.5 pb-8 select-none">
      {sortedWorkers.length > 0 && (
        <div className="card p-2.5 rounded-2xl border-[#252736] bg-[#141520] shadow-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider shrink-0 pl-1">
              Pilih Worker:
            </span>
            <div className="relative flex-1 min-w-0">
              <select
                value={worker.id}
                onChange={(e) => {
                  const target = sortedWorkers.find((w) => w.id === e.target.value);
                  if (target) onSelectWorker?.(target);
                }}
                className="w-full appearance-none bg-[#1a1b28] hover:bg-[#222436] border border-[#2e3146] text-zinc-100 text-xs font-bold font-mono rounded-xl px-3 py-2 pr-8 cursor-pointer focus:outline-none focus:border-blue-500 transition-colors shadow-inner truncate"
              >
                {sortedWorkers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.id.toUpperCase()} • {w.daemonActive ? '🟢 Online' : '⚪ Offline'} — {w.email || 'Tanpa Akun'}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#1b1d2a] border border-[#262838] text-[11px] font-mono text-zinc-400 shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{sortedWorkers.filter((w) => w.daemonActive).length}/{sortedWorkers.length} Aktif</span>
          </div>
        </div>
      )}

      <div className="card p-4 rounded-2xl border-[#252736] bg-gradient-to-b from-[#181924] to-[#12131b] shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <GoogleAvatar
              picture={worker.picture}
              id={worker.id}
              email={worker.email}
              sizeClassName="w-10 h-10 rounded-2xl"
              iconSizeClassName="w-5 h-5 stroke-[1.9]"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-tight">
                  {worker.id} • Workspace
                </h2>
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    worker.daemonActive
                      ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse'
                      : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.6)]'
                  }`}
                  title={worker.daemonActive ? 'Aktif' : 'Mati'}
                />
              </div>
              <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                {worker.email || worker.hostname || 'Antigravity Profile'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {worker.authenticated && (
              <button
                onClick={handleTogglePower}
                disabled={isTogglingPower}
                className={`p-2 rounded-xl border transition-all cursor-pointer ${
                  worker.daemonActive
                    ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/60 hover:bg-rose-950/40 hover:text-rose-400 hover:border-rose-500/60 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                    : 'bg-rose-950/30 text-rose-400 border-rose-800/60 hover:bg-emerald-950/40 hover:text-emerald-300 hover:border-emerald-500/60 shadow-[0_0_8px_rgba(244,63,94,0.2)]'
                }`}
                title={worker.daemonActive ? 'Matikan daemon worker' : 'Hidupkan daemon worker'}
              >
                <Power className={`w-4 h-4 ${isTogglingPower ? 'animate-spin' : ''}`} />
              </button>
            )}
            <button
              onClick={loadData}
              className="btn-deep p-2 rounded-xl text-zinc-300 hover:text-white"
              title="Segarkan riwayat"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#1f212e]">
          <button
            onClick={() => onNewChat()}
            className="btn-deep-primary py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Chat</span>
          </button>
          <button
            onClick={() => setIsQuickFolderModalOpen(true)}
            className="btn-deep py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 text-zinc-200 hover:text-white cursor-pointer"
          >
            <Folder className="w-3.5 h-3.5 text-blue-400" />
            <span>Folder</span>
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <select
              value={selectedFolderFilter}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedFolderFilter(val);
                if (val !== 'all') {
                  setExpandedFolders({ [val]: true });
                }
              }}
              className="w-full appearance-none bg-[#141520] hover:bg-[#1a1b2a] border border-[#27293a] rounded-xl px-3 py-2 pr-8 text-xs font-semibold text-zinc-200 cursor-pointer focus:outline-none focus:border-blue-500 shadow-inner"
            >
              <option value="all">Semua ({data?.folders?.length || 0})</option>
              {data?.folders?.map((f) => (
                <option key={f.path} value={f.path}>
                  {f.name} ({f.conversations.length})
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Cari dari ${totalConversationsCount} percakapan atau folder...`}
            className="w-full bg-[#13141c] border border-[#232533] rounded-xl pl-8 pr-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-blue-500/60"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            <Folder className="w-3.5 h-3.5 text-blue-400" />
            <span>Folder Project ({filteredFolders.length})</span>
          </div>
          <span className="text-[11px] text-zinc-500">Pilih folder untuk melihat percakapan</span>
        </div>

        {loading ? (
          <div className="card p-6 text-center space-y-2 border-[#252736]">
            <RefreshCw className="w-5 h-5 text-blue-400 animate-spin mx-auto" />
            <p className="text-xs text-zinc-400">Memuat berkas workspace & riwayat percakapan...</p>
          </div>
        ) : filteredFolders.length === 0 ? (
          <div className="card p-4 rounded-xl text-center space-y-1.5 border-[#232533]">
            <Folder className="w-5 h-5 text-zinc-600 mx-auto" />
            <p className="text-xs text-zinc-400">Tidak ada folder yang cocok</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredFolders.map((folder) => {
              const isExpanded = !!expandedFolders[folder.path];
              const chats = folder.conversations;

              return (
                <div
                  key={folder.path}
                  className="card rounded-2xl border-[#232636] bg-[#14151e] overflow-hidden transition-all shadow-md self-start"
                >
                  <div
                    onClick={() => toggleFolder(folder.path)}
                    className="p-3 flex items-center justify-between cursor-pointer hover:bg-[#1a1c29] transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-blue-600/15 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
                        <FolderGit2 className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-zinc-200 truncate">
                            {folder.name}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#1e202e] text-zinc-400 border border-[#2b2e40]">
                            {chats.length} chat
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-500 font-mono truncate block mt-0.5">
                          {folder.path}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onNewChat(folder);
                        }}
                        className="btn-deep-primary p-1.5 rounded-lg text-[10px] font-semibold flex items-center gap-1"
                        title="Mulai chat di folder ini"
                      >
                        <MessageSquare className="w-3 h-3" />
                        <span className="hidden sm:inline">Chat</span>
                      </button>
                      <button className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-[#1f212f] bg-[#0f1016] px-3 py-2 space-y-2">
                      {chats.length === 0 ? (
                        <div className="py-3 text-center space-y-2">
                          <p className="text-[11px] text-zinc-500">
                            Belum ada riwayat percakapan di folder ini.
                          </p>
                          <button
                            onClick={() => onNewChat(folder)}
                            className="btn-deep-primary px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>Mulai Percakapan</span>
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {chats.map((c) => (
                            <div
                              key={c.id}
                              onClick={() => onSelectConversation(c, folder)}
                              className="p-2.5 rounded-xl bg-[#151622] hover:bg-[#1c1e2d] border border-[#242636] hover:border-[#33374d] cursor-pointer transition-all flex items-start justify-between gap-2 shadow-sm"
                            >
                              <div className="min-w-0 flex-1 space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                  <MessageSquare className="w-3 h-3 text-blue-400 shrink-0" />
                                  <span className="text-xs font-semibold text-zinc-200 truncate">
                                    {c.title}
                                  </span>
                                </div>
                                {c.preview && (
                                  <p className="text-[11px] text-zinc-400 line-clamp-1 pl-4">
                                    {c.preview}
                                  </p>
                                )}
                                <div className="flex items-center gap-2 pl-4 text-[10px] text-zinc-500 pt-0.5">
                                  {c.stepCount > 0 && (
                                    <span className="flex items-center gap-1">
                                      <Layers className="w-2.5 h-2.5" />
                                      {c.stepCount} langkah
                                    </span>
                                  )}
                                  {formatRelativeTime(c.lastModified) && (
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-2.5 h-2.5" />
                                      {formatRelativeTime(c.lastModified)}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <ArrowRight className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-1" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedFolderFilter === 'all' && (
        <div className="space-y-2.5 pt-2 border-t border-[#1e202c]">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              <FileCode2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Percakapan Tanpa Folder ({filteredNonProject.length})</span>
            </div>
            <button
              onClick={() => onNewChat()}
              className="text-[11px] text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3" />
              <span>Chat Baru</span>
            </button>
          </div>

          {filteredNonProject.length === 0 ? (
            <div className="card p-4 rounded-xl text-center space-y-1 border-[#232533]">
              <p className="text-xs text-zinc-500">Tidak ada percakapan non-project</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {filteredNonProject.map((c) => (
                <div
                  key={c.id}
                  onClick={() => onSelectConversation(c)}
                  className="card p-3 rounded-xl border-[#232636] bg-[#14151e] hover:bg-[#1a1c29] cursor-pointer transition-all flex items-start justify-between gap-2 shadow-sm"
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <MessageSquare className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span className="text-xs font-semibold text-zinc-200 truncate">
                        {c.title}
                      </span>
                    </div>
                    {c.preview && (
                      <p className="text-[11px] text-zinc-400 line-clamp-1 pl-4">
                        {c.preview}
                      </p>
                    )}
                    <div className="flex items-center gap-2 pl-4 text-[10px] text-zinc-500 pt-0.5">
                      {c.stepCount > 0 && (
                        <span className="flex items-center gap-1">
                          <Layers className="w-2.5 h-2.5" />
                          {c.stepCount} langkah
                        </span>
                      )}
                      {formatRelativeTime(c.lastModified) && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {formatRelativeTime(c.lastModified)}
                        </span>
                      )}
                    </div>
                  </div>

                  <ArrowRight className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-1" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isQuickFolderModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-100">
          <div className="w-full max-w-sm rounded-2xl bg-[#161722] border border-[#2b2d3d] shadow-2xl p-4 space-y-3.5 animate-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-blue-400" />
                <h3 className="text-xs font-bold text-zinc-100 uppercase tracking-wider">
                  Buat Quick Folder Baru
                </h3>
              </div>
              <button
                onClick={() => setIsQuickFolderModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateQuickFolder} className="space-y-3">
              <div>
                <label className="text-[11px] text-zinc-400 font-medium block mb-1">
                  Nama Folder / Project
                </label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="contoh: e-commerce-app atau task-01"
                  autoFocus
                  className="w-full bg-[#111219] border border-[#2b2d3d] rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500"
                />
                <p className="text-[10px] text-zinc-500 mt-1">
                  Folder akan dibuat di /opt/data/home/[nama]. Kosongkan untuk auto-generate nama unik.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#222434]">
                <button
                  type="button"
                  onClick={() => setIsQuickFolderModalOpen(false)}
                  className="btn-deep px-3 py-1.5 rounded-xl text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isCreatingFolder}
                  className="btn-deep-primary px-4 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                >
                  {isCreatingFolder ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Folder className="w-3.5 h-3.5" />
                  )}
                  <span>Buat Folder</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
