import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { SONG_VALUES, VOICE_VALUES, acceptReviewDefaults, applyReviewCorrection, changeReviewLanguages, filterReviewEntries, isVirtualSingerSong, parseReviewFile, reviewExportName, serializeReviewReport, updateReviewEntry, validateReviewReport } from '../src/pages/Admin/videoReviewModel.js';
import { findAdminLeaf } from '../src/pages/Admin/adminNav.js';

const original = JSON.parse(readFileSync(new URL('../../script/uniseek/reference_answers.json', import.meta.url)));
const firstReview = parseReviewFile(readFileSync(new URL('../../script/uniseek/reference_answers.reviewed-round-1.json', import.meta.url), 'utf8'));
const finalReview = parseReviewFile(readFileSync(new URL('../../script/uniseek/reference_answers.reviewed-final.json', import.meta.url), 'utf8'));
const clone = () => structuredClone(original);
const invalid = report => assert.throws(() => validateReviewReport(report), /review.invalidFile/);

test('all 1000 reference answers round-trip unchanged with the shared v1 contract', () => {
  const report = clone();
  assert.equal(validateReviewReport(report), report);
  assert.equal(report.results.length, 1000);
  assert.deepEqual(parseReviewFile(serializeReviewReport(report)), original);
  assert.deepEqual(parseReviewFile(`\uFEFF${JSON.stringify(report)}`), original);
  assert.deepEqual(SONG_VALUES, ['是', '否', '不确定']);
  assert.deepEqual(VOICE_VALUES, ['是', '否', '混合', '不确定']);
  assert.deepEqual(findAdminLeaf('/admin/content/video-review').ancestors.map(node => node.key), ['content']);
});

test('the first reviewed snapshot preserves all 1000 source inputs and round-trips without changing corrections', () => {
  assert.equal(firstReview.results.length, 1000);
  assert.deepEqual(firstReview.results.map(row => row.aid), original.results.map(row => row.aid));
  assert.deepEqual(firstReview.results.map(row => row.input), original.results.map(row => row.input));
  assert.deepEqual(parseReviewFile(serializeReviewReport(firstReview)), firstReview);
});

test('the completed human reference contains 1000 confirmed answers with unchanged source inputs and valid labels', () => {
  assert.equal(finalReview.status, 'completed');
  assert.equal(finalReview.selected_count, 1000);
  assert.equal(finalReview.processed_count, 1000);
  assert.equal(finalReview.results.length, 1000);
  assert.ok(finalReview.results.every(row => row.review.status === '已确认'));
  assert.deepEqual(finalReview.results.map(row => row.aid), original.results.map(row => row.aid));
  assert.deepEqual(finalReview.results.map(row => row.input), original.results.map(row => row.input));
  assert.deepEqual(parseReviewFile(serializeReviewReport(finalReview)), finalReview);
});

test('virtual song and its strict complement partition all 12 label combinations, including unknown and mixed', () => {
  const results = SONG_VALUES.flatMap(is_song => VOICE_VALUES.map(is_virtual_singer => ({
    ...original.results[0], input: { title: `${is_song}/${is_virtual_singer}`, tag_new: [], description: '' },
    output: { is_song, is_virtual_singer, languages: ['汉语'] },
  }))).map((entry, index) => ({ ...entry, aid: index + 1 }));
  const report = { ...original, results, processed_count: results.length, selected_count: results.length };
  const virtual = filterReviewEntries(report, { songScope: 'virtual-song' });
  const other = filterReviewEntries(report, { songScope: 'other' });
  assert.deepEqual(virtual.map(row => row.aid), [1]);
  assert.deepEqual(other.map(row => row.aid), Array.from({ length: 11 }, (_, index) => index + 2));
  assert.equal(isVirtualSingerSong(virtual[0]), true);
  assert.ok(other.every(row => !isVirtualSingerSong(row)));
  assert.deepEqual(filterReviewEntries(report, { songScope: 'all' }), results);
  assert.deepEqual(filterReviewEntries(report, { songScope: 'virtual-song', query: '否' }), []);
  assert.equal(filterReviewEntries(report, { songScope: 'other', query: '否' }).length, 6);
});

test('song scope composes with uncertainty and local corrections and keeps the reviewed input unchanged', () => {
  const before = JSON.stringify(firstReview);
  const virtual = filterReviewEntries(firstReview, { songScope: 'virtual-song' });
  const other = filterReviewEntries(firstReview, { songScope: 'other' });
  const virtualIds = new Set(virtual.map(row => row.aid));
  assert.equal(virtual.length + other.length, firstReview.results.length);
  assert.ok(other.every(row => !virtualIds.has(row.aid)));
  const uncertain = filterReviewEntries(firstReview, { songScope: 'other', uncertainOnly: true });
  assert.ok(uncertain.length > 0 && uncertain.length < other.length);
  const correctedAids = [virtual[0].aid, other[0].aid];
  assert.deepEqual(filterReviewEntries(firstReview, { songScope: 'virtual-song', correctedOnly: true, correctedAids }).map(row => row.aid), [virtual[0].aid]);
  assert.deepEqual(filterReviewEntries(firstReview, { songScope: 'other', correctedOnly: true, correctedAids }).map(row => row.aid), [other[0].aid]);
  assert.equal(JSON.stringify(firstReview), before);
});

test('editing and confirming preserve all input data and never mutate the imported report', () => {
  const before = clone();
  const row = before.results[0];
  const edited = updateReviewEntry(before, row.aid, { output: { ...row.output, is_song: '是', languages: ['汉语', '日语'] }, note: '已核对歌词' });
  const confirmed = updateReviewEntry(edited, row.aid, { status: '已确认' });
  assert.equal(confirmed.results[0].review.status, '已确认');
  assert.equal(confirmed.results[0].review.note, '已核对歌词');
  assert.deepEqual(confirmed.results.map(entry => entry.input), original.results.map(entry => entry.input));
  assert.deepEqual(confirmed.results.map(entry => entry.aid), original.results.map(entry => entry.aid));
  assert.deepEqual(before, original);
  assert.deepEqual(parseReviewFile(serializeReviewReport(confirmed)), confirmed);
  assert.throws(() => updateReviewEntry(before, -1, { status: '已确认' }));
});

test('default adoption confirms all 1000 predictions without changing any judgment, note, identifier or input', () => {
  const before = clone();
  const adopted = acceptReviewDefaults(before);
  const exported = parseReviewFile(serializeReviewReport(adopted));
  assert.equal(exported.results.filter(entry => entry.review.status === '已确认').length, 1000);
  for (let i = 0; i < before.results.length; i++) {
    assert.deepEqual(exported.results[i].input, before.results[i].input);
    assert.deepEqual(exported.results[i].output, before.results[i].output);
    assert.equal(exported.results[i].aid, before.results[i].aid);
    assert.equal(exported.results[i].review.note, before.results[i].review.note);
  }
  assert.deepEqual(before, original);
  assert.deepEqual(acceptReviewDefaults(exported), exported);
});

test('correcting only one questionable entry exports that correction and accepts every other prediction', () => {
  const adopted = acceptReviewDefaults(clone());
  const first = adopted.results[0];
  const corrected = applyReviewCorrection(adopted, first.aid, { output: { ...first.output, is_song: '是', languages: ['汉语', '英语'] }, note: '已更正语言' });
  assert.equal(corrected.results[0].review.status, '已确认');
  assert.deepEqual(corrected.results[0].output.languages, ['汉语', '英语']);
  assert.equal(corrected.results[0].review.note, '已更正语言');
  assert.deepEqual(corrected.results.slice(1), adopted.results.slice(1));
  assert.deepEqual(corrected.results[0].input, first.input);
  assert.equal(corrected.results[0].aid, first.aid);
  assert.equal(filterReviewEntries(corrected, { correctedOnly: true, correctedAids: [first.aid] }).length, 1);
  assert.equal(filterReviewEntries(corrected, { correctedOnly: true }).length, 0);
  assert.deepEqual(parseReviewFile(serializeReviewReport(corrected)), corrected);
});

test('changed judgments or notes reopen confirmation, while unchanged values and explicit unknowns can remain confirmed', () => {
  const row = original.results[0];
  const confirmed = updateReviewEntry(clone(), row.aid, { status: '已确认' });
  assert.equal(updateReviewEntry(confirmed, row.aid, { note: row.review.note }).results[0].review.status, '已确认');
  assert.equal(updateReviewEntry(confirmed, row.aid, { note: '新的判断依据' }).results[0].review.status, '待复核');
  const pending = updateReviewEntry(confirmed, row.aid, { output: { is_song: '不确定', is_virtual_singer: '不确定', languages: ['未知语言'] } });
  assert.equal(pending.results[0].review.status, '待复核');
  assert.equal(updateReviewEntry(pending, row.aid, { status: '已确认' }).results[0].review.status, '已确认');
});

test('reject malformed fields, duplicate or unsafe IDs, unexpected properties, and inconsistent counts instead of silently losing data', () => {
  for (const mutate of [
    r => { r.schema_version = 2; }, r => { r.secret = 'must not be forwarded'; },
    r => { r.results[1].aid = r.results[0].aid; }, r => { r.results[0].aid = 9007199254740992; },
    r => { r.results[0].input.description = 1; }, r => { delete r.results[0].input.tag_new; },
    r => { r.results[0].output.extra = true; }, r => { r.results[0].output.is_song = true; },
    r => { r.results[0].review.status = '已完成'; }, r => { r.processed_count--; },
    r => { r.selected_count++; }, r => { r.batches = [{ count: 1, elapsed_ms: 0, usage: null }]; },
  ]) { const report = clone(); mutate(report); invalid(report); }
  assert.throws(() => parseReviewFile('not JSON'), /review.invalidFile/);
});

test('language selection keeps no-language exclusive, normalizes ordering, and retains explicit unknowns', () => {
  assert.deepEqual(changeReviewLanguages(['汉语'], ['汉语', '无语言']), ['无语言']);
  assert.deepEqual(changeReviewLanguages(['无语言'], ['无语言', '日语']), ['日语']);
  assert.deepEqual(changeReviewLanguages(['无语言'], ['无语言']), ['无语言']);
  assert.deepEqual(changeReviewLanguages(['日语'], []), ['未知语言']);
  assert.deepEqual(changeReviewLanguages([], ['未知语言', '英语', '汉语', '法语', '日语']), ['汉语', '日语', '英语', '法语', '未知语言']);
  for (const languages of [[], ['汉语', '汉语'], ['无语言', '汉语'], ['韩语'], ['普通话'], ['English'], ['日语', 1]]) {
    const report = clone(); report.results[0].output.languages = languages; invalid(report);
  }
});

test('Task partial/failed reports retain source, run state, usage, and unprocessed count after review and export', () => {
  const report = { ...clone(), source: 'llm', processed_count: 2, status: 'failed', results: original.results.slice(0, 2),
    batches: [{ count: 2, elapsed_ms: 145, usage: { prompt_tokens: null, completion_tokens: 30, total_tokens: null } }] };
  const edited = updateReviewEntry(report, report.results[0].aid, { status: '已确认' });
  const exported = parseReviewFile(serializeReviewReport(edited));
  assert.equal(exported.status, 'failed');
  assert.equal(exported.source, 'llm');
  assert.equal(exported.selected_count, 1000);
  assert.equal(exported.processed_count, 2);
  assert.deepEqual(exported.batches, report.batches);
});

test('filters search title and aid, preserve order, and distinguish no-language from unknown', () => {
  const report = clone();
  const first = report.results[0];
  assert.equal(filterReviewEntries(report, { query: String(first.aid) })[0].aid, first.aid);
  assert.equal(filterReviewEntries(report, { query: first.input.title })[0].aid, first.aid);
  assert.equal(filterReviewEntries(report, { query: 'definitely absent query' }).length, 0);
  const confirmed = updateReviewEntry(report, first.aid, { status: '已确认' });
  assert.equal(filterReviewEntries(confirmed, { status: '已确认' }).length, 1);
  assert.equal(filterReviewEntries(confirmed, { status: '待复核' }).length, 999);
  assert.ok(filterReviewEntries(report, { uncertainOnly: true }).every(entry => entry.output.is_song === '不确定'
    || entry.output.is_virtual_singer === '不确定' || entry.output.languages.includes('未知语言')));
});

test('exports use a fresh timestamped basename and never reuse the source path or filename', () => {
  const now = new Date('2026-11-18T08:09:10.000Z');
  for (const name of ['reference_answers.json', '../中文答案.json', 'C:\\private\\input.json', 'input.reviewed-old.json']) {
    const result = reviewExportName(name, now);
    assert.notEqual(result, name);
    assert.ok(!/[\\/]/.test(result));
    assert.match(result, /\.reviewed-2026-11-18T08-09-10-000Z\.json$/);
  }
});
