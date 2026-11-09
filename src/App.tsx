import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { TabBar } from './components/Navigation/TabBar.tsx';
import { AppHeader } from './components/Navigation/AppHeader.tsx';
import { OverviewTab } from './components/Tabs/OverviewTab.tsx';
import { WorkersTab } from './components/Tabs/WorkersTab.tsx';
import { LogsTab } from './components/Tabs/LogsTab.tsx';
import { SettingsTab } from './components/Tabs/SettingsTab.tsx';
import { PromptPage } from './components/Pages/PromptPage.tsx';
import { WorkerWorkspacePage } from './components/Pages/WorkerWorkspacePage.tsx';
import { MinimalWorkerModal } from './components/Sheets/MinimalWorkerModal.tsx';
import { ModelSelectorSheet } from './components/Sheets/ModelSelectorSheet.tsx';
import { UsageSheet } from './components/Sheets/UsageSheet.tsx';
import { AccountSheet } from './components/Sheets/AccountSheet.tsx';
import { SkillManagerModal } from './components/Settings/SkillManagerModal.tsx';
import { fetchVitals, fetchWorkers, activateWorker, clearAuthToken, getAuthToken, validateAuthToken } from './services/api.ts';
import { LoginGate } from './components/Common/LoginGate.tsx';
import type { TabType, WorkerProfile, SystemVitals, ConversationItem, WorkspaceFolder } from './types/telemetry.ts';

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'main';
}

function updateSlugUrl(path: string) {
  if (typeof window !== 'undefined' && window.history && window.location.pathname !== path) {
    window.history.pushState(null, '', path);
  }
}

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [vitals, setVitals] = useState<SystemVitals | null>(null);
  const [workers, setWorkers] = useState<WorkerProfile[]>([]);
  const [loadingVitals, setLoadingVitals] = useState(false);
  const [loadingWorkers, setLoadingWorkers] = useState(false);

  const [selectedWorker, setSelectedWorker] = useState<WorkerProfile | null>(null);
  const [isMinimalModalOpen, setIsMinimalModalOpen] = useState(false);
  const [workspaceWorker, setWorkspaceWorker] = useState<WorkerProfile | null>(null);
  const [promptingWorker, setPromptingWorker] = useState<WorkerProfile | null>(null);
  const [initialPromptForPage, setInitialPromptForPage] = useState<string | undefined>(undefined);
  const [activeConversation, setActiveConversation] = useState<ConversationItem | null>(null);
  const [activeFolder, setActiveFolder] = useState<WorkspaceFolder | null>(null);

  const [isModelSheetOpen, setIsModelSheetOpen] = useState(false);
  const [isUsageSheetOpen, setIsUsageSheetOpen] = useState(false);
  const [isAccountSheetOpen, setIsAccountSheetOpen] = useState(false);
  const [globalModel, setGlobalModel] = useState('gemini-3.8-flash');
  const [isTabBarVisible, setIsTabBarVisible] = useState(true);

  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);
  const [skillModalWorker, setSkillModalWorker] = useState<string | undefined>(undefined);

  const [authState, setAuthState] = useState<'checking' | 'locked' | 'open'>('checking');

  useEffect(() => {
    const stored = getAuthToken();
    if (!stored) {
      setAuthState('locked');
      return;
    }
    let cancelled = false;
    validateAuthToken(stored)
      .then((ok) => {
        if (!cancelled) setAuthState(ok ? 'open' : 'locked');
      })
      .catch(() => {
        if (!cancelled) setAuthState('locked');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = () => {
    clearAuthToken();
    setAuthState('locked');
  };

  const handleOpenSkillManager = (workerId?: string) => {
    setSkillModalWorker(workerId);
    setIsSkillModalOpen(true);
  };

  const loadData = async () => {
    setLoadingVitals(true);
    setLoadingWorkers(true);

    try {
      const [vData, wData] = await Promise.all([
        fetchVitals().catch(() => null),
        fetchWorkers().catch(() => [])
      ]);
      if (vData) setVitals(vData);
      if (wData) setWorkers(wData);
    } finally {
      setLoadingVitals(false);
      setLoadingWorkers(false);
    }
  };

  const syncFromUrl = (currentWorkers: WorkerProfile[] = workers) => {
    if (typeof window === 'undefined') return;
    const path = window.location.pathname;
    const parts = path.split('/').filter(Boolean);

    if (parts.length === 0 || parts[0] === 'overview') {
      setActiveTab('overview');
      setWorkspaceWorker(null);
      setPromptingWorker(null);
      setIsTabBarVisible(true);
      return;
    }

    if (parts[0] === 'workers') {
      setActiveTab('workers');
      setWorkspaceWorker(null);
      setPromptingWorker(null);
      setIsTabBarVisible(true);
      return;
    }

    if (parts[0] === 'worker' && parts[1]) {
      const targetId = parts[1].toLowerCase();
      const w = currentWorkers.find((item) => item.id.toLowerCase() === targetId) || {
        id: targetId,
        name: targetId.toUpperCase(),
        role: 'Worker',
        authenticated: true,
        daemonActive: false,
        rssMemoryMb: 0,
        cpuPercent: 0,
        turnCount: 0
      };
      setActiveTab('workers');
      setWorkspaceWorker(w);
      setPromptingWorker(null);
      setIsTabBarVisible(true);
      return;
    }

    if (parts[0] === 'chat' && parts[1]) {
      const targetId = parts[1].toLowerCase();
      const w = currentWorkers.find((item) => item.id.toLowerCase() === targetId) || {
        id: targetId,
        name: targetId.toUpperCase(),
        role: 'Worker',
        authenticated: true,
        daemonActive: false,
        rssMemoryMb: 0,
        cpuPercent: 0,
        turnCount: 0
      };
      const folderSlug = parts[2] || undefined;
      const convId = parts[3] || undefined;

      setPromptingWorker(w);
      setWorkspaceWorker(w);
      if (folderSlug) {
        setActiveFolder({
          name: folderSlug,
          path: `/opt/data/home/${folderSlug}`,
          uri: `file:///opt/data/home/${folderSlug}`,
          conversations: []
        });
      } else {
        setActiveFolder(null);
      }
      if (convId) {
        setActiveConversation({
          id: convId,
          title: convId,
          preview: '',
          stepCount: 0,
          lastModified: ''
        });
      } else {
        setActiveConversation(null);
      }
      setIsTabBarVisible(false);
      return;
    }

    if (parts[0] === 'discuss') {
      setActiveTab('overview');
      setWorkspaceWorker(null);
      setPromptingWorker(null);
      setIsTabBarVisible(true);
      updateSlugUrl('/overview');
      return;
    }

    if (parts[0] === 'logs' || parts[0] === 'transcripts' || parts[0] === 'console') {
      setActiveTab('logs');
      setWorkspaceWorker(null);
      setPromptingWorker(null);
      setIsTabBarVisible(true);
      return;
    }

    if (parts[0] === 'settings') {
      setActiveTab('settings');
      setWorkspaceWorker(null);
      setPromptingWorker(null);
      setIsTabBarVisible(true);
      return;
    }
  };

  useEffect(() => {
    if (authState !== 'open') return;
    loadData();
    const interval = setInterval(loadData, 8000);
    return () => clearInterval(interval);
  }, [authState]);

  useEffect(() => {
    syncFromUrl(workers);
    const handlePopState = () => {
      syncFromUrl(workers);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [workers.length]);

  const handleSelectWorker = (worker: WorkerProfile) => {
    setWorkspaceWorker(worker);
    updateSlugUrl(`/worker/${worker.id}`);
  };

  const handleOpenWorkerWorkspace = (worker: WorkerProfile) => {
    setIsMinimalModalOpen(false);
    setSelectedWorker(null);
    setPromptingWorker(null);
    setActiveConversation(null);
    setActiveFolder(null);
    setWorkspaceWorker(worker);
    updateSlugUrl(`/worker/${worker.id}`);
  };

  const handleLaunchPrompt = (
    worker: WorkerProfile,
    initialText?: string,
    conversationId?: string,
    workspaceUri?: string,
    folderName?: string,
    conversationTitle?: string
  ) => {
    setIsMinimalModalOpen(false);
    setSelectedWorker(null);
    setInitialPromptForPage(initialText);
    setPromptingWorker(worker);
    setWorkspaceWorker(worker);
    setActiveConversation(
      conversationId
        ? {
            id: conversationId,
            title: conversationTitle || 'Percakapan',
            preview: '',
            stepCount: 0,
            lastModified: '',
            workspaceUri
          }
        : null
    );
    setActiveFolder(
      folderName
        ? {
            name: folderName,
            path: workspaceUri ? workspaceUri.replace('file://', '') : '',
            uri: workspaceUri || '',
            conversations: []
          }
        : null
    );
    setIsTabBarVisible(false);
    const fSlug = folderName ? toSlug(folderName) : '';
    const cSlug = conversationId ? `/${conversationId}` : '';
    const targetUrl = fSlug ? `/chat/${worker.id}/${fSlug}${cSlug}` : `/chat/${worker.id}${cSlug}`;
    updateSlugUrl(targetUrl);
  };

  const handleActivateWorker = async (worker: WorkerProfile) => {
    try {
      await activateWorker(worker.id);
      loadData();
    } catch {}
  };

  const getHeaderTitle = () => {
    if (promptingWorker) {
      if (activeConversation?.title) {
        return activeConversation.title;
      }
      if (activeFolder?.name) {
        return `${promptingWorker.id.toUpperCase()} • ${activeFolder.name}`;
      }
      return `${promptingWorker.id.toUpperCase()} • Remote Task`;
    }
    if (workspaceWorker) {
      return `${workspaceWorker.id.toUpperCase()} • Workspace & Chat`;
    }
    switch (activeTab) {
      case 'overview':
        return 'Overview';
      case 'workers':
        return 'Workers';
      case 'logs':
      case 'transcripts':
      case 'console':
        return 'Logs';
      case 'settings':
        return 'Settings';
      default:
        return 'AgyRemote';
    }
  };

  const canGoBack = !!promptingWorker || !!workspaceWorker || activeTab !== 'overview';

  const handleHeaderBack = () => {
    if (promptingWorker) {
      const prevWorker = promptingWorker;
      setPromptingWorker(null);
      setInitialPromptForPage(undefined);
      setActiveConversation(null);
      setActiveFolder(null);
      setIsTabBarVisible(true);
      updateSlugUrl(`/worker/${prevWorker.id}`);
    } else if (workspaceWorker) {
      setWorkspaceWorker(null);
      updateSlugUrl('/workers');
    } else if (activeTab !== 'overview') {
      setActiveTab('overview');
      updateSlugUrl('/overview');
    }
  };

  const isFullScreenChat = !!promptingWorker;
  const showBottomNav = !isFullScreenChat && isTabBarVisible;
  const activeWorkerAvatar =
    promptingWorker?.picture ||
    workspaceWorker?.picture ||
    workers.find((w) => w.id === 'agy01')?.picture ||
    workers.find((w) => !!w.picture)?.picture;

  if (authState === 'checking') {
    return (
      <div className="min-h-screen bg-[#0c0d0e] text-[#f4f4f5] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
        <p className="text-xs text-zinc-500">Memeriksa sesi</p>
      </div>
    );
  }

  if (authState === 'locked') {
    return <LoginGate onAuthenticated={() => setAuthState('open')} />;
  }

  return (
    <div
      className={`bg-[#0c0d0e] text-[#f4f4f5] flex flex-col items-center selection:bg-blue-600/30 ${
        isFullScreenChat
          ? 'fixed inset-0 h-[100dvh] max-h-[100dvh] overflow-hidden overscroll-none'
          : 'min-h-screen overflow-x-hidden'
      }`}
    >
      <div
        className={`w-full ${
          isFullScreenChat
            ? 'max-w-none h-full max-h-[100dvh] overflow-hidden'
            : 'max-w-md md:max-w-3xl lg:max-w-5xl xl:max-w-6xl min-w-[360px] mx-auto min-h-screen pb-20 overflow-x-hidden'
        } flex flex-col relative`}
      >
        {!promptingWorker && (
          <AppHeader
            title={getHeaderTitle()}
            canGoBack={canGoBack}
            onBack={handleHeaderBack}
            onOpenModelSelector={() => setIsModelSheetOpen(true)}
            onOpenUsage={() => setIsUsageSheetOpen(true)}
            onOpenAccount={() => setIsAccountSheetOpen(true)}
            onOpenSettings={() => {
              setPromptingWorker(null);
              setWorkspaceWorker(null);
              setIsTabBarVisible(true);
              setActiveTab('settings');
              updateSlugUrl('/settings');
            }}
            onToggleTabBar={() => setIsTabBarVisible((prev) => !prev)}
            isTabBarVisible={showBottomNav}
            onRefresh={loadData}
            isLoading={loadingVitals || loadingWorkers}
            onLogout={handleLogout}
            userPicture={activeWorkerAvatar}
          />
        )}

        <main
          className={`w-full ${
            isFullScreenChat
              ? 'flex-1 flex flex-col min-h-0 overflow-hidden px-0 pt-0 pb-0'
              : 'px-3 pt-2.5 flex-1 transition-opacity duration-150 motion-reduce:transition-none'
          }`}
        >
          {promptingWorker ? (
            <PromptPage
              worker={promptingWorker}
              onBack={handleHeaderBack}
              onActivate={handleActivateWorker}
              onOpenUsage={() => setIsUsageSheetOpen(true)}
              onOpenSettings={() => {
                setPromptingWorker(null);
                setWorkspaceWorker(null);
                setIsTabBarVisible(true);
                setActiveTab('settings');
              }}
              initialPrompt={initialPromptForPage}
              initialConversationId={activeConversation?.id}
              initialWorkspaceUri={activeConversation?.workspaceUri || activeFolder?.uri}
              folderName={activeFolder?.name}
              conversationTitle={activeConversation?.title}
            />
          ) : workspaceWorker ? (
            <WorkerWorkspacePage
              worker={workspaceWorker}
              workers={workers}
              onSelectWorker={(w) => setWorkspaceWorker(w)}
              onBack={handleHeaderBack}
              onSelectConversation={(conv, folder) => {
                handleLaunchPrompt(
                  workspaceWorker,
                  undefined,
                  conv.id,
                  conv.workspaceUri || folder?.uri,
                  folder?.name,
                  conv.title
                );
              }}
              onNewChat={(folder) => {
                handleLaunchPrompt(
                  workspaceWorker,
                  undefined,
                  undefined,
                  folder?.uri,
                  folder?.name,
                  undefined
                );
              }}
              onOpenUsage={() => setIsUsageSheetOpen(true)}
              onRefreshWorkers={loadData}
            />
          ) : (
            <>
              {activeTab === 'overview' && (
                <OverviewTab
                  vitals={vitals}
                  workers={workers}
                  loadingVitals={loadingVitals}
                  loadingWorkers={loadingWorkers}
                  onRefresh={loadData}
                  onSelectWorker={handleOpenWorkerWorkspace}
                  onLaunchPrompt={handleOpenWorkerWorkspace}
                  onNavigateToWorkers={() => {
                    setActiveTab('workers');
                    updateSlugUrl('/workers');
                  }}
                  onOpenSkillManager={handleOpenSkillManager}
                />
              )}

              {activeTab === 'workers' && (
                <WorkersTab
                  workers={workers}
                  loading={loadingWorkers}
                  onRefresh={loadData}
                  onSelectWorker={handleOpenWorkerWorkspace}
                  onLaunchPrompt={handleOpenWorkerWorkspace}
                  onOpenUsage={() => setIsUsageSheetOpen(true)}
                  onOpenAccount={() => setIsAccountSheetOpen(true)}
                />
              )}

              {(activeTab === 'logs' || activeTab === 'transcripts' || activeTab === 'console') && (
                <LogsTab
                  workers={workers}
                  onOpenConversation={handleLaunchPrompt}
                />
              )}

              {activeTab === 'settings' && (
                <SettingsTab
                  workers={workers}
                  onRefreshWorkers={loadData}
                  onOpenSkillManager={() => handleOpenSkillManager()}
                  onLogout={handleLogout}
                />
              )}
            </>
          )}
        </main>

        {showBottomNav && (
          <TabBar
            activeTab={activeTab}
            onTabChange={(tab) => {
              setPromptingWorker(null);
              setWorkspaceWorker(null);
              setIsTabBarVisible(true);
              setActiveTab(tab);
              updateSlugUrl(`/${tab}`);
            }}
          />
        )}

        <MinimalWorkerModal
          worker={selectedWorker}
          isOpen={isMinimalModalOpen}
          onClose={() => setIsMinimalModalOpen(false)}
          onLaunchPrompt={handleOpenWorkerWorkspace}
          onOpenAccount={() => setIsAccountSheetOpen(true)}
          onRefreshWorkers={loadData}
        />

        <ModelSelectorSheet
          isOpen={isModelSheetOpen}
          onClose={() => setIsModelSheetOpen(false)}
          selectedModel={globalModel}
          onSelectModel={(model) => setGlobalModel(model)}
          onOpenUsage={() => setIsUsageSheetOpen(true)}
        />

        <UsageSheet
          isOpen={isUsageSheetOpen}
          onClose={() => setIsUsageSheetOpen(false)}
          vitals={vitals}
          workers={workers}
          initialWorkerId={promptingWorker?.id || workspaceWorker?.id || 'agy10'}
          onRefresh={loadData}
        />

        <AccountSheet
          isOpen={isAccountSheetOpen}
          onClose={() => setIsAccountSheetOpen(false)}
          workers={workers}
          onWorkerUpdated={() => loadData()}
        />

        <SkillManagerModal
          isOpen={isSkillModalOpen}
          onClose={() => {
            setIsSkillModalOpen(false);
            setSkillModalWorker(undefined);
          }}
          initialWorkerId={skillModalWorker}
        />
      </div>
    </div>
  );
};

export default App;
