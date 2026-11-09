import { fetchFileContent } from './api.ts';

export interface ApiKeyItem {
  id: string;
  key: string;
  label: string;
  provider: 'gemini' | 'bynara' | 'openai' | 'custom';
  status: 'active' | 'rate_limited' | 'error' | 'tested';
  lastTested?: string;
  errorMsg?: string;
}

export interface EnhancerConfig {
  provider: 'gemini' | 'bynara' | 'openai' | 'custom';
  model: string;
  customBaseUrl?: string;
  autoRotate: boolean;
  keys: ApiKeyItem[];
}

export interface ExternalChatMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

export interface ProjectFolderMetadata {
  projectName: string;
  rootPath: string;
  summary: string;
  techStack: string[];
  entryPoints: string[];
  rules: string[];
  updatedAt: string;
}

const STORAGE_KEY = 'agy_prompt_enhancer_config_v3';

const DEFAULT_BYNARA_KEYS: ApiKeyItem[] = [];
// Pool key ByNara: muat dari localStorage (tab Settings) / backend — JANGAN hardcode di repo publik

export const DEFAULT_GEMINI_KEYS: ApiKeyItem[] = [];
// Pool key Gemini: muat dari localStorage (tab Settings) — JANGAN hardcode di repo publik

const DEFAULT_CONFIG: EnhancerConfig = {
  provider: 'bynara',
  model: 'stepfun-3.7-flash',
  customBaseUrl: 'https://router.bynara.id/v1',
  autoRotate: true,
  keys: [...DEFAULT_BYNARA_KEYS, ...DEFAULT_GEMINI_KEYS]
};

export function cleanPromptOutput(raw: string): string {
  if (!raw) return '';
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/```[a-zA-Z0-9_-]*\n?/g, '');
  cleaned = cleaned.replace(/```/g, '');
  cleaned = cleaned.replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1');
  cleaned = cleaned.replace(/^#+\s+/gm, '');
  cleaned = cleaned.replace(/^[*\-+]\s+/gm, '- ');
  cleaned = cleaned.replace(/`([^`]+)`/g, '$1');
  cleaned = cleaned.replace(/<USER_REQUEST>[\s\S]*?<\/USER_REQUEST>/gi, '');
  cleaned = cleaned.replace(/<[^>]+>/g, '');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  return cleaned.trim();
}

export function loadEnhancerConfig(): EnhancerConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.keys)) {
        const geminiKeys = parsed.keys.filter((k: ApiKeyItem) => k.provider === 'gemini');
        const bynaraKeys = parsed.keys.filter((k: ApiKeyItem) => k.provider === 'bynara');
        const otherKeys = parsed.keys.filter((k: ApiKeyItem) => k.provider !== 'gemini' && k.provider !== 'bynara');
        const finalGemini = geminiKeys.length >= 40 ? geminiKeys : DEFAULT_GEMINI_KEYS;
        const finalBynara = bynaraKeys.length >= 3 ? bynaraKeys : DEFAULT_BYNARA_KEYS;
        return {
          ...DEFAULT_CONFIG,
          ...parsed,
          keys: [...finalBynara, ...finalGemini, ...otherKeys],
          model: parsed.provider === 'gemini' && (!parsed.model || parsed.model.includes('3.8') || parsed.model === 'gemini-3-flash')
            ? 'gemini-3.6-flash'
            : parsed.provider === 'bynara' && (!parsed.model || parsed.model.includes('deepseek'))
            ? 'stepfun-3.7-flash'
            : parsed.model || DEFAULT_CONFIG.model
        };
      }
    }
  } catch {}
  return { ...DEFAULT_CONFIG };
}

export function saveEnhancerConfig(cfg: EnhancerConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {}
}

export async function syncDefaultGeminiKeys(): Promise<ApiKeyItem[]> {
  try {
    const res = await fetchFileContent('/opt/data/home/agy-profiles/gemini_keys_pool.json', 'agy02');
    if (res && res.content) {
      const data = JSON.parse(res.content);
      if (Array.isArray(data.keys)) {
        const items: ApiKeyItem[] = data.keys.map((k: any, i: number) => ({
          id: `gemini_default_${i + 1}`,
          key: k.api_key || '',
          label: k.label ? k.label.split('@')[0] : `Gemini #${i + 1}`,
          provider: 'gemini' as const,
          status: 'active' as const
        }));
        return items.filter((item) => item.key.length > 5);
      }
    }
  } catch {}
  return [];
}

export async function ensureEnhancerConfig(): Promise<EnhancerConfig> {
  const cfg = loadEnhancerConfig();
  if (cfg.keys.length === 0) {
    const defaultKeys = await syncDefaultGeminiKeys();
    cfg.keys = [...DEFAULT_BYNARA_KEYS, ...defaultKeys];
    saveEnhancerConfig(cfg);
  }
  return cfg;
}

export async function testSingleApiKey(
  keyItem: ApiKeyItem,
  modelName: string,
  customBaseUrl?: string
): Promise<{ success: boolean; message: string }> {
  if (keyItem.provider === 'gemini') {
    let targetModel = modelName || 'gemini-3-flash-preview';
    if (!targetModel || targetModel.includes('3.6') || targetModel.includes('3.8') || targetModel.includes('3-flash')) {
      targetModel = 'gemini-3-flash-preview';
    } else if (targetModel.includes('lite')) {
      targetModel = 'gemini-3.1-flash-lite-preview';
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${encodeURIComponent(keyItem.key)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Balas: READY' }] }]
        }),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const errMsg = errJson?.error?.message || `HTTP ${res.status}`;
        return { success: false, message: errMsg.slice(0, 45) };
      }

      return { success: true, message: 'Aktif' };
    } catch (err: any) {
      clearTimeout(timeout);
      return { success: false, message: err.message || 'Timeout' };
    }
  }

  if (keyItem.provider === 'bynara') {
    try {
      const meController = new AbortController();
      const meTimeout = setTimeout(() => meController.abort(), 6000);
      const meRes = await fetch('https://router.bynara.id/v1/me', {
        headers: { Authorization: `Bearer ${keyItem.key}` },
        signal: meController.signal
      });
      clearTimeout(meTimeout);
      if (meRes.ok) {
        const meData = await meRes.json();
        const plan = meData?.account?.plan || 'Free';
        const model = meData?.models?.[0] || 'stepfun-3.7-flash';
        return { success: true, message: `Aktif (${plan} • ${model})` };
      }
    } catch {}
  }

  let endpoint = 'https://api.openai.com/v1/chat/completions';
  if (keyItem.provider === 'bynara') {
    endpoint = 'https://router.bynara.id/v1/chat/completions';
  } else if (keyItem.provider === 'custom' && customBaseUrl) {
    endpoint = `${customBaseUrl.replace(/\/+$/, '')}/chat/completions`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    const targetModel = modelName || (keyItem.provider === 'bynara' ? 'stepfun-3.7-flash' : 'gpt-4o-mini');
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${keyItem.key}`
      },
      body: JSON.stringify({
        model: targetModel,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 5
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      const errMsg = errJson?.error?.message || `HTTP ${res.status}`;
      return { success: false, message: errMsg.slice(0, 45) };
    }

    return { success: true, message: 'Aktif' };
  } catch (err: any) {
    clearTimeout(timeout);
    return { success: false, message: err.message || 'Timeout' };
  }
}

export async function enhancePromptWithRotation(
  rawPrompt: string,
  projectContext?: string
): Promise<{ success: boolean; enhancedPrompt: string; providerUsed: string; keyUsed: string }> {
  const trimmed = rawPrompt.trim();
  if (!trimmed) {
    return { success: false, enhancedPrompt: '', providerUsed: '', keyUsed: '' };
  }

  const cfg = await ensureEnhancerConfig();
  const activeKeys = cfg.keys.filter((k) => k.provider === cfg.provider && k.status !== 'error');

  const systemContext = projectContext || 'AgyRemote Antigravity Remote Dashboard & IDE Editor. React 18, Vite, Tailwind CSS, TypeScript, Go 1.22 backend port 8787. NOKOMEN standard, token-efficient, responsive mobile.';

  const instructionText = `Anda adalah seorang Software Architect dan Senior Prompt Engineer.
Tugas Anda adalah menulis ulang dan menyempurnakan draf instruksi pengguna berikut menjadi instruksi coding agent yang presisi, terstruktur, mendalam, dan langsung dapat dieksekusi.

ATURAN MUTLAK:
1. WAJIB MENGGUNAKAN BAHASA INDONESIA YANG JELAS, PROFESIONAL, DAN MUDAH DIPAHAMI.
2. TULISKAN HANYA TEKS HASIL PROMPT YANG DISEMPURNAKAN. DILARANG MENAMBAHKAN KATA PENGANTAR, PENJELASAN AWAL/AKHIR, SALAM, ATAU BASA-BASI.
3. JANGAN GUNAKAN SIMBOL MARKDOWN ASTERIS (** atau *), JANGAN GUNAKAN TANDA PAGAR (#) ATAU BACKTICK. GUNAKAN TEKS POLOS DENGAN POIN ATAU PENOMORAN MINIMALIS.
4. Sertakan konteks proyek secara tepat:
${systemContext}

PERMINTAAN PENGGUNA:
${trimmed}`;

  for (let i = 0; i < activeKeys.length; i++) {
    const keyItem = activeKeys[i];
    try {
      if (cfg.provider === 'gemini') {
        let targetModel = cfg.model || 'gemini-3-flash-preview';
        if (!targetModel || targetModel.includes('3.6') || targetModel.includes('3.8') || targetModel.includes('3-flash')) {
          targetModel = 'gemini-3-flash-preview';
        } else if (targetModel.includes('lite')) {
          targetModel = 'gemini-3.1-flash-lite-preview';
        }
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${encodeURIComponent(keyItem.key)}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: instructionText }] }]
          }),
          signal: controller.signal
        });
        clearTimeout(timeout);

        if (res.status === 429) {
          keyItem.status = 'rate_limited';
          saveEnhancerConfig(cfg);
          continue;
        }

        if (!res.ok) {
          keyItem.status = 'error';
          saveEnhancerConfig(cfg);
          continue;
        }

        const data = await res.json();
        const textOut = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (textOut && textOut.trim().length > 15) {
          keyItem.status = 'active';
          saveEnhancerConfig(cfg);
          return {
            success: true,
            enhancedPrompt: cleanPromptOutput(textOut),
            providerUsed: 'gemini',
            keyUsed: keyItem.label || `Key #${i + 1}`
          };
        }
      } else {
        let endpoint = 'https://api.openai.com/v1/chat/completions';
        if (cfg.provider === 'bynara') {
          endpoint = 'https://router.bynara.id/v1/chat/completions';
        } else if (cfg.provider === 'custom' && cfg.customBaseUrl) {
          endpoint = `${cfg.customBaseUrl.replace(/\/+$/, '')}/chat/completions`;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        const targetModel = cfg.model || (cfg.provider === 'bynara' ? 'stepfun-3.7-flash' : 'gpt-4o-mini');
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${keyItem.key}`
          },
          body: JSON.stringify({
            model: targetModel,
            messages: [{ role: 'user', content: instructionText }],
            max_tokens: 800
          }),
          signal: controller.signal
        });
        clearTimeout(timeout);

        if (res.status === 429) {
          keyItem.status = 'rate_limited';
          saveEnhancerConfig(cfg);
          continue;
        }

        if (!res.ok) {
          keyItem.status = 'error';
          saveEnhancerConfig(cfg);
          continue;
        }

        const data = await res.json();
        const textOut = data?.choices?.[0]?.message?.content;
        if (textOut && textOut.trim().length > 15) {
          keyItem.status = 'active';
          saveEnhancerConfig(cfg);
          return {
            success: true,
            enhancedPrompt: cleanPromptOutput(textOut),
            providerUsed: cfg.provider,
            keyUsed: keyItem.label || `Key #${i + 1}`
          };
        }
      }
    } catch {
      keyItem.status = 'error';
      saveEnhancerConfig(cfg);
    }
  }

  const fallback = `Instruksi Pengembangan Terstruktur:
Sasaran: ${trimmed}
Konteks: ${systemContext}
Standar Teknis:
1. Analisis arsitektur dan dependensi proyek secara mendalam sebelum mengeksekusi perubahan.
2. Patuhi standar NOKOMEN dan prinsip efisiensi token.
3. Pastikan kompatibilitas mobile-first dan integritas seluruh suite pengujian.`;

  return {
    success: true,
    enhancedPrompt: cleanPromptOutput(fallback),
    providerUsed: 'fallback',
    keyUsed: 'Template Internal'
  };
}

export async function queryExternalAiChat(
  messages: ExternalChatMessage[],
  projectContext?: string,
  overrideConfig?: { provider?: 'gemini' | 'bynara' | 'openai' | 'custom'; model?: string }
): Promise<{ success: boolean; content: string; error?: string }> {
  const cfg = await ensureEnhancerConfig();
  const targetProvider = overrideConfig?.provider || cfg.provider || 'bynara';
  const targetModel = overrideConfig?.model || cfg.model || (targetProvider === 'bynara' ? 'stepfun-3.7-flash' : 'gemini-3.8-flash');

  try {
    const token = localStorage.getItem('agy_admin_auth_token') || 'REPLACE_WITH_LIVE_BEARER_TOKEN';
    const bRes = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        model: targetModel,
        provider: targetProvider
      })
    });
    if (bRes.ok) {
      const bData = await bRes.json();
      if (bData && bData.content) {
        return { success: true, content: bData.content };
      }
    }
  } catch {}

  const activeKeys = cfg.keys.filter((k) => k.provider === targetProvider && k.status !== 'error');
  if (activeKeys.length === 0) {
    return { success: false, content: '', error: 'Tidak ada API Key aktif' };
  }

  const systemPrompt = `You are AgyRemote AI Brain — Senior AI Staff Architect & Technical Engineering Partner in AgyRemote (remote.agentai.my.id).
The owner is a Senior Developer & System Architect.
Do NOT give overly brief or cut-off answers. Never restrict replies for token saving in this discussion room.
Give comprehensive, articulate, friendly, and complete answers in natural Indonesian or technical terms. Explain context thoroughly with high technical depth.`;

  for (let i = 0; i < activeKeys.length; i++) {
    const keyItem = activeKeys[i];
    try {
      if (targetProvider === 'gemini') {
        let gemModel = targetModel;
        if (!gemModel || gemModel.includes('3.6') || gemModel.includes('3.8') || gemModel.includes('3-flash')) {
          gemModel = 'gemini-3-flash-preview';
        } else if (gemModel.includes('lite')) {
          gemModel = 'gemini-3.1-flash-lite-preview';
        }
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${gemModel}:generateContent?key=${encodeURIComponent(keyItem.key)}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);
        const contents = [
          { role: 'user', parts: [{ text: systemPrompt }] },
          ...messages.map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
          }))
        ];
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents }),
          signal: controller.signal
        });
        clearTimeout(timeout);
        if (res.ok) {
          const data = await res.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) return { success: true, content: text };
        }
      } else {
        let endpoint = 'https://api.openai.com/v1/chat/completions';
        if (targetProvider === 'bynara') {
          endpoint = 'https://router.bynara.id/v1/chat/completions';
        } else if (targetProvider === 'custom' && cfg.customBaseUrl) {
          endpoint = `${cfg.customBaseUrl.replace(/\/+$/, '')}/chat/completions`;
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 25000);
        const reqMessages = [
          { role: 'system', content: systemPrompt },
          ...messages.map((m) => ({ role: m.role, content: m.content }))
        ];
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${keyItem.key}`
          },
          body: JSON.stringify({
            model: targetModel,
            messages: reqMessages,
            max_tokens: 1500
          }),
          signal: controller.signal
        });
        clearTimeout(timeout);
        if (res.ok) {
          const data = await res.json();
          const text = data?.choices?.[0]?.message?.content;
          if (text) return { success: true, content: text };
        }
      }
    } catch {}
  }
  return { success: false, content: '', error: 'Gagal mendapatkan respon dari AI' };
}

export function getDefaultProjectMetadata(folderPath: string): ProjectFolderMetadata {
  const isBackend = folderPath.includes('backend');
  if (isBackend) {
    return {
      projectName: 'AgyRemote Backend',
      rootPath: folderPath,
      summary: 'Go 1.22 stdlib net/http REST & SSE daemon server untuk orkestrasi cluster worker Antigravity.',
      techStack: ['Go 1.22', 'net/http', 'SSE Streaming', 'Cloudflare Tunnel'],
      entryPoints: ['cmd/server/main.go', 'internal/workers/workers.go'],
      rules: ['NOKOMEN (0 comments)', 'Memori < 20 MB', 'Bearer token protection'],
      updatedAt: new Date().toLocaleDateString('id-ID')
    };
  }
  return {
    projectName: 'AgyRemote Frontend',
    rootPath: folderPath,
    summary: 'Dashboard remote control & web IDE Antigravity terintegrasi.',
    techStack: ['React 18', 'TypeScript', 'Tailwind CSS', 'Vite'],
    entryPoints: ['src/components/Pages/PromptPage.tsx', 'src/App.tsx'],
    rules: ['NOKOMEN (0 comments)', 'simpel-text (1-2 kata)', 'Mobile-first 100% fullwidth'],
    updatedAt: new Date().toLocaleDateString('id-ID')
  };
}

export function loadProjectMetadata(folderPath: string): ProjectFolderMetadata {
  try {
    const key = `agy_meta_${folderPath.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch {}
  return getDefaultProjectMetadata(folderPath);
}

export function saveProjectMetadata(folderPath: string, meta: ProjectFolderMetadata): void {
  try {
    const key = `agy_meta_${folderPath.replace(/[^a-zA-Z0-9]/g, '_')}`;
    localStorage.setItem(key, JSON.stringify(meta));
  } catch {}
}

export async function analyzeAndSaveProjectMetadata(
  folderPath: string,
  filesSummary?: string
): Promise<ProjectFolderMetadata> {
  try {
    const token = localStorage.getItem('agy_admin_auth_token') || 'REPLACE_WITH_LIVE_BEARER_TOKEN';
    const bRes = await fetch(`/api/project/meta?path=${encodeURIComponent(folderPath)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (bRes.ok) {
      const bMeta = await bRes.json();
      if (bMeta && bMeta.projectName) {
        saveProjectMetadata(folderPath, bMeta);
        return bMeta;
      }
    }
  } catch {}

  const prompt = `Analisis folder proyek berikut dan ekstrak metadata terstruktur dalam format JSON valid murni (tanpa pembuka/penutup markdown):
Folder: ${folderPath}
Berkas Kunci: ${filesSummary || 'src/, cmd/, internal/, package.json, main.go, README.md'}

Output JSON schema persis:
{
  "projectName": "string",
  "rootPath": "${folderPath}",
  "summary": "string ringkas 1 kalimat",
  "techStack": ["item1", "item2"],
  "entryPoints": ["file1", "file2"],
  "rules": ["rule1", "rule2"],
  "updatedAt": "${new Date().toLocaleDateString('id-ID')}"
}`;

  const res = await queryExternalAiChat([{ role: 'user', content: prompt }]);
  if (res.success && res.content) {
    try {
      let cleaned = res.content.trim();
      cleaned = cleaned.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(cleaned);
      if (parsed && parsed.projectName) {
        const meta: ProjectFolderMetadata = {
          projectName: parsed.projectName,
          rootPath: folderPath,
          summary: parsed.summary || '',
          techStack: Array.isArray(parsed.techStack) ? parsed.techStack : [],
          entryPoints: Array.isArray(parsed.entryPoints) ? parsed.entryPoints : [],
          rules: Array.isArray(parsed.rules) ? parsed.rules : [],
          updatedAt: new Date().toLocaleDateString('id-ID')
        };
        saveProjectMetadata(folderPath, meta);
        return meta;
      }
    } catch {}
  }

  const fallback = getDefaultProjectMetadata(folderPath);
  saveProjectMetadata(folderPath, fallback);
  return fallback;
}
