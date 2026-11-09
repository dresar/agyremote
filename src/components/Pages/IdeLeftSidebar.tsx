import React, { useState, useEffect } from 'react';
import {
  PanelLeftClose,
  Plus,
  History,
  Folder,
  FolderPlus,
  ChevronDown,
  ChevronRight,
  Settings
} from 'lucide-react';
import { fetchWorkerConversations } from '../../services/api.ts';
import type { WorkerProfile, WorkerWorkspaceData, WorkspaceFolder, ConversationItem } from '../../types/telemetry.ts';

interface IdeLeftSidebarProps {
  worker: WorkerProfile;
  currentConversationId?: string;
  onSelectConversation: (conv: ConversationItem, folder?: WorkspaceFolder) => void;
  onNewConversation: () => void;
  onToggleCollapse: () => void;
  onOpenSettings?: () => void;
  isOpen: boolean;
}

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr || dateStr.startsWith('0001')) return '';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `${Math.max(1, diffMin)}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d`;
}

export const IdeLeftSidebar: React.FC<IdeLeftSidebarProps> = ({
  worker,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onToggleCollapse,
  onOpenSettings,
  isOpen
}) => {
  const [data, setData] = useState<WorkerWorkspaceData | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  const loadData = () => {
    fetchWorkerConversations(worker.id)
      .then((res) => {
        setData(res);
        const initial: Record<string, boolean> = {};
        if (res && res.folders) {
          res.folders.forEach((f, idx) => {
            if (idx < 5) initial[f.path] = true;
          });
        }
        setExpandedFolders(initial);
      })
      .catch(() => {
        setData(null);
      });
  };

  useEffect(() => {
    loadData();
  }, [worker.id]);

  if (!isOpen) return null;

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [path]: !prev[path]
    }));
  };

  return (
    <>
      <div
        onClick={onToggleCollapse}
        className="fixed inset-0 bg-black/70 backdrop-blur-xs z-40 lg:hidden cursor-pointer"
        title="Tutup menu"
      />
      <aside className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] shadow-2xl lg:shadow-none lg:static lg:z-auto lg:w-64 xl:w-72 bg-[#0e0f17] border-r border-[#1f212f] flex flex-col h-full shrink-0 select-none">
        <div className="flex items-center justify-between px-3 h-10 border-b border-[#1f212f] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-zinc-100 tracking-wide font-sans">
            Antigravity
          </span>
        </div>
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg hover:bg-[#1a1c2a] text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
          title="Tutup Sidebar Kiri"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      <div className="p-2 shrink-0">
        <button
          onClick={onNewConversation}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-[#181a28] hover:bg-[#202338] text-xs font-semibold text-zinc-200 hover:text-white border border-[#2b2e44] shadow-sm transition-all cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 text-blue-400" />
          <span>New Conversation</span>
        </button>
      </div>

      <div className="px-2 pb-1.5 shrink-0">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-[#13141f] border border-[#222436] text-[11px] text-zinc-400 font-medium">
          <History className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          <span>Riwayat</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-3 scrollbar-thin">
        <div>
          <div className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            <span>Projects</span>
            <FolderPlus className="w-3.5 h-3.5 text-zinc-500" />
          </div>

          <div className="space-y-1 mt-1">
            {data?.folders?.map((folder) => {
              const isExpanded = !!expandedFolders[folder.path];
              const validConversations = (folder.conversations || []).filter((conv) => {
                const hasTitle = conv.title && conv.title !== 'Percakapan Tanpa Judul';
                const hasPreview = !!conv.preview;
                const hasSteps = conv.stepCount === undefined || conv.stepCount > 0;
                return (hasTitle || hasPreview) && hasSteps;
              });

              return (
                <div key={folder.path} className="space-y-0.5">
                  <button
                    onClick={() => toggleFolder(folder.path)}
                    className="w-full flex items-center justify-between px-2 py-1 rounded-lg text-left text-xs font-medium text-zinc-300 hover:bg-[#161824] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 truncate pr-1">
                      {isExpanded ? (
                        <ChevronDown className="w-3 h-3 text-zinc-500 shrink-0" />
                      ) : (
                        <ChevronRight className="w-3 h-3 text-zinc-500 shrink-0" />
                      )}
                      <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="truncate">{folder.name}</span>
                    </div>
                    <span className="text-[10px] text-zinc-500 font-mono shrink-0">
                      {validConversations.length}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="pl-4 space-y-0.5 border-l border-[#1c1e2c] ml-3 mt-0.5">
                      {validConversations.map((conv) => {
                        const isCurrent = conv.id === currentConversationId;
                        const relTime = formatRelativeTime(conv.lastModified);
                        const displayTitle = conv.title && conv.title !== 'Percakapan Tanpa Judul'
                          ? conv.title
                          : conv.preview
                          ? (conv.preview.length > 30 ? conv.preview.slice(0, 30) + '...' : conv.preview)
                          : 'Percakapan';

                        return (
                          <button
                            key={conv.id}
                            onClick={() => onSelectConversation(conv, folder)}
                            className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left text-[11px] transition-colors cursor-pointer ${
                              isCurrent
                                ? 'bg-[#1e202f] text-zinc-100 border border-[#2f3248] font-medium'
                                : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#161824]'
                            }`}
                          >
                            <span className="truncate pr-1">{displayTitle}</span>
                            {relTime ? (
                              <span className="text-[10px] text-zinc-500 font-mono shrink-0">
                                {relTime}
                              </span>
                            ) : (
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {(() => {
              const nonProjects = data?.nonProjectConversations || (data as any)?.unorganized || [];
              const validUnorganized = nonProjects.filter((conv) => {
                const hasTitle = conv.title && conv.title !== 'Percakapan Tanpa Judul';
                const hasPreview = !!conv.preview;
                const hasSteps = conv.stepCount === undefined || conv.stepCount > 0;
                return (hasTitle || hasPreview) || hasSteps;
              });

              if (validUnorganized.length === 0) return null;

              return (
                <div className="pt-2">
                  <div className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                    <span>CLI Projects & Percakapan</span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {validUnorganized.length}
                    </span>
                  </div>
                  <div className="space-y-0.5 mt-0.5">
                    {validUnorganized.map((conv) => {
                      const isCurrent = conv.id === currentConversationId;
                      const relTime = formatRelativeTime(conv.lastModified);
                      const displayTitle = conv.title && conv.title !== 'Percakapan Tanpa Judul'
                        ? conv.title
                        : conv.preview
                        ? (conv.preview.length > 30 ? conv.preview.slice(0, 30) + '...' : conv.preview)
                        : (conv.id.slice(0, 8));

                      return (
                        <button
                          key={conv.id}
                          onClick={() => onSelectConversation(conv)}
                          className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left text-[11px] transition-colors cursor-pointer ${
                            isCurrent
                              ? 'bg-[#1e202f] text-zinc-100 border border-[#2f3248] font-medium'
                              : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#161824]'
                          }`}
                        >
                          <span className="truncate pr-1">{displayTitle}</span>
                          {relTime ? (
                            <span className="text-[10px] text-zinc-500 font-mono shrink-0">
                              {relTime}
                            </span>
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      <div className="p-2 border-t border-[#1f212f] space-y-1.5 shrink-0 bg-[#0c0d13]">
        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-[#141520] border border-[#222434] text-xs">
          <div className="flex items-center gap-2 truncate">
            <span className={`w-2 h-2 rounded-full ${worker.daemonActive ? 'bg-emerald-400 animate-pulse' : 'bg-emerald-500'} shrink-0`} />
            <span className="font-mono font-bold text-zinc-200 uppercase truncate">
              {worker.id}
            </span>
            <span className="text-[10px] text-zinc-400 truncate">
              {worker.email ? worker.email.split('@')[0] : 'idle'}
            </span>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
        </div>

        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="w-full flex items-center gap-2 px-2 py-1 rounded-lg text-xs text-zinc-400 hover:text-zinc-100 hover:bg-[#181926] transition-colors cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Settings</span>
          </button>
        )}
      </div>
    </aside>
    </>
  );
};
