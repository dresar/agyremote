import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Trash2,
  RefreshCw,
  Sparkles,
  Info,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import {
  type EnhancerConfig,
  type ApiKeyItem,
  loadEnhancerConfig,
  saveEnhancerConfig,
  syncDefaultGeminiKeys,
  testSingleApiKey,
  DEFAULT_GEMINI_KEYS
} from '../../services/promptEnhancer.ts';

export const PromptEnhancerSettings: React.FC = () => {
  const [config, setConfig] = useState<EnhancerConfig>(loadEnhancerConfig());
  const [newKeysInput, setNewKeysInput] = useState('');
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; msg: string } | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [showKeyList, setShowKeyList] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loaded = loadEnhancerConfig();
    if (loaded.keys.length === 0) {
      syncDefaultGeminiKeys().then((keys) => {
        const updated = {
          ...loaded,
          keys: [...loaded.keys, ...keys]
        };
        setConfig(updated);
        saveEnhancerConfig(updated);
      });
    } else {
      setConfig(loaded);
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        setActiveTooltip(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const showFeedback = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 2500);
  };

  const toggleTooltip = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveTooltip((prev) => (prev === id ? null : id));
  };

  const handleProviderChange = (provider: 'gemini' | 'bynara' | 'openai' | 'custom') => {
    let defaultModel = config.model;
    if (provider === 'bynara') defaultModel = 'stepfun-3.7-flash';
    else if (provider === 'gemini') defaultModel = 'gemini-3-flash-preview';
    else if (provider === 'openai') defaultModel = 'gpt-4o-mini';
    else if (provider === 'custom') defaultModel = 'deepseek-chat';

    const updated: EnhancerConfig = {
      ...config,
      provider,
      model: defaultModel
    };
    setConfig(updated);
    saveEnhancerConfig(updated);
    showFeedback(`${provider.toUpperCase()} aktif`);
  };

  const handleModelChange = (model: string) => {
    const updated: EnhancerConfig = { ...config, model };
    setConfig(updated);
    saveEnhancerConfig(updated);
  };

  const handleCustomBaseUrlChange = (url: string) => {
    const updated: EnhancerConfig = { ...config, customBaseUrl: url };
    setConfig(updated);
    saveEnhancerConfig(updated);
  };

  const handleToggleAutoRotate = () => {
    const updated: EnhancerConfig = { ...config, autoRotate: !config.autoRotate };
    setConfig(updated);
    saveEnhancerConfig(updated);
  };

  const handleAddKeys = () => {
    const lines = newKeysInput
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 5);

    if (lines.length === 0) return;

    const existingKeys = new Set(config.keys.map((k) => k.key));
    const newItems: ApiKeyItem[] = [];

    lines.forEach((keyStr, idx) => {
      if (!existingKeys.has(keyStr)) {
        existingKeys.add(keyStr);
        newItems.push({
          id: `key_${Date.now()}_${idx}`,
          key: keyStr,
          label: newKeyLabel.trim()
            ? (lines.length > 1 ? `${newKeyLabel.trim()} #${idx + 1}` : newKeyLabel.trim())
            : `${config.provider.toUpperCase()} #${config.keys.length + newItems.length + 1}`,
          provider: config.provider,
          status: 'active'
        });
      }
    });

    if (newItems.length > 0) {
      const updated: EnhancerConfig = {
        ...config,
        keys: [...newItems, ...config.keys]
      };
      setConfig(updated);
      saveEnhancerConfig(updated);
      setNewKeysInput('');
      setNewKeyLabel('');
      setShowAddForm(false);
      showFeedback(`+${newItems.length} kunci`);
    } else {
      showFeedback('Kunci sudah ada');
    }
  };

  const handleDeleteKey = (id: string) => {
    const updated: EnhancerConfig = {
      ...config,
      keys: config.keys.filter((k) => k.id !== id)
    };
    setConfig(updated);
    saveEnhancerConfig(updated);
    showFeedback('Dihapus');
  };

  const handleTestKey = async (item: ApiKeyItem) => {
    setTestingId(item.id);
    setTestResult(null);

    const res = await testSingleApiKey(item, config.model, config.customBaseUrl);
    setTestingId(null);
    setTestResult({ id: item.id, success: res.success, msg: res.message });

    const updatedKeys = config.keys.map((k) => {
      if (k.id === item.id) {
        return {
          ...k,
          status: (res.success ? 'tested' : 'error') as ApiKeyItem['status'],
          lastTested: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          errorMsg: res.success ? undefined : res.message
        };
      }
      return k;
    });

    const updated = { ...config, keys: updatedKeys };
    setConfig(updated);
    saveEnhancerConfig(updated);
  };

  const handleSyncDefaults = async () => {
    let defaults = await syncDefaultGeminiKeys();
    if (defaults.length === 0) {
      defaults = DEFAULT_GEMINI_KEYS;
    }
    const otherKeys = config.keys.filter((k) => k.provider !== 'gemini');
    const updated: EnhancerConfig = {
      ...config,
      keys: [...otherKeys, ...defaults]
    };
    setConfig(updated);
    saveEnhancerConfig(updated);
    showFeedback(`Sync ${defaults.length} akun Gemini`);
  };

  const providerKeys = config.keys.filter((k) => k.provider === config.provider);
  const activeKeysCount = providerKeys.filter((k) => k.status === 'active' || k.status === 'tested').length;

  const filteredKeys = providerKeys.filter((k) => {
    if (!searchFilter.trim()) return true;
    const term = searchFilter.toLowerCase();
    return k.label.toLowerCase().includes(term) || k.key.toLowerCase().includes(term);
  });

  return (
    <div className="card p-3 space-y-3 border-[#242636] bg-[#141520] rounded-2xl shadow-xl relative select-none">
      <div className="flex items-center justify-between gap-2 border-b border-[#1f2130] pb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <h3 className="text-xs font-bold text-zinc-100 font-mono tracking-tight truncate">
              API Keys
            </h3>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-purple-950/80 text-purple-300 border border-purple-800 shrink-0">
              {providerKeys.length}
            </span>
            <div className="relative">
              <button
                type="button"
                onClick={(e) => toggleTooltip('main', e)}
                className="text-zinc-500 hover:text-zinc-300 transition-colors p-0.5"
                title="Info"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
              {activeTooltip === 'main' && (
                <div
                  ref={tooltipRef}
                  className="absolute left-0 top-6 z-40 w-52 p-2 rounded-xl bg-[#1b1c28] border border-[#2c2f42] text-[10px] text-zinc-300 font-mono shadow-2xl animate-in fade-in"
                >
                  Rotasi multi-key untuk perbaikan prompt presisi tanpa format markdown.
                </div>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSyncDefaults}
          className="btn-deep py-1 px-2.5 text-[11px] font-mono font-medium text-zinc-300 hover:text-white rounded-lg flex items-center gap-1 shrink-0 cursor-pointer"
        >
          <RefreshCw className="w-3 h-3 text-blue-400" />
          <span>Sync Pool</span>
        </button>
      </div>

      {feedbackMsg && (
        <div className="p-1.5 px-2.5 rounded-lg bg-purple-950/50 border border-purple-800/60 text-[11px] text-purple-300 font-mono animate-in fade-in">
          {feedbackMsg}
        </div>
      )}

      <div className="space-y-2.5">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">
              Provider
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            <button
              type="button"
              onClick={() => handleProviderChange('bynara')}
              className={`py-1.5 px-1.5 rounded-xl border text-[11px] font-mono font-medium flex items-center justify-center gap-1 transition-all cursor-pointer ${
                config.provider === 'bynara'
                  ? 'bg-amber-600 text-white border-amber-500 shadow-md'
                  : 'bg-[#0e0f17] text-zinc-400 border-[#202230] hover:text-zinc-200'
              }`}
            >
              <span>ByNara</span>
              <span className="text-[10px] text-zinc-300">
                ({config.keys.filter((k) => k.provider === 'bynara').length})
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleProviderChange('gemini')}
              className={`py-1.5 px-1.5 rounded-xl border text-[11px] font-mono font-medium flex items-center justify-center gap-1 transition-all cursor-pointer ${
                config.provider === 'gemini'
                  ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                  : 'bg-[#0e0f17] text-zinc-400 border-[#202230] hover:text-zinc-200'
              }`}
            >
              <span>Gemini</span>
              <span className="text-[10px] text-zinc-300">
                ({config.keys.filter((k) => k.provider === 'gemini').length})
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleProviderChange('openai')}
              className={`py-1.5 px-1.5 rounded-xl border text-[11px] font-mono font-medium flex items-center justify-center gap-1 transition-all cursor-pointer ${
                config.provider === 'openai'
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                  : 'bg-[#0e0f17] text-zinc-400 border-[#202230] hover:text-zinc-200'
              }`}
            >
              <span>OpenAI</span>
              <span className="text-[10px] text-zinc-300">
                ({config.keys.filter((k) => k.provider === 'openai').length})
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleProviderChange('custom')}
              className={`py-1.5 px-1.5 rounded-xl border text-[11px] font-mono font-medium flex items-center justify-center gap-1 transition-all cursor-pointer ${
                config.provider === 'custom'
                  ? 'bg-purple-600 text-white border-purple-500 shadow-md'
                  : 'bg-[#0e0f17] text-zinc-400 border-[#202230] hover:text-zinc-200'
              }`}
            >
              <span>Custom</span>
              <span className="text-[10px] text-zinc-300">
                ({config.keys.filter((k) => k.provider === 'custom').length})
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">
                Model
              </span>
            </div>
            {config.provider === 'bynara' ? (
              <select
                value={config.model}
                onChange={(e) => handleModelChange(e.target.value)}
                className="w-full p-2 rounded-xl bg-[#0a0b10] border border-[#222432] text-xs text-zinc-100 font-mono focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="stepfun-3.7-flash">stepfun-3.7-flash (Aktif Free)</option>
                <option value="laguna-s-2.1">laguna-s-2.1 (Aktif Free)</option>
                <option value="step-5-preview">step-5-preview</option>
              </select>
            ) : config.provider === 'gemini' ? (
              <select
                value={config.model}
                onChange={(e) => handleModelChange(e.target.value)}
                className="w-full p-2 rounded-xl bg-[#0a0b10] border border-[#222432] text-xs text-zinc-100 font-mono focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="gemini-3-flash-preview">gemini-3-flash-preview</option>
                <option value="gemini-3.1-flash-lite-preview">gemini-3.1-flash-lite-preview</option>
                <option value="gemini-flash-latest">gemini-flash-latest</option>
                <option value="gemini-pro-latest">gemini-pro-latest</option>
              </select>
            ) : config.provider === 'openai' ? (
              <select
                value={config.model}
                onChange={(e) => handleModelChange(e.target.value)}
                className="w-full p-2 rounded-xl bg-[#0a0b10] border border-[#222432] text-xs text-zinc-100 font-mono focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="gpt-4o-mini">gpt-4o-mini</option>
                <option value="gpt-4o">gpt-4o</option>
                <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
              </select>
            ) : (
              <input
                type="text"
                value={config.model}
                onChange={(e) => handleModelChange(e.target.value)}
                placeholder="Model..."
                className="w-full p-2 rounded-xl bg-[#0a0b10] border border-[#222432] text-xs text-zinc-100 font-mono focus:outline-none focus:border-blue-500"
              />
            )}
          </div>

          <div className="flex items-center justify-between p-2 rounded-xl bg-[#0a0b10] border border-[#222432]">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-mono text-zinc-200">Auto-Rotasi</span>
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => toggleTooltip('rotate', e)}
                  className="text-zinc-500 hover:text-zinc-300 transition-colors p-0.5"
                >
                  <Info className="w-3 h-3" />
                </button>
                {activeTooltip === 'rotate' && (
                  <div
                    ref={tooltipRef}
                    className="absolute right-0 top-5 z-40 w-44 p-2 rounded-xl bg-[#1b1c28] border border-[#2c2f42] text-[10px] text-zinc-300 font-mono shadow-2xl animate-in fade-in"
                  >
                    Rotasi otomatis ke kunci lain jika kena rate limit atau error.
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={handleToggleAutoRotate}
              className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer shrink-0 ${
                config.autoRotate ? 'bg-purple-600' : 'bg-zinc-700'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  config.autoRotate ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {config.provider === 'custom' && (
          <div>
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono block mb-1">
              Base URL
            </span>
            <input
              type="text"
              value={config.customBaseUrl || ''}
              onChange={(e) => handleCustomBaseUrlChange(e.target.value)}
              placeholder="https://openrouter.ai/api/v1"
              className="w-full p-2 rounded-xl bg-[#0a0b10] border border-[#222432] text-xs text-zinc-100 font-mono focus:outline-none focus:border-blue-500"
            />
          </div>
        )}

        <div className="pt-0.5">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm((prev) => !prev)}
              className="text-xs font-mono text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Kunci</span>
              {showAddForm ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            <button
              type="button"
              onClick={() => setShowKeyList((prev) => !prev)}
              className="text-xs font-mono text-zinc-400 hover:text-zinc-200 flex items-center gap-1 cursor-pointer"
            >
              <span>Daftar ({filteredKeys.length})</span>
              <span className="text-emerald-400 text-[10px]">• {activeKeysCount}</span>
              {showKeyList ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>

          {showAddForm && (
            <div className="mt-2 p-2.5 rounded-xl bg-[#0a0b10] border border-[#202230] space-y-2 animate-in fade-in">
              <input
                type="text"
                value={newKeyLabel}
                onChange={(e) => setNewKeyLabel(e.target.value)}
                placeholder="Label (opsional)..."
                className="w-full p-1.5 px-2 rounded-lg bg-[#141520] border border-[#27293a] text-xs text-zinc-200 font-mono focus:outline-none focus:border-purple-500"
              />
              <textarea
                value={newKeysInput}
                onChange={(e) => setNewKeysInput(e.target.value)}
                rows={2}
                placeholder="Tempel key di sini (bisa multi-baris)..."
                className="w-full p-1.5 px-2 rounded-lg bg-[#141520] border border-[#27293a] text-xs text-zinc-200 font-mono focus:outline-none focus:border-purple-500 resize-none"
              />
              <button
                type="button"
                onClick={handleAddKeys}
                disabled={!newKeysInput.trim()}
                className="btn-deep-primary py-1 px-3 text-xs font-mono font-medium rounded-lg flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-3 h-3" />
                <span>Simpan</span>
              </button>
            </div>
          )}

          {showKeyList && (
            <div className="mt-2 space-y-1.5 animate-in fade-in">
              {providerKeys.length > 5 && (
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Cari..."
                  className="w-full p-1.5 px-2 rounded-lg bg-[#0a0b10] border border-[#202230] text-xs text-zinc-200 font-mono focus:outline-none focus:border-purple-500"
                />
              )}

              <div className="space-y-1 max-h-52 overflow-y-auto scrollbar-thin pr-0.5">
                {filteredKeys.length === 0 ? (
                  <div className="p-2 text-center text-xs text-zinc-500 font-mono">
                    Kosong
                  </div>
                ) : (
                  filteredKeys.map((item) => {
                    const maskedKey = item.key.length > 10
                      ? `${item.key.slice(0, 5)}..${item.key.slice(-3)}`
                      : '•••••';
                    const isTesting = testingId === item.id;

                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-1.5 p-1.5 px-2 rounded-lg bg-[#0a0b10] border border-[#1b1d28] text-xs font-mono"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              item.status === 'tested'
                                ? 'bg-blue-400'
                                : item.status === 'rate_limited'
                                ? 'bg-amber-400'
                                : item.status === 'error'
                                ? 'bg-rose-500'
                                : 'bg-emerald-400'
                            }`}
                          />
                          <span className="text-zinc-200 text-[11px] truncate font-medium">
                            {item.label}
                          </span>
                          <span className="text-[10px] text-zinc-500 truncate">
                            {maskedKey}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {testResult && testResult.id === item.id && (
                            <span
                              className={`text-[9px] ${
                                testResult.success ? 'text-emerald-400' : 'text-rose-400'
                              } max-w-[140px] truncate`}
                            >
                              {testResult.msg}
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => handleTestKey(item)}
                            disabled={isTesting}
                            className="btn-deep py-0.5 px-1.5 text-[10px] font-mono text-blue-300 rounded flex items-center gap-0.5 cursor-pointer disabled:opacity-50"
                          >
                            <RefreshCw className={`w-2.5 h-2.5 ${isTesting ? 'animate-spin' : ''}`} />
                            <span>{isTesting ? '...' : 'Uji'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteKey(item.id)}
                            className="p-1 rounded text-zinc-500 hover:text-rose-400 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
