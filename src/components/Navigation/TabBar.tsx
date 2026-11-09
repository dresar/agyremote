import React from 'react';
import { LayoutDashboard, Users, TerminalSquare, Settings } from 'lucide-react';
import type { TabType } from '../../types/telemetry.ts';

export type LegacyTabName = 'Overview' | 'Workers' | 'Transcripts' | 'Console' | 'Settings';

interface TabBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

interface TabItem {
  id: TabType;
  label: string;
  name: LegacyTabName;
  Icon: React.ComponentType<{ className?: string }>;
}

const TABS: TabItem[] = [
  { id: 'overview', label: 'Overview', name: 'Overview', Icon: LayoutDashboard },
  { id: 'workers', label: 'Workers', name: 'Workers', Icon: Users },
  { id: 'logs', label: 'Logs', name: 'Transcripts', Icon: TerminalSquare },
  { id: 'settings', label: 'Settings', name: 'Settings', Icon: Settings }
];

export const TabBar: React.FC<TabBarProps> = ({ activeTab, onTabChange }) => {
  const isLogsActive = activeTab === 'logs' || activeTab === 'transcripts' || activeTab === 'console';

  return (
    <nav className="fixed bottom-0 inset-x-0 max-w-md md:max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto w-full z-40 bg-[#0c0d0e]/95 backdrop-blur-md border-t border-[#1f212a] pb-[env(safe-area-inset-bottom,12px)]">
      <div className="flex items-center justify-around h-14 px-2">
        {TABS.map(({ id, label, Icon }) => {
          const isActive = id === 'logs' ? isLogsActive : activeTab === id;
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all duration-150 ${
                isActive
                  ? 'text-zinc-100 font-semibold bg-[#181924] border border-[#2c2f42] shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Icon
                className={`w-4 h-4 mb-0.5 ${
                  isActive ? 'stroke-[2.2] text-blue-400' : 'stroke-[1.6]'
                }`}
              />
              <span className="text-[10px] tracking-tight">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
