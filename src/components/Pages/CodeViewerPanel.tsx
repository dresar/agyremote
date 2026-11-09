import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Copy,
  Check,
  PanelRightClose,
  Maximize2,
  Minimize2,
  Pencil,
  MoreVertical,
  Loader2,
  FileCode2,
  Plus,
  ChevronDown
} from 'lucide-react';
import { LanguageIcon } from '../Common/LanguageIcon.tsx';
import { GoogleAvatar } from '../Common/GoogleAvatar.tsx';
import { fetchFileContent, type FileContentResult } from '../../services/api.ts';

interface CodeViewerPanelProps {
  filePath: string | null;
  workerId?: string;
  userPicture?: string;
  onClose: () => void;
  onToggleCollapse?: () => void;
  isOpen: boolean;
}

const KEYWORDS = new Set([
  'import', 'export', 'from', 'default', 'return', 'const', 'let', 'var',
  'function', 'interface', 'type', 'class', 'if', 'else', 'switch', 'case',
  'for', 'while', 'await', 'async', 'package', 'func', 'struct', 'go',
  'defer', 'select', 'range', 'new', 'typeof', 'boolean', 'string', 'number'
]);

function highlightCodeLine(line: string): React.ReactNode[] {
  if (line.trim().startsWith('//')) {
    return [<span key="cmt" className="text-zinc-500 italic">{line}</span>];
  }

  const parts: React.ReactNode[] = [];
  const regex = /("[^"]*"|'[^']*'|`[^`]*`|\b[a-zA-Z_$][a-zA-Z0-9_$]*\b|[0-9]+|[{}()[\]]|=>|===|==|!==|!=|[+\-*/=<>])/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      parts.push(line.slice(lastIndex, match.index));
    }
    const token = match[0];
    const key = `t_${match.index}_${token}`;

    if (token.startsWith('"') || token.startsWith("'") || token.startsWith('`')) {
      parts.push(<span key={key} className="text-emerald-400">{token}</span>);
    } else if (KEYWORDS.has(token)) {
      parts.push(<span key={key} className="text-purple-400 font-semibold">{token}</span>);
    } else if (/^[A-Z][a-zA-Z0-9_$]*$/.test(token)) {
      parts.push(<span key={key} className="text-sky-300 font-medium">{token}</span>);
    } else if (/^[0-9]+$/.test(token)) {
      parts.push(<span key={key} className="text-amber-400">{token}</span>);
    } else if (token === '=>' || token === '=' || token === '+' || token === '-') {
      parts.push(<span key={key} className="text-pink-400">{token}</span>);
    } else {
      parts.push(token);
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < line.length) {
    parts.push(line.slice(lastIndex));
  }

  return parts;
}

export const CodeViewerPanel: React.FC<CodeViewerPanelProps> = ({
  filePath,
  workerId,
  userPicture,
  onClose,
  onToggleCollapse,
  isOpen
}) => {
  const [fileData, setFileData] = useState<FileContentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [tabs, setTabs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string>('');

  useEffect(() => {
    if (filePath) {
      if (!tabs.includes(filePath)) {
        setTabs((prev) => [...prev, filePath]);
      }
      setActiveTab(filePath);
    }
  }, [filePath]);

  useEffect(() => {
    if (activeTab) {
      setLoading(true);
      fetchFileContent(activeTab, workerId)
        .then((res) => {
          setFileData(res);
        })
        .catch(() => {
          setFileData({
            path: activeTab,
            name: activeTab.split('/').pop() || activeTab,
            content: `${activeTab}\nContent unavailable`,
            language: 'plaintext',
            lines: 2,
            size: 0
          });
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setFileData(null);
    }
  }, [activeTab, workerId]);

  if (!isOpen) return null;

  const handleCopyCode = () => {
    if (fileData?.content) {
      navigator.clipboard.writeText(fileData.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCloseTab = (t: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const remaining = tabs.filter((item) => item !== t);
    setTabs(remaining);
    if (activeTab === t) {
      if (remaining.length > 0) {
        setActiveTab(remaining[remaining.length - 1]);
      } else {
        setActiveTab('');
        onClose();
      }
    }
  };

  const breadcrumbs = fileData?.path
    ? fileData.path.split('/').filter(Boolean)
    : activeTab
    ? activeTab.split('/').filter(Boolean)
    : [];

  const lines = fileData?.content ? fileData.content.split('\n') : [];

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-xs z-40 lg:hidden cursor-pointer"
        title="Tutup penampil berkas"
      />
      <div
        className={`bg-[#0d0e14] border-l border-[#1f212f] flex flex-col h-full shrink-0 transition-all duration-200 select-none ${
          isMaximized
            ? 'fixed inset-0 z-50 bg-[#0d0e14]'
            : 'fixed inset-y-0 right-0 z-50 w-full sm:max-w-md shadow-2xl lg:shadow-none lg:static lg:z-auto lg:w-[420px] xl:w-[500px]'
        }`}
      >
      <div className="flex items-center justify-between bg-[#12131d] border-b border-[#1f212f] px-2 h-10 shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none min-w-0 pr-2">
          {tabs.map((t) => {
            const fileName = t.split('/').pop() || t;
            const isActive = t === activeTab;
            return (
              <div
                key={t}
                onClick={() => setActiveTab(t)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-xs font-medium cursor-pointer shrink-0 transition-colors ${
                  isActive
                    ? 'bg-[#0d0e14] border-t-2 border-t-blue-500 border-x border-[#1f212f] text-zinc-100 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#181926]'
                }`}
              >
                <LanguageIcon filename={fileName} className="w-3.5 h-3.5" />
                <span className="truncate max-w-[120px] font-mono">{fileName}</span>
                <button
                  onClick={(e) => handleCloseTab(t, e)}
                  className="ml-1 p-0.5 rounded hover:bg-[#202232] text-zinc-400 hover:text-zinc-200 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
          {tabs.length === 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1 text-xs text-zinc-400 font-mono">
              <FileCode2 className="w-3.5 h-3.5" />
              <span>Editor Preview</span>
            </div>
          )}
          <button
            onClick={() => {}}
            className="p-1 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-[#1c1e2c] transition-colors cursor-pointer"
            title="Tambah Berkas"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 text-zinc-400">
          <button
            onClick={() => setIsMaximized((prev) => !prev)}
            className="p-1.5 rounded-lg hover:bg-[#1a1c2a] hover:text-zinc-200 transition-colors cursor-pointer"
            title={isMaximized ? 'Kecilkan' : 'Perbesar'}
          >
            {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="p-1.5 rounded-lg hover:bg-[#1a1c2a] hover:text-zinc-200 transition-colors cursor-pointer"
              title="Tutup Panel Kanan"
            >
              <PanelRightClose className="w-3.5 h-3.5" />
            </button>
          )}
          <div className="pl-1 shrink-0">
            <GoogleAvatar picture={userPicture} sizeClassName="w-6 h-6 rounded-full" />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between px-3 py-1.5 bg-[#10111a] border-b border-[#1a1b28] text-xs shrink-0 relative">
        <div className="flex items-center gap-2 text-xs font-mono min-w-0 pr-2">
          <FileCode2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span className="text-zinc-100 font-semibold truncate">
            {fileData?.name || (activeTab ? activeTab.split('/').pop() : 'Berkas')}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0 relative">
          <button
            onClick={handleCopyCode}
            disabled={!fileData?.content}
            className="flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-[#1c1e2d] text-zinc-300 hover:text-white transition-colors text-[11px] font-medium cursor-pointer"
            title="Salin Kode"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Tersalin' : 'Copy'}</span>
          </button>
          <div className="relative">
            <button
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className="p-1 rounded-md hover:bg-[#1c1e2d] text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
              title="Menu"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
            {isMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsMenuOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1 w-36 rounded-xl bg-[#141624] border border-[#2b2e42] shadow-xl py-1 z-50 text-xs">
                  <button
                    onClick={() => {
                      const target = fileData?.path || activeTab;
                      if (target) {
                        navigator.clipboard.writeText(target);
                        setCopiedPath(true);
                        setTimeout(() => setCopiedPath(false), 2000);
                      }
                      setIsMenuOpen(false);
                    }}
                    className="w-full px-3 py-1.5 text-left text-zinc-200 hover:bg-[#1e2136] hover:text-white flex items-center justify-between cursor-pointer"
                  >
                    <span>Salin Path</span>
                    {copiedPath && <Check className="w-3 h-3 text-emerald-400" />}
                  </button>
                  <button
                    onClick={() => {
                      handleCopyCode();
                      setIsMenuOpen(false);
                    }}
                    className="w-full px-3 py-1.5 text-left text-zinc-200 hover:bg-[#1e2136] hover:text-white flex items-center justify-between cursor-pointer"
                  >
                    <span>Salin Konten</span>
                    {copied && <Check className="w-3 h-3 text-emerald-400" />}
                  </button>
                  <div className="h-px bg-[#222538] my-1" />
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      onClose();
                    }}
                    className="w-full px-3 py-1.5 text-left text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                  >
                    <span>Tutup</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-[#0a0b10] font-mono text-xs text-zinc-200 scrollbar-thin select-text">
        {loading ? (
          <div className="flex items-center justify-center py-24 text-zinc-500 gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
            <span>Memuat berkas kode...</span>
          </div>
        ) : !fileData ? (
          <div className="flex flex-col items-center justify-center py-24 text-zinc-500 text-center px-4 space-y-2">
            <FileCode2 className="w-8 h-8 text-zinc-600 stroke-[1.5]" />
            <p className="text-xs">Pilih file perubahan di chat untuk melihat kode.</p>
          </div>
        ) : (
          <div className="py-2 min-w-max">
            {lines.map((line, idx) => {
              const lineNum = idx + 1;
              const isAdded = line.startsWith('+');
              const isDeleted = line.startsWith('-');

              return (
                <div
                  key={idx}
                  className={`flex items-start leading-5 px-2 hover:bg-[#141622] transition-colors group ${
                    isAdded
                      ? 'bg-emerald-950/30 text-emerald-300'
                      : isDeleted
                      ? 'bg-rose-950/30 text-rose-300'
                      : ''
                  }`}
                >
                  <div className="w-12 text-right pr-3 text-zinc-600 select-none shrink-0 font-mono text-[11px] flex items-center justify-end gap-1">
                    <ChevronDown className="w-2.5 h-2.5 opacity-0 group-hover:opacity-60 text-zinc-500" />
                    <span>{lineNum}</span>
                  </div>
                  <div className="whitespace-pre font-mono pr-4 min-w-0">
                    {highlightCodeLine(line)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
    </>
  );
};
