import schema from '../../../../script/uniseek/analysis-result.schema.json' with { type: 'json' };

export const SONG_VALUES = schema.$defs.entry.properties.output.properties.is_song.enum;
export const VOICE_VALUES = schema.$defs.entry.properties.output.properties.is_virtual_singer.enum;
export const REVIEW_VALUES = schema.$defs.entry.properties.review.properties.status.enum;
export const COMMON_LANGUAGES = ['汉语', '日语', '英语', '朝鲜语', '法语', '德语', '俄语', '西班牙语', '葡萄牙语', '意大利语', '泰语', '越南语', '芬兰语', '拉丁语', '旁遮普语', '印地语', '乌克兰语', '阿拉伯语', '希伯来语', '未知语言', '无语言'];
export const MAX_REVIEW_FILE_BYTES = 20 * 1024 * 1024;
const aliases = schema.$defs.entry.properties.output.properties.languages.items.not.enum;
const languagePattern = new RegExp(schema.$defs.entry.properties.output.properties.languages.items.pattern);
const integer = (value, min = 0) => Number.isSafeInteger(value) && value >= min;
const text = value => value === null || typeof value === 'string';
const arrayOfText = value => Array.isArray(value) && value.every(item => typeof item === 'string');
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const keysMatch = (value, shape) => object(value) && Object.keys(value).length === shape.required.length
  && shape.required.every(key => Object.hasOwn(value, key));

function invalid() { throw new Error('review.invalidFile'); }

function validOutput(output) {
  const shape = schema.$defs.entry.properties.output;
  return keysMatch(output, shape) && SONG_VALUES.includes(output.is_song) && VOICE_VALUES.includes(output.is_virtual_singer)
    && arrayOfText(output.languages) && output.languages.length > 0
    && new Set(output.languages).size === output.languages.length
    && output.languages.every(lang => languagePattern.test(lang) && !aliases.includes(lang))
    && (!output.languages.includes('无语言') || output.languages.length === 1);
}

/** Accept the existing v1 reference/Task contract without dropping source metadata or partial-run status. */
export function validateReviewReport(report) {
  if (!keysMatch(report, schema) || report.schema_version !== 1 || !schema.properties.source.enum.includes(report.source)
    || !schema.properties.status.enum.includes(report.status) || !integer(report.selected_count, 1)
    || !integer(report.processed_count) || !Array.isArray(report.results) || !Array.isArray(report.batches)
    || report.processed_count !== report.results.length || report.selected_count < report.processed_count
    || (report.status === 'completed' && report.selected_count !== report.processed_count)) invalid();
  const ids = new Set();
  for (const entry of report.results) {
    if (!keysMatch(entry, schema.$defs.entry) || !integer(entry.aid, 1) || ids.has(entry.aid)
      || !keysMatch(entry.input, schema.$defs.entry.properties.input)
      || !text(entry.input.title) || !text(entry.input.description)
      || !(entry.input.tag_new === null || arrayOfText(entry.input.tag_new))
      || !validOutput(entry.output) || !keysMatch(entry.review, schema.$defs.entry.properties.review)
      || !REVIEW_VALUES.includes(entry.review.status) || typeof entry.review.note !== 'string') invalid();
    ids.add(entry.aid);
  }
  for (const batch of report.batches) {
    const shape = schema.properties.batches.items;
    if (!keysMatch(batch, shape) || !integer(batch.count, 1) || !integer(batch.elapsed_ms)
      || !keysMatch(batch.usage, shape.properties.usage)
      || Object.values(batch.usage).some(value => value !== null && !integer(value))) invalid();
  }
  return report;
}

export function parseReviewFile(textValue) {
  try { return validateReviewReport(JSON.parse(textValue.replace(/^\uFEFF/, ''))); }
  catch { return invalid(); }
}

/** Clicking a concrete language after “无语言” replaces it; newly choosing “无语言” clears the others. */
export function changeReviewLanguages(previous, selected) {
  if (selected.length === 1 && selected[0] === '无语言') return ['无语言'];
  if (selected.includes('无语言') && !previous.includes('无语言')) return ['无语言'];
  const values = [...new Set(selected.filter(value => value !== '无语言'))];
  if (!values.length) return ['未知语言'];
  const rank = value => ['汉语', '日语', '英语', '朝鲜语'].indexOf(value);
  return values.sort((a, b) => {
    const priority = value => value === '未知语言' ? 6 : rank(value) < 0 ? 4 : rank(value);
    return priority(a) - priority(b);
  });
}

/** Only output/review are editable. Any changed judgment or note must be confirmed again. */
export function updateReviewEntry(report, aid, { output, note, status } = {}) {
  let found = false;
  const results = report.results.map(entry => {
    if (entry.aid !== aid) return entry;
    found = true;
    const nextOutput = output ?? entry.output;
    const nextNote = note ?? entry.review.note;
    if (!validOutput(nextOutput) || typeof nextNote !== 'string' || (status && !REVIEW_VALUES.includes(status))) invalid();
    const changed = JSON.stringify(nextOutput) !== JSON.stringify(entry.output) || nextNote !== entry.review.note;
    return { ...entry, output: nextOutput, review: { status: changed ? '待复核' : (status ?? entry.review.status), note: nextNote } };
  });
  if (!found) invalid();
  return { ...report, results };
}

/** The reviewer explicitly adopts unchanged predictions; only review status changes, never the three judgments. */
export function acceptReviewDefaults(report) {
  validateReviewReport(report);
  return { ...report, results: report.results.map(entry => entry.review.status === '已确认' ? entry
    : { ...entry, review: { ...entry.review, status: '已确认' } }) };
}

/** Corrections in the list-first workflow are accepted and saved immediately. */
export function applyReviewCorrection(report, aid, change) {
  return updateReviewEntry(updateReviewEntry(report, aid, change), aid, { status: '已确认' });
}

export function isVirtualSingerSong(entry) {
  return entry.output.is_song === '是' && entry.output.is_virtual_singer === '是';
}

export function filterReviewEntries(report, { query = '', status = 'all', songScope = 'all', uncertainOnly = false, correctedOnly = false, correctedAids = [] } = {}) {
  const needle = query.trim().toLocaleLowerCase();
  const corrected = new Set(correctedAids);
  return report.results.filter(entry => (status === 'all' || entry.review.status === status)
    && (songScope === 'all' || (songScope === 'virtual-song' ? isVirtualSingerSong(entry) : songScope === 'other' && !isVirtualSingerSong(entry)))
    && (!correctedOnly || corrected.has(entry.aid))
    && (!needle || `${entry.aid} ${entry.input.title ?? ''}`.toLocaleLowerCase().includes(needle))
    && (!uncertainOnly || entry.output.is_song === '不确定' || entry.output.is_virtual_singer === '不确定'
      || entry.output.languages.includes('未知语言')));
}

export function reviewExportName(fileName, now = new Date()) {
  const base = (fileName || 'reference_answers.json').split(/[\\/]/).pop()
    .replace(/\.json$/i, '').replace(/\.reviewed-.+$/, '').replace(/[^\p{L}\p{N}_.-]/gu, '_') || 'reference_answers';
  return `${base}.reviewed-${now.toISOString().replace(/[:.]/g, '-')}.json`;
}

export function serializeReviewReport(report) {
  validateReviewReport(report);
  return `${JSON.stringify(report, null, 2)}\n`;
}
