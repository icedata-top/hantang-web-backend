import assert from 'node:assert/strict';
import test from 'node:test';
import { parseVideoListQuery, videoListParams, VIDEO_LIST_DEFAULTS } from '../src/pages/video/videoListQuery.js';

test('song browse URLs round-trip filters and pagination independently of layout', () => {
  const query = { ...VIDEO_LIST_DEFAULTS, startDate: '2026-02-01', endDate: '2026-02-28', honor: 'legend', typeId: 30, minView: 0, page: 3, pageSize: 50, sortBy: 'like', order: 'asc' };
  const params = videoListParams({ ...query, layout: 'cards' });
  assert.equal(params.has('layout'), false);
  params.set('layout', 'cards');
  assert.deepEqual(parseVideoListQuery(params), query);
});

test('invalid dates and numeric limits cannot reach the browse API from a shared URL', () => {
  const query = parseVideoListQuery(new URLSearchParams('startDate=2026-02-30&endDate=2008-01-01&typeId=0&minView=-1&page=1.5&pageSize=101&sortBy=sql&order=sql&honor=sql'));
  assert.deepEqual(query, VIDEO_LIST_DEFAULTS);
  const reversed = parseVideoListQuery(new URLSearchParams('startDate=2026-11-04&endDate=2026-11-03'));
  assert.equal(reversed.startDate, ''); assert.equal(reversed.endDate, '');
  assert.equal(parseVideoListQuery(new URLSearchParams('startDate=2024-02-29')).startDate, '2024-02-29');
  assert.equal(parseVideoListQuery(new URLSearchParams('endDate=2026-11-04')).endDate, '2026-11-04');
  assert.equal(parseVideoListQuery(new URLSearchParams('minView=9007199254740992')).minView, null);
});
