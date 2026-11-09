export interface WorkerSubTask {
  name: string;
  details: string;
  pid?: number;
  status: string;
}

export interface WorkerProfile {
  id: string;
  name: string;
  email: string;
  authenticated: boolean;
  activeSession: string | null;
  status: 'idle' | 'running' | 'unauthenticated';
  hostname?: string;
  daemonActive?: boolean;
  picture?: string;
  activeTasks?: WorkerSubTask[];
}

export interface SystemVitals {
  cpu: {
    load1: number;
    load5: number;
    load15: number;
    cores: number;
  };
  memory: {
    total: number;
    free: number;
    used: number;
    percent: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    percent: number;
  };
  uptime: number;
}

export interface ProcessItem {
  pid: number;
  ppid: number;
  user: string;
  cpu: number;
  mem: number;
  command: string;
}

export interface TranscriptItem {
  conversation_id: string;
  started_at: string;
  last_updated_at: string;
  turn_count: number;
  first_prompt: string;
  last_response: string;
}

export interface PromptSSEEvent {
  type: 'start' | 'text_delta' | 'tool_status' | 'result' | 'error';
  worker?: string;
  text?: string;
  name?: string;
  state?: string;
  status?: string;
  summary?: string;
  conversation_id?: string;
  message?: string;
}

export interface WorkerUsage {
  workerId: string;
  email: string;
  authenticated: boolean;
  gemini: {
    weeklyPercentLeft: number;
    weeklyReset: string;
    fiveHourPercentLeft: number;
    fiveHourReset: string;
    weeklySteps?: number;
    fiveHourSteps?: number;
    totalSteps?: number;
  };
  claudeGpt: {
    weeklyPercentLeft: number;
    weeklyReset: string;
    fiveHourPercentLeft: number;
    fiveHourReset: string;
  };
}

export interface ConversationItem {
  id: string;
  title: string;
  preview: string;
  stepCount: number;
  lastModified: string;
  workspaceUri?: string;
}

export interface WorkspaceFolder {
  name: string;
  path: string;
  uri: string;
  conversations: ConversationItem[];
}

export interface SkillItem {
  name: string;
  description: string;
  workers: string[];
  path?: string;
}

export interface SkillDetail {
  name: string;
  description: string;
  content: string;
  workers: string[];
}

export interface WorkerWorkspaceData {
  workerId: string;
  folders: WorkspaceFolder[];
  nonProjectConversations: ConversationItem[];
}

export type TabType = 'overview' | 'workers' | 'transcripts' | 'console' | 'settings' | 'logs';
