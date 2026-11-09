import React from 'react';
import { FileCode2 } from 'lucide-react';

interface LanguageIconProps {
  filename?: string;
  className?: string;
}

export const LanguageIcon: React.FC<LanguageIconProps> = ({
  filename = '',
  className = 'w-3.5 h-3.5'
}) => {
  const lower = filename.toLowerCase();
  const ext = lower.includes('.') ? lower.split('.').pop() || '' : lower;

  if (ext === 'ts' || ext === 'tsx') {
    return (
      <span
        className={`inline-flex items-center justify-center font-bold font-mono text-[9px] rounded bg-[#3178c6] text-white shrink-0 px-0.5 leading-none select-none ${className}`}
        title="TypeScript"
      >
        TS
      </span>
    );
  }

  if (ext === 'js' || ext === 'jsx' || ext === 'mjs' || ext === 'cjs') {
    return (
      <span
        className={`inline-flex items-center justify-center font-bold font-mono text-[9px] rounded bg-[#f7df1e] text-black shrink-0 px-0.5 leading-none select-none ${className}`}
        title="JavaScript"
      >
        JS
      </span>
    );
  }

  if (ext === 'go') {
    return (
      <span
        className={`inline-flex items-center justify-center font-bold font-mono text-[9px] rounded bg-[#00add8] text-white shrink-0 px-0.5 leading-none select-none ${className}`}
        title="Go"
      >
        GO
      </span>
    );
  }

  if (ext === 'json') {
    return (
      <span
        className={`inline-flex items-center justify-center font-bold font-mono text-[9px] rounded bg-amber-600 text-white shrink-0 px-0.5 leading-none select-none ${className}`}
        title="JSON"
      >
        {"{}"}
      </span>
    );
  }

  if (ext === 'py') {
    return (
      <span
        className={`inline-flex items-center justify-center font-bold font-mono text-[9px] rounded bg-gradient-to-tr from-[#3776ab] to-[#ffd43b] text-white shrink-0 px-0.5 leading-none select-none ${className}`}
        title="Python"
      >
        PY
      </span>
    );
  }

  if (ext === 'css' || ext === 'scss') {
    return (
      <span
        className={`inline-flex items-center justify-center font-bold font-mono text-[9px] rounded bg-[#264de4] text-white shrink-0 px-0.5 leading-none select-none ${className}`}
        title="CSS"
      >
        CSS
      </span>
    );
  }

  if (ext === 'html' || ext === 'htm') {
    return (
      <span
        className={`inline-flex items-center justify-center font-bold font-mono text-[9px] rounded bg-[#e34f26] text-white shrink-0 px-0.5 leading-none select-none ${className}`}
        title="HTML"
      >
        {"</>"}
      </span>
    );
  }

  if (ext === 'md') {
    return (
      <span
        className={`inline-flex items-center justify-center font-bold font-mono text-[9px] rounded bg-slate-600 text-white shrink-0 px-0.5 leading-none select-none ${className}`}
        title="Markdown"
      >
        MD
      </span>
    );
  }

  if (ext === 'sh' || ext === 'bash') {
    return (
      <span
        className={`inline-flex items-center justify-center font-bold font-mono text-[9px] rounded bg-emerald-600 text-white shrink-0 px-0.5 leading-none select-none ${className}`}
        title="Shell Script"
      >
        $_
      </span>
    );
  }

  if (ext === 'sql' || ext === 'db' || ext === 'sqlite') {
    return (
      <span
        className={`inline-flex items-center justify-center font-bold font-mono text-[9px] rounded bg-purple-600 text-white shrink-0 px-0.5 leading-none select-none ${className}`}
        title="Database"
      >
        DB
      </span>
    );
  }

  return <FileCode2 className={`text-zinc-400 shrink-0 ${className}`} />;
};
