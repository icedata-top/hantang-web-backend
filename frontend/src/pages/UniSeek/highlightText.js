/**
 * 搜索结果关键词高亮：纯前端切分，返回文本片段（不含 HTML）。
 */

/**
 * @param {string} value
 * @returns {string}
 */
export function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param {string} text
 * @param {string} keyword 整句或空白分词；标题未命中时简介仍可高亮
 * @returns {{ text: string, hit: boolean }[]}
 */
export function splitHighlightParts(text, keyword) {
  const raw = String(text ?? '');
  const q = String(keyword ?? '').trim();
  if (!raw || !q) return [{ text: raw, hit: false }];

  const tokens = [...new Set(q.split(/\s+/).filter(Boolean))];
  if (!tokens.length) return [{ text: raw, hit: false }];

  const re = new RegExp(`(${tokens.map(escapeRegExp).join('|')})`, 'gi');
  /** @type {{ text: string, hit: boolean }[]} */
  const parts = [];
  let lastIndex = 0;

  for (const match of raw.matchAll(re)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      parts.push({ text: raw.slice(lastIndex, start), hit: false });
    }
    parts.push({ text: match[0], hit: true });
    lastIndex = start + match[0].length;
  }

  if (lastIndex < raw.length) {
    parts.push({ text: raw.slice(lastIndex), hit: false });
  }

  return parts.length ? parts : [{ text: raw, hit: false }];
}
