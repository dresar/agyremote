import React from 'react';
import {
  Activity,
  Users,
  BarChart2,
  Terminal,
  Zap,
  Sparkles,
  BookOpen,
  Share2,
  Trash2,
  RefreshCw
} from 'lucide-react';

export interface SlashCommand {
  cmd: string;
  name: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { cmd: '/status', name: 'Status', desc: 'Cek kesehatan kluster & koneksi', icon: Activity },
  { cmd: '/workers', name: 'Workers', desc: 'Daftar 15 worker & otentikasi', icon: Users },
  { cmd: '/usage', name: 'Usage', desc: 'Metrik CPU, RAM, Disk & Goroutine', icon: BarChart2 },
  { cmd: '/ps', name: 'Proses', desc: 'Daftar proses aktif di sistem', icon: Terminal },
  { cmd: '/kill', name: 'Kill', desc: 'Hentikan proses yang membebani', icon: Trash2 },
  { cmd: '/plan', name: 'Plan', desc: 'Rancang rencana tugas terstruktur', icon: Sparkles },
  { cmd: '/boost', name: 'Boost', desc: 'Optimasi kecepatan eksekusi', icon: Zap },
  { cmd: '/learn', name: 'Learn', desc: 'Audit codebase & identifikasi pola', icon: BookOpen },
  { cmd: '/teamwork', name: 'Teamwork', desc: 'Koordinasi antar worker AGY', icon: Share2 },
  { cmd: '/refresh', name: 'Refresh', desc: 'Sinkronisasi data kluster', icon: RefreshCw }
];

interface SlashCommandsMenuProps {
  filter: string;
  onSelect: (cmd: string) => void;
  onClose: () => void;
}

export const SlashCommandsMenu: React.FC<SlashCommandsMenuProps> = ({
  filter,
  onSelect,
  onClose
}) => {
  const query = filter.startsWith('/') ? filter.slice(1).toLowerCase() : filter.toLowerCase();

  const filtered = SLASH_COMMANDS.filter(
    (c) =>
      c.cmd.toLowerCase().includes(query) ||
      c.name.toLowerCase().includes(query) ||
      c.desc.toLowerCase().includes(query)
  );

  if (filtered.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 rounded-lg bg-[#16171d] border border-[#272832] shadow-2xl overflow-hidden z-40 max-h-56 overflow-y-auto divide-y divide-[#20222a]">
      <div className="px-3 py-1.5 bg-[#121318] text-[10px] font-mono uppercase text-zinc-400 font-semibold flex items-center justify-between">
        <span>Perintah Cepat ({filtered.length})</span>
        <button
          onClick={onClose}
          className="text-zinc-500 hover:text-zinc-300 font-sans normal-case text-[11px]"
        >
          Tutup
        </button>
      </div>

      {filtered.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.cmd}
            onClick={() => onSelect(item.cmd)}
            className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-[#1f2029] active:bg-[#1a1b22] transition-colors"
          >
            <div className="p-1 rounded bg-[#1c1d25] border border-[#2c2e3a] text-blue-400">
              <Icon className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-blue-400">
                  {item.cmd}
                </span>
                <span className="text-xs font-semibold text-zinc-200">
                  {item.name}
                </span>
              </div>
              <div className="text-[11px] text-zinc-400 truncate">
                {item.desc}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};
