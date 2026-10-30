import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { setImmediate as flush } from 'node:timers/promises';
import { createUniSeekSession } from '../src/services/UniSeek/uniseekSession.js';
import { matchVocals, searchTargets } from '../src/services/UniSeek/uniseekLocal.js';

const catalog = JSON.parse(readFileSync(new URL('../src/constants/vocal/vocal-search-info.json', import.meta.url)));
const item = (type, id, payload = {}) => ({ type, id, title: id, payload });
const ids = state => state.list.map(row => `${row.type}-${row.id}`);
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const defaults = overrides => ({
  searchVocals: q => matchVocals(q, catalog),
  searchVideos: async () => ({ list: [], hasMore: false }),
  searchProducers: async () => ({ list: [] }),
  searchVideoById: async () => ({ list: [] }),
  searchProducerById: async () => ({ list: [] }),
  ...overrides,
});

function setup(keyword, overrides) {
  let state;
  const session = createUniSeekSession(keyword, defaults(overrides), next => { state = next; });
  session.start();
  return { session, state: () => state };
}

test('local partial names and aliases include 初音→初音未来 and 天依→洛天依 without network', () => {
  assert.equal(catalog.length, 18);
  assert.equal(matchVocals('初音', catalog)[0].title, '初音未来');
  assert.equal(matchVocals('天依', catalog)[0].title, '洛天依');
  assert.equal(matchVocals('HATSUNE MIKU', catalog)[0].title, '初音未来');
  assert.deepEqual(matchVocals('missing', catalog), []);
  assert.deepEqual(matchVocals(' ', catalog), []);
});

test('numeric text additionally targets AV and UID; explicit AV/BV target only video IDs', () => {
  assert.deepEqual(searchTargets('123456'), { aid: '123456', userId: '123456', searchVideos: true });
  assert.deepEqual(searchTargets('9007199254740993'), { aid: '9007199254740993', userId: '9007199254740993', searchVideos: true });
  assert.deepEqual(searchTargets('AV6009789'), { aid: '6009789', userId: null, searchVideos: false });
  assert.deepEqual(searchTargets('bv1Qs411k7Qv'), { aid: '6009789', userId: null, searchVideos: false });
  for (const q of ['天依', '123abc', '0', '00123', '9223372036854775808', 'BV1Qs411k7Q0']) {
    assert.deepEqual(searchTargets(q), { aid: null, userId: null, searchVideos: true }, q);
  }
});

test('filtered exact-ID results can be empty while numeric keyword searches continue', async () => {
  const h = setup('123456', { searchVideos: async () => ({ list: [item('video', '9')], hasMore: false }) });
  await flush();
  assert.deepEqual(ids(h.state()), ['video-9']);
  assert.deepEqual(h.state().errors, {});
  assert.deepEqual(h.state().pending, []);
  h.session.dispose();
});

test('local singers show synchronously, keyword calls start together, and faster UP results precede songs', async () => {
  const videos = deferred(), producers = deferred(), calls = [];
  const h = setup('天依', {
    searchVideos: request => { calls.push(['videos', request.page]); return videos.promise; },
    searchProducers: () => { calls.push(['producers']); return producers.promise; },
  });
  assert.deepEqual(ids(h.state()), ['vocal-101']);
  await flush(); assert.equal(calls.length, 2);
  producers.resolve({ list: [item('producer', '1')] }); await flush();
  assert.deepEqual(ids(h.state()), ['vocal-101', 'producer-1']);
  assert.deepEqual(h.state().pending, ['videos']);
  videos.resolve({ list: [item('video', '2', { score: 10000 })], hasMore: false }); await flush();
  assert.deepEqual(ids(h.state()), ['vocal-101', 'producer-1', 'video-2']);
  assert.deepEqual(h.state().pending, []);
  h.session.dispose();
});

test('faster songs keep their position when creators arrive later; empty sources do not clear other results', async () => {
  const creators = deferred();
  const h = setup('song', {
    searchProducers: () => creators.promise,
    searchVideos: async () => ({ list: [item('video', '1')], hasMore: false }),
  });
  await flush(); assert.deepEqual(ids(h.state()), ['video-1']);
  creators.resolve({ list: [item('producer', '2')] }); await flush();
  assert.deepEqual(ids(h.state()), ['video-1', 'producer-2']);
  h.session.dispose();
  const empty = setup('初音', {}); await flush();
  assert.deepEqual(ids(empty.state()), ['vocal-401']);
  assert.deepEqual(empty.state().errors, {});
  empty.session.dispose();
});

test('numeric searches start four requests and deduplicate exact and keyword hits while filling data in place', async () => {
  const videoId = deferred(), producerId = deferred(), videos = deferred(), producers = deferred();
  const calls = [];
  const h = setup('123456', {
    searchVideoById: aid => { calls.push(['aid', aid]); return videoId.promise; },
    searchProducerById: uid => { calls.push(['uid', uid]); return producerId.promise; },
    searchVideos: q => { calls.push(['videos', q.keyword]); return videos.promise; },
    searchProducers: q => { calls.push(['producers', q]); return producers.promise; },
  });
  await flush(); assert.equal(calls.length, 4);
  assert.ok(calls.some(([type, id]) => type === 'aid' && id === '123456'));
  assert.ok(calls.some(([type, id]) => type === 'uid' && id === '123456'));
  videoId.resolve({ list: [item('video', '123456', { bvid: 'BV123' })] }); await flush();
  producerId.resolve({ list: [item('producer', '123456', { fanCount: 0 })] }); await flush();
  producers.resolve({ list: [item('producer', '123456', { videoCount: 20 })] }); await flush();
  videos.resolve({ list: [item('video', '123456', { play: 99 }), item('video', '9')], hasMore: false }); await flush();
  assert.deepEqual(ids(h.state()), ['video-123456', 'producer-123456', 'video-9']);
  assert.deepEqual(h.state().list[0].payload, { bvid: 'BV123', play: 99 });
  assert.deepEqual(h.state().list[1].payload, { fanCount: 0, videoCount: 20 });
  h.session.dispose();
});

test('one failed source can retry without refetching successful sources or clearing visible cards', async () => {
  let creatorCalls = 0, videoCalls = 0;
  const h = setup('天依', {
    searchProducers: async () => { if (++creatorCalls === 1) throw new Error('offline'); return { list: [item('producer', '2')] }; },
    searchVideos: async () => { videoCalls++; return { list: [item('video', '1')], hasMore: false }; },
  });
  await flush(); assert.deepEqual(ids(h.state()), ['vocal-101', 'video-1']);
  assert.equal(h.state().errors.producers.message, 'offline');
  h.session.retry('producers'); h.session.retry('producers'); await flush();
  assert.equal(creatorCalls, 2); assert.equal(videoCalls, 1);
  assert.deepEqual(h.state().errors, {});
  assert.deepEqual(ids(h.state()), ['vocal-101', 'video-1', 'producer-2']);
  h.session.dispose();
});

test('pagination can run while creators are pending; duplicate loads are blocked and page failure is retryable', async () => {
  const creators = deferred(), page = deferred();
  const calls = [];
  const h = setup('song', {
    searchProducers: () => creators.promise,
    searchVideos: async request => {
      calls.push(request.page);
      if (request.page === 1) return { list: [item('video', '1')], hasMore: true, nextPage: 2 };
      if (calls.length === 2) return page.promise;
      return { list: [item('video', '2')], hasMore: false };
    },
  });
  await flush(); const pendingPage = h.session.loadMore(); h.session.loadMore();
  assert.deepEqual(calls, [1, 2]);
  page.reject(new Error('offline')); await pendingPage;
  assert.deepEqual(ids(h.state()), ['video-1']); assert.equal(h.state().nextPage, 2);
  assert.equal(h.state().moreError.message, 'offline');
  await h.session.loadMore(); assert.deepEqual(calls, [1, 2, 2]);
  assert.deepEqual(ids(h.state()), ['video-1', 'video-2']); assert.equal(h.state().moreError, null);
  assert.equal(h.state().nextPage, null);
  creators.resolve({ list: [] }); await flush(); h.session.dispose();
});

test('switching keywords aborts requests and late responses cannot update the new search', async () => {
  const late = deferred();
  let oldSignal, updates = 0;
  const old = createUniSeekSession('old', defaults({ searchVideos: (_, { signal }) => { oldSignal = signal; return late.promise; } }), () => { updates++; });
  old.start(); await flush(); old.dispose();
  assert.equal(oldSignal.aborted, true);
  const before = updates;
  const current = setup('初音', {}); await flush();
  late.resolve({ list: [item('video', 'stale')], hasMore: false }); await flush();
  assert.equal(updates, before); assert.deepEqual(ids(current.state()), ['vocal-401']);
  current.session.dispose();
});
