import assert from 'node:assert/strict';
import test from 'node:test';
import { videoCardFromSearchItem } from '../src/components/custom/VideoCard/videoCardData.js';
import { splitHighlightParts } from '../src/utils/highlightText.js';

test('search payload nulls never fall back to old cumulative counters', () => {
  const video = videoCardFromSearchItem({ id: '6009789', title: '世末歌者', play: 999, favorite: 8, like: 9,
    payload: { play: null, favorite: 0, like: null } });
  assert.equal(video.view, null);
  assert.equal(video.favorite, 0);
  assert.equal(video.like, null);
});

test('legacy search fields keep zero, cover, dates, and exact large IDs without inventing metrics', () => {
  const video = videoCardFromSearchItem({ id: '9007199254740993', title: '【歌曲】', coverUrl: 'https://example.test/cover.jpg',
    play: 0, publishDate: '2026-10-20', producerId: '396194' });
  assert.equal(video.aid, '9007199254740993');
  assert.equal(video.view, 0);
  assert.equal(video.pic, 'https://example.test/cover.jpg');
  assert.equal(video.pubdate, '2026-10-20');
  assert.equal(video.userId, '396194');
  assert.equal(Object.hasOwn(video, 'favorite'), false);
  assert.equal(Object.hasOwn(video, 'like'), false);
  assert.equal(videoCardFromSearchItem({ id: '1', payload: {} }).view, undefined);
});

test('shared keyword highlighting preserves literal punctuation and plain text', () => {
  const text = '【歌曲】A+B <script> & 世末歌者';
  const parts = splitHighlightParts(text, 'A+B 世末');
  assert.deepEqual(parts.filter(({ hit }) => hit).map(({ text }) => text), ['A+B', '世末']);
  assert.equal(parts.map(({ text }) => text).join(''), text);
  assert.deepEqual(splitHighlightParts(text, ''), [{ text, hit: false }]);
});
