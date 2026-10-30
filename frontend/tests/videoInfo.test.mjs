import assert from 'node:assert/strict';
import test from 'node:test';
import { formatVideoDuration, hasHangingOpeningPunctuation, normalizeVideoAid } from '../src/components/custom/VideoInfo/videoInfo.js';

test('VideoInfo accepts aid numbers and av-prefixed input while preserving 64-bit IDs', () => {
  for (const input of [6009789, '6009789', 'av6009789', 'AV6009789', ' av6009789 ']) {
    assert.equal(normalizeVideoAid(input), '6009789');
  }
  assert.equal(normalizeVideoAid('9007199254740993'), '9007199254740993');
  assert.equal(normalizeVideoAid('av9223372036854775807'), '9223372036854775807');
});

test('VideoInfo rejects unsafe numbers, invalid IDs, and IDs outside the API range', () => {
  for (const input of [undefined, null, false, {}, '', 'av', 0, -1, 1.5, Infinity, NaN,
    '0', '06009789', 'av06009789', 'av 6009789', '1e3', '1.0', 'BV1Qs411k7Qv',
    '9223372036854775808', '9'.repeat(100), Number('9007199254740993')]) {
    assert.equal(normalizeVideoAid(input), null, String(input));
  }
});

test('opening brackets and quotes hang only when they start the video title', () => {
  for (const punctuation of [...'【（《〈「『〔［｛〖“‘']) {
    assert.equal(hasHangingOpeningPunctuation(`  ${punctuation}乐正绫原创`), true);
  }
  for (const title of ['', null, '世末歌者', '乐正绫【原创】', '】世末歌者']) {
    assert.equal(hasHangingOpeningPunctuation(title), false);
  }
});

test('video duration distinguishes missing values from zero and supports hour-long videos', () => {
  assert.equal(formatVideoDuration(0), '0:00');
  assert.equal(formatVideoDuration(363), '6:03');
  assert.equal(formatVideoDuration(3661), '1:01:01');
  assert.equal(formatVideoDuration(59.9), '0:59');
  for (const value of [null, undefined, -1, NaN, Infinity, '363']) assert.equal(formatVideoDuration(value), null);
});
