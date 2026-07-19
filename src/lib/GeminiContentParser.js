const TEXT_VALUE_FIELDS = new Set(['text', 'content', 'parts', 'output', 'response', 'result', 'message', 'messages', 'functionResponse', 'functionCall']);

/**
 * Flattens Gemini SDK responses and stored response variants into one Markdown
 * string. Objects are never coerced to text: only values reached through
 * text-bearing fields are appended.
 */
export function normalizeGeminiResponse(response) {
  const seen = new WeakSet();

  const visit = (value, acceptPrimitive = false) => {
    if (typeof value === 'string') return acceptPrimitive ? value : '';
    if (typeof value === 'number' || typeof value === 'boolean') return acceptPrimitive ? `${value}` : '';
    if (!value || typeof value !== 'object') return '';
    if (seen.has(value)) return '';
    seen.add(value);
    if (Array.isArray(value)) return value.map((entry) => visit(entry, acceptPrimitive)).join('');

    return Object.entries(value).map(([key, entry]) => {
      // Unknown wrappers are searched recursively, allowing future Gemini
      // nesting changes while ignoring metadata such as `role`, IDs, and usage.
      return visit(entry, TEXT_VALUE_FIELDS.has(key));
    }).join('');
  };

  return visit(response, true);
}

/** Convert alternate math delimiters without touching fenced code blocks. */
export function normalizeLatexDelimiters(markdown) {
  return markdown.split(/(```[\s\S]*?```)/g).map((segment, index) => index % 2 ? segment : segment
    .replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$')
    .replace(/\\\(([^\n]*?)\\\)/g, '$$$1$')).join('');
}
