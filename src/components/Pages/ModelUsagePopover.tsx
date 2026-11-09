import React, { useState, useEffect, useRef } from 'react';
import { Check, ChevronRight, ChevronLeft, Info, Activity } from 'lucide-react';
import { fetchWorkerUsage } from '../../services/api.ts';
import type { WorkerUsage } from '../../types/telemetry.ts';

export interface ModelOption {
  id: string;
  name: string;
  badge: string;
  badgeType: 'high' | 'notice' | 'medium' | 'unavailable';
  disabled?: boolean;
}

export const AVAILABLE_MODELS: ModelOption[] = [
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    badge: 'High',
    badgeType: 'high'
  },
  {
    id: 'stepfun-3.7-flash',
    name: 'Stepfun 3.7 Flash',
    badge: 'Active',
    badgeType: 'high'
  },
  {
    id: 'laguna-s-2.1',
    name: 'Laguna S 2.1',
    badge: 'Fast',
    badgeType: 'high'
  },
  {
    id: 'gemini-3.6-flash',
    name: 'Gemini 3.6 Flash',
    badge: 'High',
    badgeType: 'high'
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    badge: 'Medium',
    badgeType: 'medium'
  },
  {
    id: 'claude-haiku-5.5',
    name: 'Claude Haiku 5.5',
    badge: 'Notice',
    badgeType: 'notice'
  }
];

interface ModelUsagePopoverProps {
  isOpen: boolean;
  onClose: () => void;
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
  workerId: string;
}

const CircularRing: React.FC<{ percent: number; size?: number }> = ({
  percent,
  size = 18
}) => {
  const radius = 7;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percent / 100) * circumference;
  const color = percent <= 25 ? '#f59e0b' : percent <= 50 ? '#eab308' : '#10b981';

  return (
    <svg width={size} height={size} viewBox="0 0 20 20" className="rotate-[-90deg] shrink-0">
      <circle
        cx="10"
        cy="10"
        r={radius}
        stroke="#262836"
        strokeWidth="2.5"
        fill="none"
      />
      <circle
        cx="10"
        cy="10"
        r={radius}
        stroke={color}
        strokeWidth="2.5"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
};

export const ModelUsagePopover: React.FC<ModelUsagePopoverProps> = ({
  isOpen,
  onClose,
  selectedModel,
  onSelectModel,
  workerId
}) => {
  const [showUsage, setShowUsage] = useState(false);
  const [usage, setUsage] = useState<WorkerUsage | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setLoadingUsage(true);
      fetchWorkerUsage(workerId)
        .then((res) => {
          setUsage(res);
        })
        .catch(() => {
          setUsage(null);
        })
        .finally(() => {
          setLoadingUsage(false);
        });
    } else {
      setShowUsage(false);
    }
  }, [isOpen, workerId]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const renderBadge = (badge: string, type: ModelOption['badgeType']) => {
    let classes = 'bg-zinc-800 text-zinc-400 border-zinc-700';
    if (type === 'high') {
      classes = 'bg-emerald-950/70 text-emerald-400 border-emerald-800/80';
    } else if (type === 'notice') {
      classes = 'bg-amber-950/70 text-amber-400 border-amber-800/80';
    } else if (type === 'medium') {
      classes = 'bg-blue-950/70 text-blue-400 border-blue-800/80';
    } else if (type === 'unavailable') {
      classes = 'bg-zinc-900/60 text-zinc-500 border-zinc-800/80';
    }

    return (
      <span className={`inline-flex items-center gap-1 text-[10px] font-mono font-medium px-1.5 py-0.2 rounded border ${classes}`}>
        {badge}
        {(type === 'notice' || type === 'unavailable') && (
          <Info className="w-2.5 h-2.5" />
        )}
      </span>
    );
  };

  const geminiWeeklyLeft = usage?.gemini?.weeklyPercentLeft ?? 20;
  const geminiWeeklyReset = usage?.gemini?.weeklyReset || '3d 7h';
  const gemini5hLeft = usage?.gemini?.fiveHourPercentLeft ?? 91;
  const gemini5hReset = usage?.gemini?.fiveHourReset || '4h 32m';

  const claudeWeeklyLeft = usage?.claudeGpt?.weeklyPercentLeft ?? 100;
  const claude5hLeft = usage?.claudeGpt?.fiveHourPercentLeft ?? 100;

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full mb-2 left-0 z-50 flex flex-col sm:flex-row items-start gap-2 select-none animate-in fade-in duration-150"
    >
      <div className="w-64 bg-[#151620] border border-[#272938] rounded-2xl p-2 shadow-2xl shadow-black/80 flex flex-col shrink-0">
        <div className="text-[11px] font-semibold text-zinc-400 px-2.5 py-1">
          Model
        </div>

        <div className="space-y-0.5 pt-0.5">
          {AVAILABLE_MODELS.map((model) => {
            const isSelected = selectedModel === model.id;
            return (
              <button
                key={model.id}
                disabled={model.disabled}
                onClick={() => {
                  if (!model.disabled) {
                    onSelectModel(model.id);
                    onClose();
                  }
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-left transition-colors ${
                  model.disabled
                    ? 'opacity-40 cursor-not-allowed'
                    : isSelected
                    ? 'bg-[#1e202f] text-zinc-100 cursor-pointer'
                    : 'hover:bg-[#1a1b28] text-zinc-300 hover:text-zinc-100 cursor-pointer'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 pr-1 truncate">
                  <span className="text-xs font-semibold truncate tracking-tight">
                    {model.name}
                  </span>
                  {renderBadge(model.badge, model.badgeType)}
                </div>

                <div className="shrink-0 w-4 flex items-center justify-center">
                  {isSelected && <Check className="w-4 h-4 text-zinc-100 stroke-[2.5]" />}
                </div>
              </button>
            );
          })}
        </div>

        <div className="pt-1.5 mt-1 border-t border-[#222434]">
          <button
            type="button"
            onClick={() => setShowUsage((prev) => !prev)}
            onMouseEnter={() => setShowUsage(true)}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
              showUsage
                ? 'bg-[#1e202f] text-zinc-100'
                : 'text-zinc-300 hover:bg-[#1a1b28] hover:text-zinc-100'
            }`}
          >
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-zinc-400" />
              <span className="font-semibold">View Usage</span>
            </div>
            <ChevronRight className={`w-4 h-4 text-zinc-500 transition-transform ${showUsage ? 'translate-x-0.5 text-zinc-300' : ''}`} />
          </button>
        </div>
      </div>

      {showUsage && (
        <div className="w-72 bg-[#151620] border border-[#272938] rounded-2xl p-3.5 shadow-2xl shadow-black/80 flex flex-col shrink-0 animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-2 border-b border-[#222434] mb-2 sm:border-0 sm:pb-0 sm:mb-1">
            <span className="text-[11px] font-semibold text-zinc-400">Usage</span>
            <button
              onClick={() => setShowUsage(false)}
              className="sm:hidden p-1 rounded-lg text-zinc-400 hover:text-zinc-200"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <div className="text-xs font-semibold text-zinc-200 tracking-tight mb-2">
                Gemini Models
              </div>

              <div className="space-y-2.5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs text-zinc-300 font-normal">Weekly limit</div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">Resets in {geminiWeeklyReset}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-zinc-100 font-mono">
                      {geminiWeeklyLeft}% left
                    </span>
                    <CircularRing percent={geminiWeeklyLeft} />
                  </div>
                </div>

                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs text-zinc-300 font-normal">5h limit</div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">Resets in {gemini5hReset}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-zinc-100 font-mono">
                      {gemini5hLeft}% left
                    </span>
                    <CircularRing percent={gemini5hLeft} />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-[#222434]">
              <div className="text-xs font-semibold text-zinc-200 tracking-tight mb-2">
                Claude and GPT models
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-zinc-300 font-normal">Weekly limit</div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-zinc-100 font-mono">
                      {claudeWeeklyLeft}% left
                    </span>
                    <CircularRing percent={claudeWeeklyLeft} />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-xs text-zinc-300 font-normal">5h limit</div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-zinc-100 font-mono">
                      {claude5hLeft}% left
                    </span>
                    <CircularRing percent={claude5hLeft} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
