import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeSlug from 'rehype-slug';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Check, Copy } from 'lucide-react';
import { normalizeGeminiResponse, normalizeLatexDelimiters } from '@/lib/GeminiContentParser';

const safeHtmlSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames || []), 'u'],
  attributes: {
    ...defaultSchema.attributes,
    '*': [...(defaultSchema.attributes?.['*'] || []), 'className'],
    a: [...(defaultSchema.attributes?.a || []), 'target', 'rel'],
  },
};

function CodeBlock({ children, className }) {
  const [copied, setCopied] = useState(false);
  const code = normalizeGeminiResponse(children).replace(/\n$/, '');
  const language = /language-([\w+-]+)/.exec(className || '')?.[1];
  const copy = async () => { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1400); };
  if (!language) return <code className={`${className || ''} rounded bg-muted px-1 py-0.5 text-xs`}>{children}</code>;
  return <div className="not-prose relative my-3 overflow-hidden rounded-lg"><button type="button" aria-label="Copy code" onClick={copy} className="absolute right-2 top-2 z-10 rounded bg-background/20 p-1.5 text-white hover:bg-background/35">{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}</button><SyntaxHighlighter language={language} style={oneDark} PreTag="div" customStyle={{ margin: 0, padding: '1rem', fontSize: '0.75rem' }}>{code}</SyntaxHighlighter></div>;
}

const components = {
  code: CodeBlock,
  a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer">{children}</a>,
};

/** A safe, reusable Markdown + GFM + LaTeX renderer for AI responses. */
export default function RichMarkdownRenderer({ content, pending = false, className = '' }) {
  const markdown = normalizeLatexDelimiters(normalizeGeminiResponse(content));
  return <div className={`ask-ai-markdown prose prose-sm max-w-none dark:prose-invert ${className}`}><ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]} rehypePlugins={[rehypeRaw, [rehypeSanitize, safeHtmlSchema], rehypeSlug, [rehypeKatex, { throwOnError: false, strict: 'ignore' }], rehypeAutolinkHeadings]} components={components}>{markdown || (pending ? '…' : 'No response.')}</ReactMarkdown></div>;
}
