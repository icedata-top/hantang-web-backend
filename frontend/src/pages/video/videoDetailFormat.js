/** Decode the requested entity as plain text, without interpreting HTML. */
export function formatVideoText(value) {
  return typeof value === 'string' ? value.replaceAll('&amp;', '&') : '';
}
