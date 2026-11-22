import React, { useState } from 'react';
import { Check, Copy, PlusCircle } from 'lucide-react';

interface SafeMarkdownProps {
  content: string;
  onApplyHtmlBlock?: (htmlCode: string) => void;
}

function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null = pattern.exec(text);
  let keyIdx = 0;

  while (match !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(
        <strong key={`b-${keyIdx++}`} className="font-semibold text-slate-900 dark:text-slate-100">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      nodes.push(
        <em key={`i-${keyIdx++}`} className="italic">
          {token.slice(1, -1)}
        </em>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push(
        <code
          key={`c-${keyIdx++}`}
          className="px-1.5 py-0.5 text-[0.85em] font-mono rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    lastIndex = pattern.lastIndex;
    match = pattern.exec(text);
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

interface CodeBlockProps {
  lang: string;
  code: string;
  onApplyHtmlBlock?: (htmlCode: string) => void;
}

function CodeBlock({ lang, code, onApplyHtmlBlock }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard?.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const isHtml = lang.toLowerCase() === 'html' || code.trim().toLowerCase().startsWith('<!doctype html');

  return (
    <div className="my-3 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-950 text-slate-100">
      <div className="flex items-center justify-between gap-3 px-3.5 py-2 border-b border-slate-800 bg-slate-900 text-xs text-slate-400">
        <span className="font-mono">{lang || 'code'}</span>
        <div className="flex items-center gap-2">
          {isHtml && onApplyHtmlBlock && (
            <button
              type="button"
              onClick={() => onApplyHtmlBlock(code)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium hub-accent-bg transition-colors whitespace-nowrap cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Lưu vào bài học HTML</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Đã chép' : 'Sao chép'}</span>
          </button>
        </div>
      </div>
      <pre className="p-3.5 overflow-x-auto text-xs leading-relaxed font-mono text-slate-200 max-h-80">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function SafeMarkdown({ content, onApplyHtmlBlock }: SafeMarkdownProps) {
  const blocks: React.ReactNode[] = [];
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    const fenceStart = line.trim().match(/^```(\w*)$/);
    if (fenceStart) {
      const lang = fenceStart[1] || '';
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1; // skip closing fence
      blocks.push(
        <CodeBlock key={`code-${i}`} lang={lang} code={codeLines.join('\n')} onApplyHtmlBlock={onApplyHtmlBlock} />
      );
      continue;
    }

    // Blank line
    if (!line.trim()) {
      i += 1;
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      blocks.push(<hr key={`hr-${i}`} className="my-4 border-slate-200 dark:border-slate-800" />);
      i += 1;
      continue;
    }

    // Headings
    const hMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (hMatch) {
      const level = hMatch[1].length;
      const text = hMatch[2];
      const cls =
        level === 1
          ? 'text-xl font-bold text-slate-900 dark:text-slate-100 mt-5 mb-2 font-editorial'
          : level === 2
          ? 'text-lg font-semibold text-slate-900 dark:text-slate-100 mt-4 mb-2 font-editorial'
          : 'text-base font-semibold text-slate-900 dark:text-slate-100 mt-3.5 mb-1.5';
      blocks.push(
        <div key={`h-${i}`} className={cls}>
          {renderInline(text)}
        </div>
      );
      i += 1;
      continue;
    }

    // Bullet list
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ul key={`ul-${i}`} className="my-2 ml-5 list-disc space-y-1.5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ol key={`ol-${i}`} className="my-2 ml-5 list-decimal space-y-1.5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Regular paragraph
    const paraLines: string[] = [line];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith('```') &&
      !/^(#{1,4})\s+/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^---+$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i]);
      i += 1;
    }

    blocks.push(
      <p key={`p-${i}`} className="my-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
        {renderInline(paraLines.join(' '))}
      </p>
    );
  }

  return <div className="space-y-1">{blocks}</div>;
}
