import type { WorkerProfile, SystemVitals, ProcessItem, TranscriptItem, WorkerUsage, WorkerWorkspaceData, WorkspaceFolder, SkillItem, SkillDetail } from '../types/telemetry.ts';

const AUTH_STORAGE_KEY = 'agy_token';

export function getAuthToken(): string {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage.getItem(AUTH_STORAGE_KEY) || '';
  }
  return '';
}

export function setAuthToken(token: string): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(AUTH_STORAGE_KEY, token);
  }
}

export function clearAuthToken(): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  }
}

export async function validateAuthToken(token: string): Promise<boolean> {
  if (!token) return false;
  const res = await fetch('/api/system/vitals', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return res.ok;
}

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});
  if (!headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(endpoint, {
    ...options,
    headers
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`API error ${res.status}: ${errorText || res.statusText}`);
  }

  return res.json() as Promise<T>;
}

export async function fetchHealth(): Promise<{ status: string; uptime: number; timestamp: string }> {
  const res = await fetch('/api/health');
  if (!res.ok) throw new Error('Health check failed');
  return res.json();
}

export async function fetchVitals(): Promise<SystemVitals> {
  return apiRequest<SystemVitals>('/api/system/vitals');
}

export async function fetchWorkers(): Promise<WorkerProfile[]> {
  const data = await apiRequest<{ workers: WorkerProfile[] }>('/api/workers');
  return data.workers;
}

export async function fetchWorker(id: string): Promise<WorkerProfile> {
  return apiRequest<WorkerProfile>(`/api/workers/${id}`);
}

export async function fetchWorkerTranscripts(id: string): Promise<TranscriptItem[]> {
  const data = await apiRequest<{ id: string; transcripts: TranscriptItem[] }>(`/api/workers/${id}/transcripts`);
  return data.transcripts || [];
}

export async function fetchProcesses(): Promise<ProcessItem[]> {
  const data = await apiRequest<{ processes: ProcessItem[] }>('/api/processes');
  return data.processes || [];
}

export async function killProcess(pid: number): Promise<{ success: boolean; signal: string; pid: number }> {
  return apiRequest<{ success: boolean; signal: string; pid: number }>(`/api/processes/${pid}/kill`, {
    method: 'POST'
  });
}

export interface FileChangeItem {
  path: string;
  name: string;
  action: 'modified' | 'created' | 'deleted';
  timestamp?: string;
}

export interface WorkerFileChanges {
  worker: string;
  conversation_id: string;
  changes: FileChangeItem[];
  summary: {
    modified: number;
    created: number;
    deleted: number;
    total: number;
  };
}

export async function fetchWorkerChanges(id: string): Promise<WorkerFileChanges> {
  return apiRequest<WorkerFileChanges>(`/api/workers/${id}/changes`);
}

export async function activateWorker(id: string): Promise<{ success: boolean; message: string; worker?: WorkerProfile }> {
  return apiRequest<{ success: boolean; message: string; worker?: WorkerProfile }>(`/api/workers/${id}/activate`, {
    method: 'POST'
  });
}

export async function startWorkerLogin(id: string): Promise<{ success: boolean; authUrl: string; worker: string }> {
  return apiRequest<{ success: boolean; authUrl: string; worker: string }>(`/api/workers/${id}/auth/login`, {
    method: 'POST'
  });
}

export async function submitWorkerAuthCode(id: string, code: string): Promise<{ success: boolean; message: string; worker?: WorkerProfile }> {
  return apiRequest<{ success: boolean; message: string; worker?: WorkerProfile }>(`/api/workers/${id}/auth/submit`, {
    method: 'POST',
    body: JSON.stringify({ code })
  });
}

export async function logoutWorker(id: string): Promise<{ success: boolean; message: string; worker?: WorkerProfile }> {
  return apiRequest<{ success: boolean; message: string; worker?: WorkerProfile }>(`/api/workers/${id}/auth/logout`, {
    method: 'POST'
  });
}

export async function startWorkerDaemon(id: string): Promise<{ success: boolean; message: string; worker?: WorkerProfile }> {
  return apiRequest<{ success: boolean; message: string; worker?: WorkerProfile }>(`/api/workers/${id}/daemon/start`, {
    method: 'POST'
  });
}

export async function stopWorkerDaemon(id: string): Promise<{ success: boolean; message: string; worker?: WorkerProfile }> {
  return apiRequest<{ success: boolean; message: string; worker?: WorkerProfile }>(`/api/workers/${id}/daemon/stop`, {
    method: 'POST'
  });
}

export async function fetchWorkerDaemonStatus(id: string): Promise<{ running: boolean; pid?: number }> {
  return apiRequest<{ running: boolean; pid?: number }>(`/api/workers/${id}/daemon/status`);
}

export async function fetchAntigravityVersion(): Promise<{ version: string; binPath: string }> {
  return apiRequest<{ version: string; binPath: string }>('/api/antigravity/version');
}

export async function triggerAntigravityUpdate(): Promise<{ success: boolean; output: string; version: string }> {
  return apiRequest<{ success: boolean; output: string; version: string }>('/api/antigravity/update', {
    method: 'POST'
  });
}

export async function fetchAntigravityChangelog(): Promise<{ changelog: string }> {
  return apiRequest<{ changelog: string }>('/api/antigravity/changelog');
}

export async function fetchWorkerUsage(id: string): Promise<WorkerUsage> {
  return apiRequest<WorkerUsage>(`/api/workers/${id}/usage`);
}

export async function enhancePromptApi(
  prompt: string,
  workerId?: string
): Promise<{ success: boolean; enhancedPrompt: string; originalPrompt: string }> {
  return apiRequest<{ success: boolean; enhancedPrompt: string; originalPrompt: string }>('/api/prompt/enhance', {
    method: 'POST',
    body: JSON.stringify({ prompt, worker: workerId })
  });
}

export async function fetchWorkerConversations(workerId: string): Promise<WorkerWorkspaceData> {
  return apiRequest<WorkerWorkspaceData>(`/api/workers/${workerId}/conversations`);
}

export async function fetchConversationMessages(
  workerId: string,
  conversationId: string
): Promise<{ conversationId: string; messages: { id: string; sender: 'user' | 'agent'; content: string; timestamp: string }[] }> {
  return apiRequest<{ conversationId: string; messages: { id: string; sender: 'user' | 'agent'; content: string; timestamp: string }[] }>(
    `/api/workers/${workerId}/conversations/${conversationId}/messages`
  );
}

export async function createQuickFolderApi(
  workerId: string,
  folderName?: string
): Promise<{ success: boolean; folder: WorkspaceFolder }> {
  return apiRequest<{ success: boolean; folder: WorkspaceFolder }>(`/api/workers/${workerId}/folders/quick`, {
    method: 'POST',
    body: JSON.stringify({ folderName })
  });
}

export interface FileContentResult {
  path: string;
  name: string;
  content: string;
  language: string;
  lines: number;
  size: number;
}

export async function fetchFileContent(filePath: string, workerId?: string): Promise<FileContentResult> {
  const enc = encodeURIComponent(filePath);
  const endpoint = workerId ? `/api/workers/${workerId}/file?path=${enc}` : `/api/file?path=${enc}`;
  return apiRequest<FileContentResult>(endpoint);
}

export async function fetchSkills(): Promise<{ skills: SkillItem[]; workers: string[]; total: number }> {
  return apiRequest<{ skills: SkillItem[]; workers: string[]; total: number }>('/api/skills');
}

export async function fetchSkillDetail(name: string): Promise<SkillDetail> {
  return apiRequest<SkillDetail>(`/api/skills/${encodeURIComponent(name)}`);
}

export async function saveSkill(data: {
  name: string;
  description: string;
  content: string;
  targetWorkers: string[];
}): Promise<{ success: boolean; installedCount: number; name: string }> {
  return apiRequest<{ success: boolean; installedCount: number; name: string }>('/api/skills', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export async function installSkill(data: {
  source: string;
  type?: string;
  targetWorkers: string[];
}): Promise<{ success: boolean; installedCount: number; name: string }> {
  return apiRequest<{ success: boolean; installedCount: number; name: string }>('/api/skills/install', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export async function deleteSkill(name: string, targetWorkers?: string[]): Promise<{ success: boolean; deletedCount: number }> {
  return apiRequest<{ success: boolean; deletedCount: number }>(`/api/skills/${encodeURIComponent(name)}`, {
    method: 'DELETE',
    body: JSON.stringify({ targetWorkers })
  });
}

