import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Download,
  Upload,
  Search,
  Check,
  Loader2,
  FileText,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Terminal,
  Layers
} from 'lucide-react';
import {
  fetchSkills,
  fetchSkillDetail,
  saveSkill,
  installSkill,
  deleteSkill
} from '../../services/api.ts';
import type { SkillItem, SkillDetail } from '../../types/telemetry.ts';

interface SkillManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialWorkerId?: string;
}

const ALL_WORKERS = Array.from({ length: 15 }, (_, i) => `agy${String(i + 1).padStart(2, '0')}`);

export const SkillManagerModal: React.FC<SkillManagerModalProps> = ({
  isOpen,
  onClose,
  initialWorkerId
}) => {
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'npx' | 'upload'>('list');
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterWorker, setFilterWorker] = useState<string>(initialWorkerId || 'all');

  const [selectedWorkers, setSelectedWorkers] = useState<string[]>(
    initialWorkerId ? [initialWorkerId] : ALL_WORKERS
  );

  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createContent, setCreateContent] = useState(
    '# Nama Skill\n\nPanduan dan instruksi operasional untuk worker Antigravity.\n\n## Aturan Baku\n1. Selalu patuhi standar penulisan kode.\n2. Terapkan efisiensi token.'
  );

  const [npxSource, setNpxSource] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadText, setUploadText] = useState('');

  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);
  const [skillDetail, setSkillDetail] = useState<SkillDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [actionLoading, setActionLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const loadData = () => {
    setLoading(true);
    fetchSkills()
      .then((res) => {
        setSkills(res.skills || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleWorkerSelection = (w: string) => {
    if (w === 'all') {
      if (selectedWorkers.length === ALL_WORKERS.length) {
        setSelectedWorkers([]);
      } else {
        setSelectedWorkers([...ALL_WORKERS]);
      }
      return;
    }
    if (selectedWorkers.includes(w)) {
      setSelectedWorkers(selectedWorkers.filter((item) => item !== w));
    } else {
      setSelectedWorkers([...selectedWorkers, w]);
    }
  };

  const handleToggleExpandSkill = async (name: string) => {
    if (expandedSkill === name) {
      setExpandedSkill(null);
      setSkillDetail(null);
      return;
    }
    setExpandedSkill(name);
    setLoadingDetail(true);
    try {
      const res = await fetchSkillDetail(name);
      setSkillDetail(res);
    } catch {
      setSkillDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCreateSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim() || actionLoading) return;
    setActionLoading(true);
    setStatusMsg(null);
    try {
      const res = await saveSkill({
        name: createName.trim(),
        description: createDesc.trim(),
        content: createContent,
        targetWorkers: selectedWorkers
      });
      setStatusMsg({ type: 'ok', text: `Skill tersimpan pada ${res.installedCount} worker` });
      setCreateName('');
      setCreateDesc('');
      loadData();
      setActiveTab('list');
    } catch (err: any) {
      setStatusMsg({ type: 'err', text: err?.message || 'Gagal menyimpan skill' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleInstallNpx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!npxSource.trim() || actionLoading) return;
    setActionLoading(true);
    setStatusMsg(null);
    try {
      const res = await installSkill({
        source: npxSource.trim(),
        type: npxSource.startsWith('http') ? 'git' : 'npx',
        targetWorkers: selectedWorkers
      });
      setStatusMsg({ type: 'ok', text: `Skill ${res.name} dipasang pada ${res.installedCount} worker` });
      setNpxSource('');
      loadData();
      setActiveTab('list');
    } catch (err: any) {
      setStatusMsg({ type: 'err', text: err?.message || 'Gagal memasang skill' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        setUploadText(text || '');
      };
      reader.readAsText(file);
    }
  };

  const handleUploadSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadText.trim() || actionLoading) return;
    setActionLoading(true);
    setStatusMsg(null);
    const rawName = uploadFile?.name.replace(/\.(md|txt|zip)$/i, '') || 'uploaded-skill';
    try {
      const res = await saveSkill({
        name: rawName,
        description: `Skill diunggah dari ${uploadFile?.name || 'file'}`,
        content: uploadText,
        targetWorkers: selectedWorkers
      });
      setStatusMsg({ type: 'ok', text: `Skill diunggah ke ${res.installedCount} worker` });
      setUploadFile(null);
      setUploadText('');
      loadData();
      setActiveTab('list');
    } catch (err: any) {
      setStatusMsg({ type: 'err', text: err?.message || 'Gagal mengunggah skill' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (name: string) => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      await deleteSkill(name, selectedWorkers.length > 0 ? selectedWorkers : undefined);
      setStatusMsg({ type: 'ok', text: `Skill ${name} dihapus` });
      if (expandedSkill === name) setExpandedSkill(null);
      loadData();
    } catch (err: any) {
      setStatusMsg({ type: 'err', text: err?.message || 'Gagal menghapus skill' });
    } finally {
      setActionLoading(false);
    }
  };

  const filteredSkills = skills.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesWorker =
      filterWorker === 'all' || s.workers.includes(filterWorker);
    return matchesSearch && matchesWorker;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-xs select-none">
      <div className="card w-full max-w-3xl max-h-[90vh] flex flex-col bg-[#12131d] border-[#292c3f] rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-[#202232] flex items-center justify-between bg-[#151724]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-zinc-100 font-mono">Skill</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#1e2030] text-blue-400 border border-[#2b2e44]">
                  {skills.length} Terpasang
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#1e2132] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1.5 px-4 pt-3 pb-2 bg-[#12131d] border-b border-[#1e202f] text-xs font-mono overflow-x-auto">
          <button
            onClick={() => setActiveTab('list')}
            className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer font-medium flex items-center gap-1.5 ${
              activeTab === 'list'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#181a28]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Daftar</span>
          </button>

          <button
            onClick={() => setActiveTab('create')}
            className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer font-medium flex items-center gap-1.5 ${
              activeTab === 'create'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#181a28]'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Buat</span>
          </button>

          <button
            onClick={() => setActiveTab('npx')}
            className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer font-medium flex items-center gap-1.5 ${
              activeTab === 'npx'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#181a28]'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>NPX / Git</span>
          </button>

          <button
            onClick={() => setActiveTab('upload')}
            className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer font-medium flex items-center gap-1.5 ${
              activeTab === 'upload'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#181a28]'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Unggah</span>
          </button>
        </div>

        {statusMsg && (
          <div
            className={`mx-4 mt-3 p-2.5 rounded-xl text-xs font-mono flex items-center justify-between ${
              statusMsg.type === 'ok'
                ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/50'
                : 'bg-rose-950/40 text-rose-400 border border-rose-800/50'
            }`}
          >
            <span>{statusMsg.text}</span>
            <button onClick={() => setStatusMsg(null)} className="cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {activeTab !== 'list' && (
          <div className="p-3 bg-[#10111a] border-b border-[#1c1d2c] space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-zinc-400 font-medium">Target Worker:</span>
              <button
                type="button"
                onClick={() => toggleWorkerSelection('all')}
                className="text-blue-400 hover:underline cursor-pointer text-[10px]"
              >
                {selectedWorkers.length === ALL_WORKERS.length ? 'Batal Semua' : 'Pilih Semua'}
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {ALL_WORKERS.map((w) => {
                const active = selectedWorkers.includes(w);
                return (
                  <button
                    key={w}
                    type="button"
                    onClick={() => toggleWorkerSelection(w)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-medium uppercase transition-colors cursor-pointer ${
                      active
                        ? 'bg-blue-600/30 text-blue-300 border border-blue-500/50'
                        : 'bg-[#181a26] text-zinc-500 border border-[#232536] hover:text-zinc-300'
                    }`}
                  >
                    {w}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
          {activeTab === 'list' && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 relative">
                  <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari nama atau deskripsi..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#0d0e15] border border-[#232536] text-xs text-zinc-100 font-mono placeholder:text-zinc-600 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <select
                  value={filterWorker}
                  onChange={(e) => setFilterWorker(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-[#0d0e15] border border-[#232536] text-xs text-zinc-300 font-mono focus:outline-none cursor-pointer"
                >
                  <option value="all">Semua Worker</option>
                  {ALL_WORKERS.map((w) => (
                    <option key={w} value={w}>
                      {w.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12 text-zinc-500 gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                  <span className="text-xs font-mono">Memuat...</span>
                </div>
              ) : filteredSkills.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 text-xs font-mono">
                  Tidak ada skill ditemukan.
                </div>
              ) : (
                <div className="divide-y divide-[#1c1d2c] border border-[#202232] rounded-xl bg-[#0f1018] overflow-hidden">
                  {filteredSkills.map((sk) => {
                    const isExpanded = expandedSkill === sk.name;
                    return (
                      <div key={sk.name} className="p-3 hover:bg-[#141522] transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs font-bold text-zinc-100">
                                {sk.name}
                              </span>
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                {sk.workers.length} Worker
                              </span>
                            </div>
                            {sk.description && (
                              <p className="text-[11px] text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                                {sk.description}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-1 mt-2">
                              {sk.workers.map((w) => (
                                <span
                                  key={w}
                                  className="text-[9px] font-mono px-1 rounded bg-[#181a26] text-zinc-400 border border-[#232536]"
                                >
                                  {w}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleToggleExpandSkill(sk.name)}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#1d1f30] transition-colors cursor-pointer text-xs"
                              title="Lihat Konten"
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              onClick={() => handleDelete(sk.name)}
                              className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="Hapus"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="mt-3 pt-3 border-t border-[#1d1f2e] space-y-2">
                            {loadingDetail ? (
                              <div className="flex items-center gap-2 text-zinc-500 text-xs font-mono py-2">
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                                <span>Memuat isi...</span>
                              </div>
                            ) : skillDetail ? (
                              <pre className="p-3 rounded-lg bg-[#0a0b10] border border-[#1e202f] text-[11px] font-mono text-zinc-300 leading-relaxed overflow-x-auto max-h-60 scrollbar-thin select-text">
                                {skillDetail.content}
                              </pre>
                            ) : (
                              <div className="text-xs text-zinc-500 font-mono">Gagal memuat detail berkas.</div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'create' && (
            <form onSubmit={handleCreateSkill} className="space-y-3 font-mono text-xs">
              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Nama Skill</label>
                <input
                  type="text"
                  required
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g. go-code-guard"
                  className="w-full p-2.5 rounded-xl bg-[#0d0e15] border border-[#232536] text-zinc-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Deskripsi Singkat</label>
                <input
                  type="text"
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                  placeholder="Deskripsi fungsi dan tujuan skill..."
                  className="w-full p-2.5 rounded-xl bg-[#0d0e15] border border-[#232536] text-zinc-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Instruksi SKILL.md</label>
                <textarea
                  rows={8}
                  required
                  value={createContent}
                  onChange={(e) => setCreateContent(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-[#0d0e15] border border-[#232536] text-zinc-100 font-mono text-[11px] leading-relaxed focus:outline-none focus:border-blue-500 select-text"
                />
              </div>

              <button
                type="submit"
                disabled={actionLoading || !createName.trim()}
                className="btn-deep-primary w-full py-2.5 rounded-xl font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>Simpan</span>
              </button>
            </form>
          )}

          {activeTab === 'npx' && (
            <form onSubmit={handleInstallNpx} className="space-y-3 font-mono text-xs">
              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Paket NPX atau URL Git</label>
                <input
                  type="text"
                  required
                  value={npxSource}
                  onChange={(e) => setNpxSource(e.target.value)}
                  placeholder="e.g. npx @antigravity/skill-audit atau https://github.com/..."
                  className="w-full p-2.5 rounded-xl bg-[#0d0e15] border border-[#232536] text-zinc-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="p-3 rounded-xl bg-[#0d0e15] border border-[#222434] text-[11px] text-zinc-400 space-y-1">
                <p className="font-semibold text-zinc-300">Format yang didukung:</p>
                <p>• NPX package: <code className="text-blue-400">npx @scope/skill-name</code></p>
                <p>• Git repository: <code className="text-blue-400">https://github.com/user/skill-repo.git</code></p>
              </div>

              <button
                type="submit"
                disabled={actionLoading || !npxSource.trim()}
                className="btn-deep-primary w-full py-2.5 rounded-xl font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Terminal className="w-4 h-4" />}
                <span>Pasang</span>
              </button>
            </form>
          )}

          {activeTab === 'upload' && (
            <form onSubmit={handleUploadSkill} className="space-y-3 font-mono text-xs">
              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Unggah Berkas SKILL.md</label>
                <input
                  type="file"
                  accept=".md,.txt"
                  onChange={handleFileChange}
                  className="w-full p-2 rounded-xl bg-[#0d0e15] border border-[#232536] text-zinc-300 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-blue-600 file:text-white cursor-pointer"
                />
              </div>

              {uploadText && (
                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">Pratinjau Isi</label>
                  <pre className="p-3 rounded-xl bg-[#0d0e15] border border-[#232536] text-[11px] text-zinc-300 max-h-48 overflow-y-auto leading-relaxed scrollbar-thin select-text">
                    {uploadText}
                  </pre>
                </div>
              )}

              <button
                type="submit"
                disabled={actionLoading || !uploadText.trim()}
                className="btn-deep-primary w-full py-2.5 rounded-xl font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                <span>Unggah</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
