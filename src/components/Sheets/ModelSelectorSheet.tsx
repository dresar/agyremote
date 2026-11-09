import React from 'react';
import { BottomSheet } from './BottomSheet.tsx';
import { Check, ChevronRight, BarChart2, Info } from 'lucide-react';

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

interface ModelSelectorSheetProps {
  isOpen: boolean;
  onClose: () => void;
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
  onOpenUsage: () => void;
}

export const ModelSelectorSheet: React.FC<ModelSelectorSheetProps> = ({
  isOpen,
  onClose,
  selectedModel,
  onSelectModel,
  onOpenUsage
}) => {
  const getBadgeClass = (type: ModelOption['badgeType']) => {
    switch (type) {
      case 'high':
        return 'bg-emerald-950/70 text-emerald-400 border border-emerald-800/80';
      case 'notice':
        return 'bg-amber-950/70 text-amber-400 border border-amber-800/80';
      case 'medium':
        return 'bg-blue-950/70 text-blue-400 border border-blue-800/80';
      case 'unavailable':
      default:
        return 'bg-zinc-800 text-zinc-400 border border-zinc-700';
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Model">
      <div className="space-y-1">
        <div className="divide-y divide-[#20222a] rounded-lg border border-[#272832] bg-[#121318] overflow-hidden">
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
                className={`w-full flex items-center justify-between px-3.5 py-3 transition-colors text-left ${
                  model.disabled
                    ? 'opacity-40 cursor-not-allowed bg-transparent'
                    : 'hover:bg-[#1a1b22] active:bg-[#16171d] cursor-pointer'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-5 flex items-center justify-center shrink-0">
                    {isSelected && (
                      <Check className="w-4 h-4 text-blue-500 stroke-[2.5]" />
                    )}
                  </div>
                  <div className="min-w-0 flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-zinc-100 font-sans tracking-tight">
                      {model.name}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-mono font-medium px-1.5 py-0.2 rounded ${getBadgeClass(
                        model.badgeType
                      )}`}
                    >
                      {model.badge}
                      {model.badgeType === 'notice' || model.badgeType === 'unavailable' ? (
                        <Info className="w-2.5 h-2.5" />
                      ) : null}
                    </span>
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0 ml-2" />
              </button>
            );
          })}
        </div>

        <div className="pt-3">
          <button
            onClick={() => {
              onClose();
              onOpenUsage();
            }}
            className="w-full flex items-center justify-between px-3.5 py-3 rounded-lg bg-[#121318] hover:bg-[#1a1b22] active:bg-[#16171d] border border-[#272832] text-xs font-medium text-zinc-200 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <BarChart2 className="w-4 h-4 text-blue-400" />
              <span className="font-semibold text-zinc-100">View Usage</span>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-500" />
          </button>
        </div>
      </div>
    </BottomSheet>
  );
};
