import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface MarkdownMessageViewProps {
  content: string;
}

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let keyIdx = 0;

  while (remaining.length > 0) {
    const codeMatch = remaining.match(/`([^`]+)`/);
    const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
    const italicMatch = remaining.match(/(?:^|[^*])\*([^*]+)\*/);

    let firstIndex = remaining.length;
    let matchType: 'code' | 'bold' | 'italic' | null = null;
    let matchObj: RegExpMatchArray | null = null;

    if (codeMatch && codeMatch.index !== undefined && codeMatch.index < firstIndex) {
      firstIndex = codeMatch.index;
      matchType = 'code';
      matchObj = codeMatch;
    }
    if (boldMatch && boldMatch.index !== undefined && boldMatch.index < firstIndex) {
      firstIndex = boldMatch.index;
      matchType = 'bold';
      matchObj = boldMatch;
    }
    if (italicMatch && italicMatch.index !== undefined) {
      const actualIndex = italicMatch.index + (italicMatch[0].startsWith('*') ? 0 : 1);
      if (actualIndex < firstIndex) {
        firstIndex = actualIndex;
        matchType = 'italic';
        matchObj = italicMatch;
      }
    }

    if (matchType === null || !matchObj) {
      parts.push(remaining);
      break;
    }

    if (firstIndex > 0) {
      parts.push(remaining.substring(0, firstIndex));
    }

    if (matchType === 'code') {
      parts.push(
        <code
          key={`code_${keyIdx++}`}
          className="px-1.5 py-0.5 rounded text-[11px] font-mono bg-[#1a1c28] text-blue-300 border border-[#2b2e40] break-all"
        >
          {matchObj[1]}
        </code>
      );
      remaining = remaining.substring(firstIndex + matchObj[0].length);
    } else if (matchType === 'bold') {
      parts.push(
        <strong key={`bold_${keyIdx++}`} className="font-semibold text-zinc-100">
          {renderInline(matchObj[1])}
        </strong>
      );
      remaining = remaining.substring(firstIndex + matchObj[0].length);
    } else if (matchType === 'italic') {
      parts.push(
        <em key={`italic_${keyIdx++}`} className="italic text-zinc-300">
          {renderInline(matchObj[1])}
        </em>
      );
      remaining = remaining.substring(firstIndex + matchObj[1].length + 2);
    }
  }

  return <>{parts}</>;
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-2.5 rounded-xl border border-[#262838] bg-[#0d0e14] overflow-hidden shadow-md">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#141520] border-b border-[#222434] text-[11px] text-zinc-400 font-mono">
        <span className="uppercase text-[10px] font-semibold tracking-wider text-blue-400">
          {language || 'code'}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-[#1f2130] hover:text-zinc-200 transition-colors cursor-pointer text-[10px]"
          title="Salin"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400">Tersalin</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Salin</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-[11px] font-mono leading-relaxed text-zinc-200 scrollbar-thin">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export const MarkdownMessageView: React.FC<MarkdownMessageViewProps> = ({ content }) => {
  if (!content) return null;

  const rawBlocks = content.split('```');
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < rawBlocks.length; i++) {
    if (i % 2 === 1) {
      const block = rawBlocks[i];
      const newlineIdx = block.indexOf('\n');
      const lang = newlineIdx >= 0 ? block.substring(0, newlineIdx).trim() : '';
      const code = newlineIdx >= 0 ? block.substring(newlineIdx + 1) : block;
      elements.push(<CodeBlock key={`cb_${i}`} language={lang} code={code.trimEnd()} />);
    } else {
      const text = rawBlocks[i];
      if (!text.trim()) continue;

      const lines = text.split('\n');
      let currentParagraph: string[] = [];

      const flushParagraph = (pKey: string) => {
        if (currentParagraph.length === 0) return;
        const paraText = currentParagraph.join('\n').trim();
        currentParagraph = [];
        if (!paraText) return;

        elements.push(
          <p key={pKey} className="text-xs leading-relaxed text-zinc-200 my-1.5">
            {renderInline(paraText)}
          </p>
        );
      };

      for (let lIdx = 0; lIdx < lines.length; lIdx++) {
        const line = lines[lIdx];
        const trimmed = line.trim();

        if (trimmed === '') {
          flushParagraph(`p_${i}_${lIdx}`);
          continue;
        }

        if (trimmed === '---') {
          flushParagraph(`p_hr_${i}_${lIdx}`);
          elements.push(<hr key={`hr_${i}_${lIdx}`} className="border-[#232538] my-2" />);
          continue;
        }

        if (trimmed.startsWith('#### ')) {
          flushParagraph(`p_h4_${i}_${lIdx}`);
          elements.push(
            <h4 key={`h4_${i}_${lIdx}`} className="text-[11px] font-semibold text-zinc-300 mt-2 mb-1">
              {renderInline(trimmed.substring(5))}
            </h4>
          );
          continue;
        }

        if (trimmed.startsWith('### ')) {
          flushParagraph(`p_h3_${i}_${lIdx}`);
          elements.push(
            <h3 key={`h3_${i}_${lIdx}`} className="text-xs font-semibold text-zinc-200 mt-2.5 mb-1">
              {renderInline(trimmed.substring(4))}
            </h3>
          );
          continue;
        }

        if (trimmed.startsWith('## ')) {
          flushParagraph(`p_h2_${i}_${lIdx}`);
          elements.push(
            <h2 key={`h2_${i}_${lIdx}`} className="text-xs font-bold text-zinc-100 mt-3 mb-1">
              {renderInline(trimmed.substring(3))}
            </h2>
          );
          continue;
        }

        if (trimmed.startsWith('# ')) {
          flushParagraph(`p_h1_${i}_${lIdx}`);
          elements.push(
            <h1 key={`h1_${i}_${lIdx}`} className="text-sm font-bold text-zinc-100 mt-3 mb-1">
              {renderInline(trimmed.substring(2))}
            </h1>
          );
          continue;
        }

        if (trimmed.startsWith('> ')) {
          flushParagraph(`p_bq_${i}_${lIdx}`);
          elements.push(
            <blockquote
              key={`bq_${i}_${lIdx}`}
              className="border-l-2 border-blue-500 pl-3 py-1 my-1.5 text-zinc-400 italic bg-[#151624]/60 rounded-r text-xs"
            >
              {renderInline(trimmed.substring(2))}
            </blockquote>
          );
          continue;
        }

        const bulletMatch = trimmed.match(/^[-*]\s+(.*)$/);
        if (bulletMatch) {
          flushParagraph(`p_bl_${i}_${lIdx}`);
          elements.push(
            <div key={`li_${i}_${lIdx}`} className="flex items-start gap-2 my-1 text-xs text-zinc-200 leading-relaxed">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
              <div className="flex-1">{renderInline(bulletMatch[1])}</div>
            </div>
          );
          continue;
        }

        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
        if (numMatch) {
          flushParagraph(`p_nl_${i}_${lIdx}`);
          elements.push(
            <div key={`nli_${i}_${lIdx}`} className="flex items-start gap-2 my-1 text-xs text-zinc-200 leading-relaxed">
              <span className="text-blue-400 font-mono font-medium text-[11px] shrink-0 min-w-[1.2rem]">
                {numMatch[1]}.
              </span>
              <div className="flex-1">{renderInline(numMatch[2])}</div>
            </div>
          );
          continue;
        }

        currentParagraph.push(line);
      }

      flushParagraph(`p_end_${i}`);
    }
  }

  return <div className="space-y-1 select-text">{elements}</div>;
};
