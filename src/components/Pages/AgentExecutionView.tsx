import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Copy, Check, Terminal, FileCode, Brain, Loader2 } from 'lucide-react';
import type { ExecutionStep } from '../../services/transcript.ts';

interface AgentExecutionViewProps {
  duration?: string;
  thinking?: string;
  steps: ExecutionStep[];
  isLive?: boolean;
}

export const AgentExecutionView: React.FC<AgentExecutionViewProps> = ({
  duration = '1s',
  thinking,
  steps = [],
  isLive = false
}) => {
  const [isMainExpanded, setIsMainExpanded] = useState(true);
  const [isCommandsGroupExpanded, setIsCommandsGroupExpanded] = useState(true);
  const [isFilesGroupExpanded, setIsFilesGroupExpanded] = useState(true);
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(false);
  const [expandedStepMap, setExpandedStepMap] = useState<Record<number, boolean>>({ 0: true });
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (steps.length === 0 && !thinking && !isLive) {
    return null;
  }

  const commands = steps
    .map((s, idx) => ({ ...s, originalIdx: idx }))
    .filter((s) => s.name === 'run_command' || !!s.command);

  const fileOps = steps
    .map((s, idx) => ({ ...s, originalIdx: idx }))
    .filter((s) => s.name !== 'run_command' && !s.command);

  const toggleStep = (idx: number) => {
    setExpandedStepMap((prev) => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  const handleCopy = (idx: number, textToCopy: string) => {
    navigator.clipboard.writeText(textToCopy);
    setCopiedIndex(idx);
    setTimeout(() => {
      setCopiedIndex(null);
    }, 1500);
  };

  const formatCommandLabel = (step: ExecutionStep) => {
    if (step.summary) {
      const trimmed = step.summary.trim();
      if (trimmed.toLowerCase().startsWith('ran ')) {
        return trimmed;
      }
      return `Ran ${trimmed.charAt(0).toLowerCase() + trimmed.slice(1)}`;
    }
    if (step.command) {
      const firstLine = step.command.split('\n')[0].trim();
      return `Ran ${firstLine.slice(0, 45)}`;
    }
    return `Ran ${step.name}`;
  };

  const formatFileLabel = (step: ExecutionStep) => {
    const fileName = step.path ? step.path.split('/').pop() : 'file';
    if (step.name === 'edit_file' || step.action === 'modified') {
      return `Edited ${fileName}`;
    }
    if (step.name === 'write_file' || step.action === 'created') {
      return `Created ${fileName}`;
    }
    return `Read ${fileName}`;
  };

  return (
    <div className="w-full text-zinc-300 font-mono text-xs select-none mb-3">
      <div className="flex items-center gap-1.5 py-1">
        <button
          type="button"
          onClick={() => setIsMainExpanded((prev) => !prev)}
          className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 text-xs font-mono font-medium transition-colors cursor-pointer"
        >
          <span>Worked for {duration}</span>
          {isMainExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
          )}
        </button>

        {isLive && (
          <div className="flex items-center gap-1 text-[11px] text-blue-400 ml-2">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Executing...</span>
          </div>
        )}
      </div>

      {isMainExpanded && (
        <div className="pl-3.5 space-y-2 mt-1 border-l border-[#1f212c]">
          {thinking && (
            <div>
              <button
                type="button"
                onClick={() => setIsThinkingExpanded((prev) => !prev)}
                className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 text-xs font-mono py-0.5 transition-colors cursor-pointer"
              >
                <Brain className="w-3.5 h-3.5 text-blue-400" />
                <span>Thinking</span>
                {isThinkingExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                )}
              </button>
              {isThinkingExpanded && (
                <div className="mt-1 pl-4 p-2.5 rounded-xl bg-[#0c0d12] border border-[#1b1c26] text-[11px] text-zinc-400 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto scrollbar-thin select-text">
                  {thinking}
                </div>
              )}
            </div>
          )}

          {commands.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setIsCommandsGroupExpanded((prev) => !prev)}
                className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 text-xs font-mono py-0.5 transition-colors cursor-pointer"
              >
                <span>Ran commands</span>
                {isCommandsGroupExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                )}
              </button>

              {isCommandsGroupExpanded && (
                <div className="pl-3.5 space-y-2 mt-1">
                  {commands.map((cmd) => {
                    const isExpanded = !!expandedStepMap[cmd.originalIdx];
                    const label = formatCommandLabel(cmd);
                    const promptCwd = cmd.cwd || '.../home/agyremote';

                    return (
                      <div key={cmd.originalIdx} className="w-full">
                        <button
                          type="button"
                          onClick={() => toggleStep(cmd.originalIdx)}
                          className="flex items-center gap-1.5 text-zinc-300 hover:text-white text-xs font-mono py-0.5 transition-colors cursor-pointer text-left"
                        >
                          <span>{label}</span>
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          )}
                        </button>

                        {isExpanded && (
                          <div className="rounded-xl bg-[#0b0c10] border border-[#1f212d] p-3 text-xs font-mono mt-1 mb-2 select-text shadow-lg">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-baseline gap-1.5 flex-wrap min-w-0 pr-1 leading-relaxed">
                                <span className="text-zinc-500 font-semibold shrink-0 select-none">
                                  {promptCwd} $
                                </span>
                                <span className="text-zinc-200 break-all select-text font-mono">
                                  {cmd.command || label}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleCopy(cmd.originalIdx, cmd.command || '')}
                                className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-[#1a1c27] transition-colors shrink-0 cursor-pointer"
                                title="Copy command"
                              >
                                {copiedIndex === cmd.originalIdx ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>

                            {cmd.output && (
                              <div className="mt-2.5 pt-2 border-t border-[#1a1b26] text-zinc-300 text-[11px] font-mono whitespace-pre-wrap break-all leading-relaxed max-h-56 overflow-y-auto scrollbar-thin select-text">
                                {cmd.output}
                              </div>
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

          {fileOps.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setIsFilesGroupExpanded((prev) => !prev)}
                className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 text-xs font-mono py-0.5 transition-colors cursor-pointer"
              >
                <span>File operations</span>
                {isFilesGroupExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                )}
              </button>

              {isFilesGroupExpanded && (
                <div className="pl-3.5 space-y-2 mt-1">
                  {fileOps.map((op) => {
                    const isExpanded = !!expandedStepMap[op.originalIdx];
                    const label = formatFileLabel(op);

                    return (
                      <div key={op.originalIdx} className="w-full">
                        <button
                          type="button"
                          onClick={() => toggleStep(op.originalIdx)}
                          className="flex items-center gap-1.5 text-zinc-300 hover:text-white text-xs font-mono py-0.5 transition-colors cursor-pointer text-left"
                        >
                          <span>{label}</span>
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          )}
                        </button>

                        {isExpanded && (
                          <div className="rounded-xl bg-[#0b0c10] border border-[#1f212d] p-3 text-xs font-mono mt-1 mb-2 select-text shadow-lg">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <FileCode className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                                <span className="text-zinc-300 break-all select-text font-mono">
                                  {op.path || op.name}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleCopy(op.originalIdx, op.path || '')}
                                className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-[#1a1c27] transition-colors shrink-0 cursor-pointer"
                                title="Copy path"
                              >
                                {copiedIndex === op.originalIdx ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>

                            {op.output && (
                              <div className="mt-2.5 pt-2 border-t border-[#1a1b26] text-zinc-400 text-[11px] font-mono whitespace-pre-wrap break-all leading-relaxed max-h-56 overflow-y-auto scrollbar-thin select-text">
                                {op.output}
                              </div>
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
        </div>
      )}
    </div>
  );
};
