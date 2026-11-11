import assert from 'node:assert/strict';
import test from 'node:test';
import { ADMIN_NAV, findAdminLeaf } from '../src/pages/Admin/adminNav.js';
import { collectionWindow, summarizeCollectionDays } from '../src/pages/Admin/collectionModel.js';

test('data center exposes collection and processing and removes the former data pages', () => {
  const group = ADMIN_NAV.find(node => node.key === 'data');
  assert.equal(group.zh, '数据中心');
  assert.deepEqual(group.children.map(node => node.key), ['collection', 'processing']);
  assert.equal(findAdminLeaf('/admin/data/collection').key, 'collection');
  assert.equal(findAdminLeaf('/admin/data/processing').key, 'processing');
  for (const path of ['checkpoints', 'timeline', 'videos']) assert.equal(findAdminLeaf(`/admin/data/${path}`), null);
});

test('collection window uses completed Beijing calendar days across UTC midnight and new year', () => {
  const before = collectionWindow(Date.parse('2026-11-11T15:59:59Z'));
  assert.equal(before.startDate, '2026-11-04');
  assert.equal(before.endDate, '2026-11-10');
  const after = collectionWindow(Date.parse('2026-11-11T16:00:00Z'));
  assert.equal(after.startDate, '2026-11-05');
  assert.equal(after.endDate, '2026-11-11');
  const year = collectionWindow(Date.parse('2026-12-31T16:00:00Z'));
  assert.equal(year.startDate, '2026-12-25');
  assert.equal(year.endDate, '2026-12-31');
  assert.equal(new Set(year.days).size, 7);
});

test('missing counts never become zero while record presence and real zero remain visible', () => {
  const days = Array.from({ length: 7 }, (_, i) => ({ hasData: i !== 2, rows: i === 2 ? 0 : 100 }));
  assert.deepEqual(summarizeCollectionDays(days), { covered: 6, rows: 600 });
  days[1].rows = null;
  assert.deepEqual(summarizeCollectionDays(days), { covered: 6, rows: null });
  assert.deepEqual(summarizeCollectionDays([]), { covered: 0, rows: null });
  assert.deepEqual(summarizeCollectionDays(Array.from({ length: 7 }, () => ({ hasData: false, rows: 0 }))), { covered: 0, rows: 0 });
});
