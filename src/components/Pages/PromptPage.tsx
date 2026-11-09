import React, { useState, useEffect, useRef } from 'react';
import type { WorkerProfile, WorkspaceFolder, ConversationItem } from '../../types/telemetry.ts';
import { streamWorkerPrompt } from '../../services/sse.ts';
import { fetchWorkerChanges, enhancePromptApi, fetchConversationMessages, fetchWorkerConversations, type FileChangeItem } from '../../services/api.ts';
import { ModelUsagePopover, AVAILABLE_MODELS } from './ModelUsagePopover.tsx';
import { AddContextSheet } from '../Sheets/AddContextSheet.tsx';
import { SlashCommandsMenu } from './SlashCommandsMenu.tsx';
import { IdeLeftSidebar } from './IdeLeftSidebar.tsx';
import { CodeViewerPanel } from './CodeViewerPanel.tsx';
import { GoogleAvatar } from '../Common/GoogleAvatar.tsx';
import { AgentExecutionView } from './AgentExecutionView.tsx';
import { fetchConversationTranscript, type ExecutionStep, type FileChangeDetail } from '../../services/transcript.ts';
import { MarkdownMessageView } from './MarkdownMessageView.tsx';
import { TurnFileChanges } from './TurnFileChanges.tsx';
import {
  enhancePromptWithRotation,
  loadProjectMetadata,
  type ProjectFolderMetadata
} from '../../services/promptEnhancer.ts';
import { ProjectMetadataModal } from './ProjectMetadataModal.tsx';
import {
  ArrowLeft,
  ArrowUp,
  Square,
  Bot,
  Terminal,
  Loader2,
  Plus,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Copy,
  ThumbsUp,
  ThumbsDown,
  Check,
  Code2,
  Wand2,
  Folder,
  PanelLeftOpen,
  PanelRightOpen,
  MoreVertical,
  FileText,
  Brain,
  Search,
  CheckCircle2,
  AlertCircle,
  Mic
} from 'lucide-react';

interface PromptPageProps {
  worker: WorkerProfile;
  onBack: () => void;
  onActivate?: (worker: WorkerProfile) => void;
  onOpenUsage?: () => void;
  onOpenSettings?: () => void;
  initialPrompt?: string;
  initialConversationId?: string;
  initialWorkspaceUri?: string;
  folderName?: string;
  conversationTitle?: string;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  content: string;
  timestamp: string;
  duration?: string;
  steps?: ExecutionStep[];
  thinking?: string;
  fileChanges?: FileChangeDetail[];
  totalAdditions?: number;
  totalDeletions?: number;
}

export const PromptPage: React.FC<PromptPageProps> = ({
  worker,
  onBack,
  onActivate,
  onOpenUsage,
  onOpenSettings,
  initialPrompt,
  initialConversationId,
  initialWorkspaceUri,
  folderName: initialFolderName,
  conversationTitle: initialTitle
}) => {
  const [promptText, setPromptText] = useState(initialPrompt || '');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>(initialConversationId);
  const [activeTitle, setActiveTitle] = useState<string | undefined>(initialTitle);
  const [activeFolder, setActiveFolder] = useState<string | undefined>(initialFolderName);
  const [activeWorkspaceUri, setActiveWorkspaceUri] = useState<string | undefined>(initialWorkspaceUri);

  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(!!initialConversationId);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentSteps, setCurrentSteps] = useState<ExecutionStep[]>([]);
  const [streamingDelta, setStreamingDelta] = useState('');
  const [fileChanges, setFileChanges] = useState<FileChangeItem[]>([]);
  const [showSteps, setShowSteps] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.8-flash');
  const [isModelSheetOpen, setIsModelSheetOpen] = useState(false);
  const [isAddContextOpen, setIsAddContextOpen] = useState(false);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [isMetadataModalOpen, setIsMetadataModalOpen] = useState(false);
  const [projectMetadata, setProjectMetadata] = useState<ProjectFolderMetadata>(() => {
    return loadProjectMetadata(initialWorkspaceUri || '/opt/data/home/agyremote');
  });

  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const speechBaseRef = useRef<string>('');

  const abortRef = useRef<(() => void) | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);
  const liveDeltaRef = useRef<string>('');
  const currentStepsRef = useRef<ExecutionStep[]>([]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsLeftSidebarOpen(false);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const loadChanges = () => {
    fetchWorkerChanges(worker.id)
      .then((data) => {
        if (data && data.changes) {
          setFileChanges(data.changes);
          if (!selectedFilePath && data.changes.length > 0) {
            setSelectedFilePath(data.changes[0].path);
          }
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadChanges();
  }, [worker.id]);

  useEffect(() => {
    if (initialPrompt && messages.length === 0) {
      setPromptText(initialPrompt);
    }
  }, [initialPrompt]);

  const loadConversation = (cid: string) => {
    setConversationId(cid);
    setIsLoadingMessages(true);
    Promise.all([
      fetchConversationMessages(worker.id, cid).catch(() => ({ conversationId: cid, messages: [] })),
      fetchConversationTranscript(worker.id, cid).catch(() => [])
    ])
      .then(([msgRes, turns]) => {
        const rawMsgs = msgRes?.messages || [];
        if (rawMsgs.length > 0) {
          let agentTurnIdx = 0;
          const enriched: ChatMessage[] = rawMsgs.map((m) => {
            if (m.sender === 'agent') {
              const matchedTurn = turns[agentTurnIdx];
              agentTurnIdx++;
              if (matchedTurn) {
                return {
                  ...m,
                  duration: matchedTurn.duration || '1s',
                  thinking: matchedTurn.thinking,
                  steps: matchedTurn.steps,
                  fileChanges: matchedTurn.fileChanges,
                  totalAdditions: matchedTurn.totalAdditions,
                  totalDeletions: matchedTurn.totalDeletions
                };
              }
            }
            return m;
          });
          setMessages(enriched);
        } else if (turns.length > 0) {
          const synthesized: ChatMessage[] = [];
          turns.forEach((t, i) => {
            if (t.userPrompt) {
              synthesized.push({
                id: `u_${i}`,
                sender: 'user',
                content: t.userPrompt,
                timestamp: t.timestamp || ''
              });
            }
            if (t.agentResponse || t.steps.length > 0) {
              synthesized.push({
                id: `a_${i}`,
                sender: 'agent',
                content: t.agentResponse,
                timestamp: t.timestamp || '',
                duration: t.duration || '1s',
                thinking: t.thinking,
                steps: t.steps,
                fileChanges: t.fileChanges,
                totalAdditions: t.totalAdditions,
                totalDeletions: t.totalDeletions
              });
            }
          });
          setMessages(synthesized);
        }
      })
      .finally(() => {
        setIsLoadingMessages(false);
      });
  };

  useEffect(() => {
    if (initialConversationId) {
      loadConversation(initialConversationId);
    } else if (initialFolderName) {
      fetchWorkerConversations(worker.id)
        .then((ws) => {
          if (ws && Array.isArray(ws.folders)) {
            const fTarget = initialFolderName.toLowerCase().replace(/[^a-z0-9]/g, '');
            const matched = ws.folders.find((f) => {
              const fName = f.name.toLowerCase().replace(/[^a-z0-9]/g, '');
              return fName === fTarget;
            });
            if (matched && matched.conversations && matched.conversations.length > 0) {
              const validConvs = matched.conversations.filter(
                (c) => ((c.title && c.title !== 'Percakapan Tanpa Judul') || c.preview) && (c.stepCount === undefined || c.stepCount > 0)
              );
              const latest = validConvs.length > 0 ? validConvs[0] : matched.conversations[0];
              if (latest) {
                setActiveTitle(latest.title);
                loadConversation(latest.id);
              }
            }
          }
        })
        .catch(() => {});
    }
  }, [worker.id, initialConversationId, initialFolderName]);

  useEffect(() => {
    if (isStreaming) {
      timerRef.current = window.setInterval(() => {
        const sec = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));
        setElapsedSeconds(sec);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isStreaming]);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages, streamingDelta, currentSteps]);

  const handlePromptInputChange = (val: string) => {
    setPromptText(val);
    const lastWord = val.split(/\s+/).pop() || '';
    if (lastWord.startsWith('/') && lastWord.length <= 15) {
      setShowSlashMenu(true);
    } else {
      setShowSlashMenu(false);
    }
  };

  const handleSelectSlashCommand = (cmd: string) => {
    setPromptText((prev) => {
      const words = prev.trimEnd().split(/\s+/);
      if (words.length > 0 && words[words.length - 1].startsWith('/')) {
        words.pop();
        return words.length > 0 ? `${words.join(' ')} ${cmd} ` : `${cmd} `;
      }
      return prev ? `${prev} ${cmd} ` : `${cmd} `;
    });
    setShowSlashMenu(false);
  };

  const handleEnhancePrompt = async () => {
    const text = promptText.trim();
    if (!text || isEnhancing) return;
    setIsEnhancing(true);
    try {
      const projectCtx = 'Proyek AgyRemote (Antigravity Remote Control Dashboard & IDE Editor). Stack: Frontend React 18 + Vite + Tailwind CSS + TypeScript di /opt/data/home/agyremote. Backend: Go 1.22 stdlib net/http.ServeMux di port 8787. Aturan: NOKOMEN (tanpa komentar di kode), efisiensi token hemat-token-wajib, antarmuka responsif mobile-first.';
      const res = await enhancePromptWithRotation(text, projectCtx);
      if (res && res.enhancedPrompt) {
        setPromptText(res.enhancedPrompt);
      } else {
        const backendRes = await enhancePromptApi(text, worker.id);
        if (backendRes && backendRes.enhancedPrompt) {
          setPromptText(backendRes.enhancedPrompt);
        }
      }
    } catch {
      try {
        const fallbackRes = await enhancePromptApi(text, worker.id);
        if (fallbackRes && fallbackRes.enhancedPrompt) {
          setPromptText(fallbackRes.enhancedPrompt);
        }
      } catch {}
    } finally {
      setIsEnhancing(false);
    }
  };

  const toggleVoiceInput = () => {
    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Browser tidak mendukung Web Speech API');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'id-ID';

      speechBaseRef.current = promptText ? promptText.trim() + ' ' : '';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += transcript;
          } else {
            interim += transcript;
          }
        }

        if (final) {
          speechBaseRef.current += final + ' ';
        }

        const liveText = (speechBaseRef.current + interim).trimStart();
        setPromptText(liveText);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    };
  }, []);

  const handleSend = () => {
    const text = promptText.trim();
    if (!text || isStreaming) return;

    startTimeRef.current = Date.now();
    setElapsedSeconds(1);

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      sender: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setPromptText('');
    setShowSlashMenu(false);
    setIsStreaming(true);
    setCurrentSteps([]);
    setStreamingDelta('');
    liveDeltaRef.current = '';
    currentStepsRef.current = [];

    const cancel = streamWorkerPrompt(
      worker.id,
      text,
      {
        onDelta: (chunk) => {
          liveDeltaRef.current += chunk;
          setStreamingDelta(liveDeltaRef.current);
        },
        onTool: (tool) => {
          const stepObj: ExecutionStep = {
            name: tool.name,
            state: tool.state,
            path: tool.path,
            action: tool.action,
            detail: tool.detail,
            command: tool.name === 'run_command' ? (tool.detail || tool.name) : undefined,
            summary: tool.name === 'run_command'
              ? (tool.detail || 'Command')
              : (tool.path ? `${tool.name} ${tool.path.split('/').pop()}` : tool.name),
            output: tool.output
          };
          const copy = [...currentStepsRef.current];
          const existingIdx = copy.findIndex((s) => s.name === tool.name && s.path === tool.path && (!tool.detail || s.detail === tool.detail));
          if (existingIdx >= 0) {
            copy[existingIdx] = { ...copy[existingIdx], ...stepObj };
          } else {
            copy.push(stepObj);
          }
          currentStepsRef.current = copy;
          setCurrentSteps(copy);
        },
        onFileChange: (file) => {
          setFileChanges((prev) => {
            const exists = prev.some((f) => f.path === file.path);
            if (exists) return prev;
            return [
              {
                path: file.path,
                name: file.name,
                action: file.action,
                timestamp: new Date().toISOString()
              },
              ...prev
            ];
          });
          setSelectedFilePath(file.path);
          if (window.innerWidth >= 1024) {
            setIsRightSidebarOpen(true);
          }
        },
        onResult: (result) => {
          const cidToUse = result.conversation_id || conversationId;
          if (result.conversation_id && !conversationId) {
            setConversationId(result.conversation_id);
          }
          const durationSec = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));
          const agentMsg: ChatMessage = {
            id: `a_${Date.now()}`,
            sender: 'agent',
            content: liveDeltaRef.current || result.summary || 'Tugas selesai dieksekusi.',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            duration: `${durationSec}s`,
            steps: currentStepsRef.current
          };
          setMessages((prev) => [...prev, agentMsg]);
          setIsStreaming(false);
          setStreamingDelta('');
          setCurrentSteps([]);
          loadChanges();

          if (cidToUse) {
            setTimeout(() => {
              fetchConversationTranscript(worker.id, cidToUse)
                .then((turns) => {
                  if (turns.length > 0) {
                    const lastTurn = turns[turns.length - 1];
                    if (lastTurn && (lastTurn.steps.length > 0 || lastTurn.thinking || lastTurn.duration)) {
                      setMessages((prev) => {
                        const copy = [...prev];
                        const lastAgentIdx = copy.map((m) => m.sender).lastIndexOf('agent');
                        if (lastAgentIdx >= 0) {
                          copy[lastAgentIdx] = {
                            ...copy[lastAgentIdx],
                            duration: lastTurn.duration || copy[lastAgentIdx].duration,
                            thinking: lastTurn.thinking || copy[lastAgentIdx].thinking,
                            steps: lastTurn.steps.length > 0 ? lastTurn.steps : copy[lastAgentIdx].steps,
                            fileChanges: lastTurn.fileChanges,
                            totalAdditions: lastTurn.totalAdditions,
                            totalDeletions: lastTurn.totalDeletions
                          };
                        }
                        return copy;
                      });
                    }
                  }
                })
                .catch(() => {});
            }, 1000);
          }
        },
        onError: (err) => {
          const errMsg: ChatMessage = {
            id: `err_${Date.now()}`,
            sender: 'agent',
            content: `Terjadi kendala: ${err}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };
          setMessages((prev) => [...prev, errMsg]);
          setIsStreaming(false);
          setStreamingDelta('');
          setCurrentSteps([]);
        },
        onClose: () => {
          setIsStreaming(false);
        }
      },
      selectedModel,
      conversationId,
      activeWorkspaceUri ? activeWorkspaceUri.replace('file://', '') : undefined
    );

    abortRef.current = cancel;
  };

  const handleStop = () => {
    if (abortRef.current) {
      abortRef.current();
      abortRef.current = null;
    }
    setIsStreaming(false);
  };

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleNewConversation = () => {
    setMessages([]);
    setConversationId(undefined);
    setActiveTitle(undefined);
    setFileChanges([]);
    setCurrentSteps([]);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setIsLeftSidebarOpen(false);
    }
  };

  const handleSelectConvFromSidebar = (conv: ConversationItem, folder?: WorkspaceFolder) => {
    setActiveTitle(conv.title);
    if (folder) {
      setActiveFolder(folder.name);
      setActiveWorkspaceUri(folder.uri);
    } else {
      setActiveFolder('CLI Project');
      setActiveWorkspaceUri(undefined);
    }
    loadConversation(conv.id);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setIsLeftSidebarOpen(false);
    }
  };

  const activeModelObj = AVAILABLE_MODELS.find((m) => m.id === selectedModel) || AVAILABLE_MODELS[0];

  const countExplored = (steps: ExecutionStep[]) =>
    steps.filter((s) => ['read_file', 'list_dir', 'find', 'grep', 'search', 'browse'].some((k) => s.name.toLowerCase().includes(k))).length;

  const countCommands = (steps: ExecutionStep[]) =>
    steps.filter((s) => ['run_command', 'exec', 'bash', 'cmd', 'terminal'].some((k) => s.name.toLowerCase().includes(k))).length;

  const countEdited = (steps: ExecutionStep[]) =>
    steps.filter((s) => ['edit_file', 'write_file', 'create_file', 'patch'].some((k) => s.name.toLowerCase().includes(k))).length;

  return (
    <div className="w-full flex flex-row flex-1 h-full min-h-0 overflow-hidden bg-[#0a0b10] relative select-none">
      <IdeLeftSidebar
        worker={worker}
        currentConversationId={conversationId}
        onSelectConversation={handleSelectConvFromSidebar}
        onNewConversation={handleNewConversation}
        onToggleCollapse={() => setIsLeftSidebarOpen(false)}
        onOpenSettings={onOpenSettings}
        isOpen={isLeftSidebarOpen}
      />

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[#0c0d12] relative">
        <div className="flex items-center justify-between px-2.5 sm:px-3 h-11 bg-[#10111a] border-b border-[#1f212f] shrink-0 text-xs text-zinc-300">
          <div className="flex items-center gap-1.5 sm:gap-2 truncate min-w-0 pr-2">
            <button
              onClick={onBack}
              className="lg:hidden p-1.5 rounded-lg hover:bg-[#1a1c2a] text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer shrink-0"
              title="Kembali"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            {!isLeftSidebarOpen && (
              <button
                onClick={() => setIsLeftSidebarOpen(true)}
                className="p-1.5 rounded-lg hover:bg-[#1a1c2a] text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer shrink-0"
                title="Buka Sidebar"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            )}

            <div className="hidden sm:flex items-center gap-1.5 truncate text-[11px] font-mono">
              <Folder className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="font-semibold text-zinc-300 truncate">
                {activeFolder || 'AgyRemoteTele'}
              </span>
              <span className="text-zinc-600">/</span>
              <span className="text-zinc-100 font-medium truncate">
                {activeTitle || 'Website Location Tracking Identification'}
              </span>
            </div>

            <div className="flex sm:hidden items-center gap-1.5 truncate text-xs">
              <span className="font-bold text-zinc-100 uppercase truncate">
                {worker.id} • {activeTitle || 'Remote Task'}
              </span>
              <span className={`w-2 h-2 rounded-full shrink-0 ${worker.daemonActive ? 'bg-emerald-400 animate-pulse' : 'bg-emerald-500'}`} />
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0 text-zinc-400">
            {fileChanges.length > 0 && (
              <button
                onClick={() => {
                  if (fileChanges.length > 0 && !selectedFilePath) {
                    setSelectedFilePath(fileChanges[0].path);
                  }
                  setIsRightSidebarOpen((prev) => !prev);
                }}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                  isRightSidebarOpen
                    ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                    : 'hover:bg-[#1a1c2a] text-zinc-300'
                }`}
                title="Review Perubahan Berkas"
              >
                <FileText className="w-3.5 h-3.5 text-blue-400" />
                <span>Review ({fileChanges.length})</span>
              </button>
            )}

            <button
              onClick={() => {
                if (!selectedFilePath && fileChanges.length > 0) {
                  setSelectedFilePath(fileChanges[0].path);
                }
                setIsRightSidebarOpen((prev) => !prev);
              }}
              className="p-1.5 rounded-lg hover:bg-[#1a1c2a] hover:text-zinc-200 transition-colors cursor-pointer"
              title="Buka Panel Editor Kanan"
            >
              <PanelRightOpen className="w-4 h-4" />
            </button>

            <div className="relative">
              <button
                onClick={() => setShowMoreMenu((prev) => !prev)}
                className="p-1.5 rounded-lg hover:bg-[#1a1c2a] hover:text-zinc-200 transition-colors cursor-pointer"
                title="Menu Aksi"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {showMoreMenu && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-[#141520] border border-[#27293a] rounded-xl shadow-2xl p-1 z-50 text-xs">
                  <button
                    onClick={() => {
                      handleNewConversation();
                      setShowMoreMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[#1d1f30] text-zinc-200 text-left cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Percakapan Baru</span>
                  </button>
                  <button
                    onClick={() => {
                      if (conversationId) navigator.clipboard.writeText(conversationId);
                      setShowMoreMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[#1d1f30] text-zinc-200 text-left cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin ID Chat</span>
                  </button>
                </div>
              )}
            </div>

            <div className="pl-1 shrink-0">
              <GoogleAvatar picture={worker.picture} sizeClassName="w-6 h-6 rounded-full" />
            </div>
          </div>
        </div>

        {!worker.authenticated && (
          <div className="shrink-0 m-2 p-2.5 rounded-xl bg-amber-950/40 border border-amber-800/60 flex items-center justify-between gap-2 shadow-lg">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-xs text-amber-200 font-medium">Worker belum login Google OAuth</span>
            </div>
            <button
              onClick={() => onActivate?.(worker)}
              className="btn-deep-primary px-3 py-1 text-xs font-semibold"
            >
              Hubungkan
            </button>
          </div>
        )}

        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto space-y-4 px-3 sm:px-6 py-4 min-h-0 scrollbar-thin select-text"
        >
          {isLoadingMessages && (
            <div className="flex items-center justify-center my-auto py-16 text-zinc-400 text-xs gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
              <span>Memuat...</span>
            </div>
          )}

          {!isLoadingMessages && messages.length === 0 && !isStreaming && (
            <div className="flex flex-col items-center justify-center my-auto py-20 text-center space-y-2 select-none">
              <div className="w-10 h-10 rounded-xl bg-[#181924] border border-[#2b2e40] flex items-center justify-center text-blue-400">
                <Bot className="w-5 h-5 stroke-[1.8]" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-zinc-200 font-mono">
                  {worker.id.toUpperCase()}
                </h3>
                <span className="text-[10px] text-zinc-500 font-mono">Siap</span>
              </div>
            </div>
          )}

            {messages.map((m) => {
              const mSteps = m.steps || [];
              const explored = countExplored(mSteps);
              const ran = countCommands(mSteps);
              const edited = countEdited(mSteps);

              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  {m.sender === 'user' ? (
                    <div className="max-w-[85%] md:max-w-[70%] p-3.5 rounded-2xl bg-[#1d1f2b] border border-[#2b2e40] text-zinc-100 text-xs leading-relaxed shadow-lg">
                      <div className="whitespace-pre-wrap">{m.content}</div>
                    </div>
                  ) : (
                    <div className="w-full space-y-2 max-w-[95%] lg:max-w-[90%]">
                      {(mSteps.length > 0 || m.thinking || m.duration) && (
                        <AgentExecutionView
                          duration={m.duration || '1s'}
                          thinking={m.thinking}
                          steps={mSteps}
                        />
                      )}

                      {m.content && (
                        <div className="card p-4 text-xs leading-relaxed text-zinc-200 shadow-xl rounded-2xl border-[#232535] bg-[#14151f]">
                          <MarkdownMessageView content={m.content} />

                          {m.fileChanges && m.fileChanges.length > 0 ? (
                            <TurnFileChanges
                              files={m.fileChanges}
                              totalAdditions={m.totalAdditions}
                              totalDeletions={m.totalDeletions}
                              onSelectFile={(path) => {
                                setSelectedFilePath(path);
                                setIsRightSidebarOpen(true);
                              }}
                              onOpenReview={() => {
                                if (m.fileChanges && m.fileChanges.length > 0) {
                                  setSelectedFilePath(m.fileChanges[0].path);
                                }
                                setIsRightSidebarOpen(true);
                              }}
                            />
                          ) : null}

                          <div className="mt-3 pt-2 border-t border-[#1e202e] flex items-center justify-between text-zinc-500 text-[11px]">
                            <span>{m.timestamp}</span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleCopyMessage(m.id, m.content)}
                                className="p-1 rounded-md hover:text-zinc-300 transition-colors cursor-pointer"
                                title="Salin"
                              >
                                {copiedId === m.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button className="p-1 rounded-md hover:text-zinc-300 transition-colors cursor-pointer">
                                <ThumbsUp className="w-3.5 h-3.5" />
                              </button>
                              <button className="p-1 rounded-md hover:text-zinc-300 transition-colors cursor-pointer">
                                <ThumbsDown className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {isStreaming && (
              <div className="space-y-2 max-w-[95%] w-full">
                <AgentExecutionView
                  duration={`${elapsedSeconds}s`}
                  steps={currentSteps}
                  isLive={true}
                />

                {streamingDelta && (
                  <div className="card p-4 text-xs leading-relaxed text-zinc-100 shadow-xl rounded-2xl border-[#232535] bg-[#14151f]">
                    <div className="whitespace-pre-wrap">{streamingDelta}</div>
                  </div>
                )}
              </div>
            )}
          </div>

        <div className="shrink-0 p-3 sm:px-6 bg-[#0c0d12] border-t border-[#1a1b24] relative z-20">
          {showSlashMenu && (
            <SlashCommandsMenu
              filter={promptText.split(/\s+/).pop() || ''}
              onSelect={handleSelectSlashCommand}
              onClose={() => setShowSlashMenu(false)}
            />
          )}

          <div className="rounded-2xl bg-[#141520] border border-[#262838] shadow-2xl p-2.5 flex flex-col gap-2 relative">
            <textarea
              value={promptText}
              onChange={(e) => handlePromptInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Perintah..."
              rows={2}
              disabled={isStreaming}
              className="w-full bg-transparent px-2 pt-1 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none resize-none"
            />

            <div className="flex items-center justify-between pt-1 border-t border-[#1e202f]">
              <div className="flex items-center gap-1 sm:gap-1.5 min-w-0 pr-1">
                <button
                  type="button"
                  onClick={() => setIsAddContextOpen(true)}
                  className="p-1 sm:p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-[#1e202e] transition-colors cursor-pointer shrink-0"
                  title="Add Context"
                >
                  <Plus className="w-4 h-4 stroke-[2.2]" />
                </button>

                <div className="relative min-w-0">
                  <button
                    type="button"
                    onClick={() => setIsModelSheetOpen((prev) => !prev)}
                    onMouseEnter={() => setIsModelSheetOpen(true)}
                    className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-full bg-[#1b1c28] hover:bg-[#232535] text-zinc-300 text-[11px] font-medium border border-[#2c2f40] transition-colors cursor-pointer"
                  >
                    <span className="truncate max-w-[95px] sm:max-w-none">{activeModelObj.name}</span>
                    <span className="text-[10px] text-zinc-400 hidden sm:inline">{activeModelObj.badge}</span>
                    {isModelSheetOpen ? (
                      <ChevronUp className="w-3 h-3 text-zinc-400 ml-0.5 shrink-0" />
                    ) : (
                      <ChevronDown className="w-3 h-3 text-zinc-400 ml-0.5 shrink-0" />
                    )}
                  </button>

                  <ModelUsagePopover
                    isOpen={isModelSheetOpen}
                    onClose={() => setIsModelSheetOpen(false)}
                    selectedModel={selectedModel}
                    onSelectModel={(model) => setSelectedModel(model)}
                    workerId={worker.id}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleEnhancePrompt}
                  disabled={!promptText.trim() || isEnhancing}
                  className={`p-1.5 rounded-full border transition-all ${
                    isEnhancing
                      ? 'bg-purple-950/60 text-purple-300 border-purple-600/50 animate-pulse'
                      : promptText.trim()
                      ? 'text-purple-400 hover:text-purple-200 bg-purple-950/30 border-purple-800/40 hover:bg-purple-900/40 cursor-pointer'
                      : 'text-zinc-600 border-transparent cursor-not-allowed'
                  }`}
                  title="Sempurnakan"
                >
                  {isEnhancing ? (
                    <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                  ) : (
                    <Wand2 className="w-4 h-4 stroke-[2]" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  className={`p-1.5 rounded-full transition-all cursor-pointer ${
                    isListening
                      ? 'bg-rose-600 text-white animate-pulse ring-2 ring-rose-400 shadow-md'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1e202e]'
                  }`}
                  title={isListening ? 'Stop' : 'Voice'}
                >
                  <Mic className="w-4 h-4 stroke-[2]" />
                </button>
              </div>

              {isStreaming ? (
                <button
                  onClick={handleStop}
                  className="w-8 h-8 rounded-full bg-rose-600 hover:bg-rose-500 flex items-center justify-center text-white shadow-lg transition-transform active:scale-95 cursor-pointer"
                  title="Stop"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!promptText.trim()}
                  className="w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-600 flex items-center justify-center text-white shadow-lg transition-transform active:scale-95 cursor-pointer disabled:cursor-not-allowed"
                  title="Kirim"
                >
                  <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <CodeViewerPanel
        isOpen={isRightSidebarOpen}
        filePath={selectedFilePath}
        workerId={worker.id}
        userPicture={worker.picture}
        onClose={() => setIsRightSidebarOpen(false)}
        onToggleCollapse={() => setIsRightSidebarOpen(false)}
      />

      <AddContextSheet
        isOpen={isAddContextOpen}
        onClose={() => setIsAddContextOpen(false)}
        onSelect={(item) => {
          setPromptText((prev) => (prev ? `${prev} ${item.payload}` : item.payload));
        }}
      />

      <ProjectMetadataModal
        isOpen={isMetadataModalOpen}
        onClose={() => setIsMetadataModalOpen(false)}
        folderPath={activeWorkspaceUri || '/opt/data/home/agyremote'}
        metadata={projectMetadata}
        onMetadataUpdated={(newMeta) => setProjectMetadata(newMeta)}
      />
    </div>
  );
};
