export const DEFAULT_CONTENT_SCOPE = 'chinese_virtual_song';
export const CONTENT_SCOPES = ['all', 'virtual_song', DEFAULT_CONTENT_SCOPE];
export const normalizeContentScope = value => CONTENT_SCOPES.includes(value) ? value : DEFAULT_CONTENT_SCOPE;

export function uniSeekSearchParams(keyword, contentScope) {
  const params = new URLSearchParams({ contentScope: normalizeContentScope(contentScope) });
  const query = String(keyword ?? '').trim();
  if (query) params.set('keyword', query);
  return params;
}
