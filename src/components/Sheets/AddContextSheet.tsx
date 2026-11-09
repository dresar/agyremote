import React, { useState } from 'react';
import { BottomSheet } from './BottomSheet.tsx';
import {
  Paperclip,
  Folder,
  AtSign,
  Zap,
  Globe,
  ChevronRight,
  ArrowLeft,
  Check
} from 'lucide-react';

interface AddContextSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectContext: (text: string) => void;
}

type ContextSection = 'main' | 'files' | 'folder' | 'mentions' | 'actions' | 'browser';

export const AddContextSheet: React.FC<AddContextSheetProps> = ({
  isOpen,
  onClose,
  onSelectContext
}) => {
  const [section, setSection] = useState<ContextSection>('main');
  const [customInput, setCustomInput] = useState('');

  const handleSelect = (snippet: string) => {
    onSelectContext(snippet);
    setSection('main');
    setCustomInput('');
    onClose();
  };

  const handleCustomSubmit = () => {
    if (!customInput.trim()) return;
    handleSelect(customInput.trim());
  };

  const menuItems = [
    {
      id: 'files' as const,
      icon: Paperclip,
      label: 'Files',
      desc: 'Sertakan file sumber atau path berkas',
      iconColor: 'text-blue-400'
    },
    {
      id: 'folder' as const,
      icon: Folder,
      label: 'Folder',
      desc: 'Pilih direktori kerja atau modul',
      iconColor: 'text-amber-400'
    },
    {
      id: 'mentions' as const,
      icon: AtSign,
      label: 'Mentions',
      desc: 'Sebut worker atau subagent (@agy01 - @agy15)',
      iconColor: 'text-purple-400'
    },
    {
      id: 'actions' as const,
      icon: Zap,
      label: 'Actions',
      desc: 'Makro eksekusi cepat (plan, boost, teamwork)',
      iconColor: 'text-emerald-400'
    },
    {
      id: 'browser' as const,
      icon: Globe,
      label: 'Browser',
      desc: 'URL dokumentasi atau web search context',
      iconColor: 'text-cyan-400'
    }
  ];

  const quickFiles = [
    'src/App.tsx',
    'src/components/Pages/PromptPage.tsx',
    'src/services/api.ts',
    'package.json',
    'server/index.ts',
    'vite.config.ts'
  ];

  const quickFolders = [
    '/opt/data/home/agyremote',
    '/opt/data/home/AgyRemoteTele',
    '/opt/data/home/agyremote/src',
    '/opt/data/home/agyremote/server'
  ];

  const workersList = Array.from({ length: 15 }, (_, i) => {
    const num = String(i + 1).padStart(2, '0');
    return `agy${num}`;
  });

  const quickActions = [
    { cmd: '/plan', label: 'Rancang rencana implementasi terstruktur' },
    { cmd: '/boost', label: 'Optimasi performa & eliminasi bottleneck' },
    { cmd: '/learn', label: 'Audit codebase & identifikasi pola' },
    { cmd: '/teamwork', label: 'Sinkronisasi tugas antar worker' },
    { cmd: '/clean', label: 'Bersihkan komentar redundan & dead code' }
  ];

  const getTitle = () => {
    switch (section) {
      case 'files':
        return 'Add Context: Files';
      case 'folder':
        return 'Add Context: Folder';
      case 'mentions':
        return 'Add Context: Mentions';
      case 'actions':
        return 'Add Context: Actions';
      case 'browser':
        return 'Add Context: Browser';
      default:
        return 'Add Context';
    }
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={() => {
        setSection('main');
        onClose();
      }}
      title={getTitle()}
    >
      {section !== 'main' && (
        <button
          onClick={() => setSection('main')}
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 mb-3 px-1 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Kembali ke menu</span>
        </button>
      )}

      {section === 'main' && (
        <div className="divide-y divide-[#20222a] rounded-lg border border-[#272832] bg-[#121318] overflow-hidden">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className="w-full flex items-center justify-between px-3.5 py-3 hover:bg-[#1a1b22] active:bg-[#16171d] transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-[#181920] border border-[#272832]">
                    <Icon className={`w-4 h-4 ${item.iconColor}`} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-zinc-100 font-sans">
                      {item.label}
                    </div>
                    <div className="text-[11px] text-zinc-400 font-sans">
                      {item.desc}
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
              </button>
            );
          })}
        </div>
      )}

      {section === 'files' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="Ketik path berkas..."
              className="flex-1 p-2 rounded-md bg-[#121318] border border-[#272832] text-xs text-zinc-100 placeholder:text-zinc-500 font-mono focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={handleCustomSubmit}
              disabled={!customInput.trim()}
              className="btn-deep-primary px-3 text-xs font-semibold disabled:opacity-40"
            >
              Tambah
            </button>
          </div>
          <div className="space-y-1">
            <div className="text-[10px] font-semibold uppercase text-zinc-400 font-mono px-1">
              Berkas Sering Digunakan
            </div>
            <div className="rounded-lg border border-[#272832] bg-[#121318] divide-y divide-[#20222a] overflow-hidden">
              {quickFiles.map((file) => (
                <button
                  key={file}
                  onClick={() => handleSelect(`@file:${file}`)}
                  className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-[#1a1b22] text-xs font-mono text-zinc-200"
                >
                  <span className="truncate">{file}</span>
                  <Paperclip className="w-3.5 h-3.5 text-zinc-500" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {section === 'folder' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="Path direktori..."
              className="flex-1 p-2 rounded-md bg-[#121318] border border-[#272832] text-xs text-zinc-100 placeholder:text-zinc-500 font-mono focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={handleCustomSubmit}
              disabled={!customInput.trim()}
              className="btn-deep-primary px-3 text-xs font-semibold disabled:opacity-40"
            >
              Pilih
            </button>
          </div>
          <div className="space-y-1">
            <div className="text-[10px] font-semibold uppercase text-zinc-400 font-mono px-1">
              Direktori Workspace
            </div>
            <div className="rounded-lg border border-[#272832] bg-[#121318] divide-y divide-[#20222a] overflow-hidden">
              {quickFolders.map((fld) => (
                <button
                  key={fld}
                  onClick={() => handleSelect(`@dir:${fld}`)}
                  className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-[#1a1b22] text-xs font-mono text-zinc-200"
                >
                  <span className="truncate">{fld}</span>
                  <Folder className="w-3.5 h-3.5 text-amber-500" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {section === 'mentions' && (
        <div className="space-y-2">
          <div className="text-[10px] font-semibold uppercase text-zinc-400 font-mono px-1">
            Pilih Agent Worker
          </div>
          <div className="grid grid-cols-3 gap-2">
            {workersList.map((wId) => (
              <button
                key={wId}
                onClick={() => handleSelect(`@${wId}`)}
                className="btn-deep p-2 text-xs font-mono font-bold uppercase tracking-wider text-zinc-200 hover:border-blue-500/50"
              >
                @{wId}
              </button>
            ))}
          </div>
        </div>
      )}

      {section === 'actions' && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-semibold uppercase text-zinc-400 font-mono px-1">
            Aksi Otomasi
          </div>
          <div className="rounded-lg border border-[#272832] bg-[#121318] divide-y divide-[#20222a] overflow-hidden">
            {quickActions.map((act) => (
              <button
                key={act.cmd}
                onClick={() => handleSelect(`${act.cmd} `)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-[#1a1b22] transition-colors"
              >
                <div>
                  <span className="text-xs font-mono font-bold text-blue-400 mr-2">
                    {act.cmd}
                  </span>
                  <span className="text-xs text-zinc-300 font-sans">
                    {act.label}
                  </span>
                </div>
                <Zap className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {section === 'browser' && (
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase text-zinc-400 font-mono px-1">
              URL Dokumentasi / API Spec
            </label>
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="https://..."
              className="w-full p-2 rounded-md bg-[#121318] border border-[#272832] text-xs text-zinc-100 placeholder:text-zinc-500 font-mono focus:outline-none focus:border-blue-500"
            />
          </div>
          <button
            onClick={() => {
              if (customInput.trim()) {
                handleSelect(`@url:${customInput.trim()}`);
              }
            }}
            disabled={!customInput.trim()}
            className="w-full btn-deep-primary py-2 text-xs font-semibold disabled:opacity-40"
          >
            Sertakan Tautan
          </button>
        </div>
      )}
    </BottomSheet>
  );
};
