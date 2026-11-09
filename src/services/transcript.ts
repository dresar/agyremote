import { fetchFileContent } from './api.ts';

export interface ExecutionStep {
  name: string;
  command?: string;
  summary?: string;
  path?: string;
  action?: string;
  state: string;
  output?: string;
  cwd?: string;
}

export interface FileChangeDetail {
  path: string;
  name: string;
  dir: string;
  action: 'modified' | 'created';
  additions: number;
  deletions: number;
}

export interface EnrichedTurn {
  userPrompt: string;
  agentResponse: string;
  duration?: string;
  thinking?: string;
  steps: ExecutionStep[];
  timestamp?: string;
  fileChanges?: FileChangeDetail[];
  totalAdditions?: number;
  totalDeletions?: number;
}

function cleanString(val: any): string {
  if (typeof val !== 'string') return '';
  let str = val.trim();
  if (str.startsWith('"') && str.endsWith('"')) {
    try {
      str = JSON.parse(str);
    } catch {}
  }
  return str;
}

function countLines(val: any): number {
  const str = cleanString(val);
  if (!str) return 0;
  return str.split('\n').length;
}

function extractFileInfo(filePath: string) {
  const norm = filePath.replace(/\\/g, '/');
  const lastSlash = norm.lastIndexOf('/');
  const name = lastSlash >= 0 ? norm.substring(lastSlash + 1) : norm;
  const dir = lastSlash >= 0 ? norm.substring(0, lastSlash) : '';
  return { name, dir };
}

function formatCwd(path?: string): string {
  if (!path) return '.../home/agyremote';
  if (path.includes('/home/')) {
    const parts = path.split('/home/');
    return `.../home/${parts[1]}`;
  }
  const segments = path.split('/').filter(Boolean);
  if (segments.length > 2) {
    return `.../${segments.slice(-2).join('/')}`;
  }
  return path;
}

export function parseTranscriptContent(rawContent: string): EnrichedTurn[] {
  const lines = rawContent.split('\n').filter((l) => l.trim().length > 0);
  const turns: EnrichedTurn[] = [];
  let currentTurn: (EnrichedTurn & { startTime?: string; endTime?: string }) | null = null;
  let fileChangesMap = new Map<string, FileChangeDetail>();

  const finalizeCurrentTurn = () => {
    if (!currentTurn) return;
    if (currentTurn.startTime && currentTurn.endTime) {
      const start = new Date(currentTurn.startTime).getTime();
      const end = new Date(currentTurn.endTime).getTime();
      if (!isNaN(start) && !isNaN(end) && end >= start) {
        const diffSec = Math.max(1, Math.round((end - start) / 1000));
        currentTurn.duration = `${diffSec}s`;
      }
    }
    const changes = Array.from(fileChangesMap.values());
    if (changes.length > 0) {
      currentTurn.fileChanges = changes;
      currentTurn.totalAdditions = changes.reduce((acc, c) => acc + c.additions, 0);
      currentTurn.totalDeletions = changes.reduce((acc, c) => acc + c.deletions, 0);
    }
    turns.push(currentTurn);
    fileChangesMap = new Map<string, FileChangeDetail>();
  };

  for (const line of lines) {
    try {
      const item = JSON.parse(line);
      const itype = item.type;

      if (itype === 'USER_INPUT') {
        finalizeCurrentTurn();

        let content = item.content || '';
        const match = content.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/);
        if (match) {
          content = match[1].trim();
        }

        currentTurn = {
          userPrompt: content,
          agentResponse: '',
          steps: [],
          thinking: '',
          startTime: item.created_at,
          endTime: '',
          duration: '',
          timestamp: item.created_at
            ? new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : ''
        };
      } else if (currentTurn) {
        if (itype === 'PLANNER_RESPONSE') {
          if (item.thinking) {
            currentTurn.thinking = item.thinking;
          }
          if (item.created_at) {
            currentTurn.endTime = item.created_at;
          }

          if (Array.isArray(item.tool_calls)) {
            for (const tc of item.tool_calls) {
              const args = tc.args || {};
              const cmd = cleanString(args.CommandLine);
              const summary = cleanString(args.toolSummary);
              const path = cleanString(args.Path || args.path);

              let action = '';
              if (tc.name === 'edit_file') {
                action = 'modified';
                if (path) {
                  const targetLines = countLines(args.Target);
                  const replacementLines = countLines(args.Replacement);
                  const { name, dir } = extractFileInfo(path);
                  const existing = fileChangesMap.get(path);
                  if (existing) {
                    existing.additions += replacementLines;
                    existing.deletions += targetLines;
                  } else {
                    fileChangesMap.set(path, {
                      path,
                      name,
                      dir,
                      action: 'modified',
                      additions: replacementLines,
                      deletions: targetLines
                    });
                  }
                }
              } else if (tc.name === 'write_file') {
                action = 'created';
                if (path) {
                  const contentLines = countLines(args.Content);
                  const { name, dir } = extractFileInfo(path);
                  const existing = fileChangesMap.get(path);
                  if (existing) {
                    existing.additions += contentLines;
                  } else {
                    fileChangesMap.set(path, {
                      path,
                      name,
                      dir,
                      action: 'created',
                      additions: contentLines,
                      deletions: 0
                    });
                  }
                }
              } else if (tc.name === 'read_file') {
                action = 'read';
              } else if (tc.name === 'run_command') {
                action = 'command';
              }

              currentTurn.steps.push({
                name: tc.name || 'tool',
                command: cmd,
                summary,
                path,
                action,
                state: 'DONE',
                output: '',
                cwd: formatCwd('/opt/data/home/agyremote')
              });
            }
          }

          if (item.content) {
            currentTurn.agentResponse = item.content;
            if (item.created_at) {
              currentTurn.endTime = item.created_at;
            }
          }
        } else if (itype === 'GENERIC' && currentTurn.steps.length > 0) {
          const rawOut = item.content || '';
          const match = rawOut.match(/Command output:\s*\n?([\s\S]*)/);
          let cleanOut = match ? match[1].trim() : rawOut.trim();
          if (cleanOut.startsWith('Created At:') && cleanOut.includes('Showing lines')) {
            const linesPart = cleanOut.match(new RegExp('Showing lines[\\s\\S]*'));
            if (linesPart) cleanOut = linesPart[0];
          }
          currentTurn.steps[currentTurn.steps.length - 1].output = cleanOut;
        }
      }
    } catch {}
  }

  finalizeCurrentTurn();

  return turns;
}

export async function fetchConversationTranscript(
  workerId: string,
  conversationId: string
): Promise<EnrichedTurn[]> {
  const transcriptPath = `/opt/data/home/agy-profiles/${workerId}/.gemini/antigravity-cli/brain/${conversationId}/.system_generated/logs/transcript.jsonl`;
  try {
    const res = await fetchFileContent(transcriptPath, workerId);
    if (res && res.content) {
      return parseTranscriptContent(res.content);
    }
  } catch {}
  return [];
}
