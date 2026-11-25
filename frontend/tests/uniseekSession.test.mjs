import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { setImmediate as flush } from 'node:timers/promises';
import { createUniSeekSession } from '../src/services/UniSeek/uniseekSession.js';
import { matchVocals, searchTargets, videoDetailSuggestion } from '../src/services/UniSeek/uniseekLocal.js';
import { normalizeContentScope, uniSeekSearchParams } from '../src/services/UniSeek/uniseekScope.js';

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

function setup(keyword, overrides, contentScope) {
  let state, timerId = 0;
  const timers = new Map();
  const scheduler = {
    setTimeout(callback, delay) { assert.equal(delay, 90); timers.set(++timerId, callback); return timerId; },
    clearTimeout(id) { timers.delete(id); },
  };
  const tick = () => {
    const entry = timers.entries().next().value;
    if (!entry) return false;
    timers.delete(entry[0]); entry[1](); return true;
  };
  const drain = () => { let ticks = 0; while (tick()) assert.ok(++ticks < 2000); };
  const session = createUniSeekSession(keyword, defaults(overrides), next => { state = next; }, { scheduler, contentScope });
  session.start();
  return { session, state: () => state, tick, drain, timers };
}

async function settle(h) { await flush(); h.drain(); }

test('scope defaults to Chinese virtual songs and URL changes retain the selected scope', () => {
  for (const raw of [null, undefined, '', 'wrong']) assert.equal(normalizeContentScope(raw), 'chinese_virtual_song');
  for (const scope of ['all', 'virtual_song', 'chinese_virtual_song']) {
    const params = uniSeekSearchParams(' 新关键词 ', scope);
    assert.equal(params.get('keyword'), '新关键词');
    assert.equal(params.get('contentScope'), scope);
    assert.equal(uniSeekSearchParams('', scope).has('keyword'), false);
  }
});

test('keyword pages and exact video IDs all carry the same selected scope', async () => {
  for (const scope of ['all', 'virtual_song', 'chinese_virtual_song']) {
    const requests = [], exactOptions = [];
    const h = setup('123456', {
      searchVideoById: async (_, options) => { exactOptions.push(options); return { list: [] }; },
      searchVideos: async request => {
        requests.push(request);
        return { list: [item('video', String(request.page))], hasMore: request.page === 1, nextPage: 2 };
      },
    }, scope);
    await settle(h);
    await h.session.loadMore(); await settle(h);
    assert.deepEqual(requests.map(request => [request.page, request.contentScope]), [[1, scope], [2, scope]]);
    assert.equal(exactOptions[0].contentScope, scope);
    h.session.dispose();
  }
});

test('switching scope cancels the old session and prevents late unfiltered results from returning', async () => {
  const late = deferred(); let previousSignal;
  const old = setup('song', {
    searchVideos: (_, options) => { previousSignal = options.signal; return late.promise; },
  }, 'all');
  await flush(); old.session.dispose();
  const current = setup('song', { searchVideos: async () => ({ list: [item('video', 'Chinese')], hasMore: false }) }, 'chinese_virtual_song');
  await settle(current);
  late.resolve({ list: [item('video', 'unfiltered')], hasMore: false });
  await settle(old);
  assert.equal(previousSignal.aborted, true);
  assert.deepEqual(ids(current.state()), ['video-Chinese']);
  assert.deepEqual(ids(old.state()), []);
  current.session.dispose();
});

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

test('detail suggestions normalize complete AV/BV IDs and preserve large numeric IDs without fetching', () => {
  for (const [keyword, aid, identifier] of [
    ['1234', '1234', 'av1234'],
    ['av12', '12', 'av12'],
    ['  AV6009789  ', '6009789', 'av6009789'],
    ['bv1Qs411k7Qv', '6009789', 'BV1Qs411k7Qv'],
    ['BV1XfKAzwEi3', '114714449413822', 'BV1XfKAzwEi3'],
    ['9007199254740993', '9007199254740993', 'av9007199254740993'],
    ['9223372036854775807', '9223372036854775807', 'av9223372036854775807'],
  ]) {
    assert.deepEqual(videoDetailSuggestion(keyword), { aid, identifier, jumpUrl: `/videos/${aid}` });
  }
});

test('detail suggestions stay absent for short, incomplete, malformed and out-of-range identifiers', () => {
  for (const keyword of [
    undefined, null, '', '123', ' 123 ', 'av1', 'AV0', '00123', 'av0123', 'BV1Qs411k7Q',
    'BV1Qs411k7Q0', 'BV1Qs411k7Qvv', 'BV1xx411c7mX', '9223372036854775808',
    'av9223372036854775808', 'avBV1Qs411k7Qv', 'uid1234', '123abc', '霜雪千年',
    'https://www.bilibili.com/video/BV1Qs411k7Qv', 'av6009789 标题',
  ]) assert.equal(videoDetailSuggestion(keyword), null, String(keyword));
});

test('filtered exact-ID results can be empty while numeric keyword searches continue', async () => {
  const h = setup('123456', { searchVideos: async () => ({ list: [item('video', '9')], hasMore: false }) });
  await settle(h);
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
  await settle(h); assert.equal(calls.length, 2);
  producers.resolve({ list: [item('producer', '1')] }); await settle(h);
  assert.deepEqual(ids(h.state()), ['vocal-101', 'producer-1']);
  assert.deepEqual(h.state().pending, ['videos']);
  videos.resolve({ list: [item('video', '2', { score: 10000 })], hasMore: false }); await settle(h);
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
  await settle(h); assert.deepEqual(ids(h.state()), ['video-1']);
  creators.resolve({ list: [item('producer', '2')] }); await settle(h);
  assert.deepEqual(ids(h.state()), ['video-1', 'producer-2']);
  h.session.dispose();
  const empty = setup('初音', {}); await settle(empty);
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
  await settle(h); assert.equal(calls.length, 4);
  assert.ok(calls.some(([type, id]) => type === 'aid' && id === '123456'));
  assert.ok(calls.some(([type, id]) => type === 'uid' && id === '123456'));
  videoId.resolve({ list: [item('video', '123456', { bvid: 'BV123' })] }); await settle(h);
  producerId.resolve({ list: [item('producer', '123456', { fanCount: 0 })] }); await settle(h);
  producers.resolve({ list: [item('producer', '123456', { videoCount: 20 })] }); await settle(h);
  videos.resolve({ list: [item('video', '123456', { play: 99 }), item('video', '9')], hasMore: false }); await settle(h);
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
  await settle(h); assert.deepEqual(ids(h.state()), ['vocal-101', 'video-1']);
  assert.equal(h.state().errors.producers.message, 'offline');
  h.session.retry('producers'); h.session.retry('producers'); await settle(h);
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
  await settle(h); const pendingPage = h.session.loadMore(); h.session.loadMore();
  assert.deepEqual(calls, [1, 2]);
  page.reject(new Error('offline')); await pendingPage;
  assert.deepEqual(ids(h.state()), ['video-1']); assert.equal(h.state().nextPage, 2);
  assert.equal(h.state().moreError.message, 'offline');
  await h.session.loadMore(); assert.deepEqual(calls, [1, 2, 2]);
  assert.deepEqual(ids(h.state()), ['video-1', 'video-2']); assert.equal(h.state().moreError, null);
  assert.equal(h.state().nextPage, null);
  creators.resolve({ list: [] }); await settle(h); h.session.dispose();
});

test('switching keywords aborts requests and late responses cannot update the new search', async () => {
  const late = deferred();
  let oldSignal, updates = 0;
  const old = createUniSeekSession('old', defaults({ searchVideos: (_, { signal }) => { oldSignal = signal; return late.promise; } }), () => { updates++; });
  old.start(); await flush(); old.dispose();
  assert.equal(oldSignal.aborted, true);
  const before = updates;
  const current = setup('初音', {}); await settle(current);
  late.resolve({ list: [item('video', 'stale')], hasMore: false }); await flush();
  assert.equal(updates, before); assert.deepEqual(ids(current.state()), ['vocal-401']);
  current.session.dispose();
});

test('20 fast creators are buffered; late songs jump ahead without moving visible cards or refetching creators', async () => {
  const videos = deferred();
  let creatorCalls = 0;
  const h = setup('天依', {
    searchVideos: () => videos.promise,
    searchProducers: async () => {
      creatorCalls++;
      return { list: Array.from({ length: 20 }, (_, i) => item('producer', String(i))) };
    },
  });
  await settle(h);
  assert.deepEqual(ids(h.state()), ['vocal-101', 'producer-0', 'producer-1']);
  assert.equal(h.state().bufferedCount, 18);
  assert.equal(h.timers.size, 0, 'held creators must not cause an idle polling timer');
  const prefix = ids(h.state());
  videos.resolve({ list: Array.from({ length: 15 }, (_, i) => item('video', String(i))), hasMore: false });
  await flush();
  assert.deepEqual(ids(h.state()), [...prefix, 'video-0']);
  const beforeTick = h.state().list.length;
  h.tick();
  assert.equal(h.state().list.length, beforeTick + 1, 'release one card per tick');
  h.drain();
  const rows = ids(h.state());
  assert.deepEqual(rows.slice(0, prefix.length), prefix);
  assert.ok(rows.indexOf('producer-2') > rows.indexOf('video-0'));
  assert.ok(rows.indexOf('producer-2') < rows.indexOf('video-14'), 'creators are not starved by songs');
  assert.deepEqual(h.state().list.filter(x => x.type === 'video').map(x => x.id), Array.from({ length: 15 }, (_, i) => String(i)));
  assert.deepEqual(h.state().list.filter(x => x.type === 'producer').map(x => x.id), Array.from({ length: 20 }, (_, i) => String(i)));
  h.session.retry('producers'); await settle(h);
  assert.equal(creatorCalls, 1);
  assert.equal(h.state().bufferedCount, 0);
  h.session.dispose();
});

test('songs and creators use weighted interleaving when both are buffered', async () => {
  const h = setup('天依', {
    searchVideos: async () => ({ list: Array.from({ length: 6 }, (_, i) => item('video', String(i))), hasMore: false }),
    searchProducers: async () => ({ list: Array.from({ length: 3 }, (_, i) => item('producer', String(i))) }),
  });
  await flush();
  assert.deepEqual(ids(h.state()), ['vocal-101']);
  assert.equal(h.state().bufferedCount, 9);
  h.drain();
  assert.deepEqual(ids(h.state()), ['vocal-101', 'video-0', 'video-1', 'video-2', 'producer-0',
    'video-3', 'video-4', 'video-5', 'producer-1', 'producer-2']);
  h.session.dispose();
});

test('failed or empty songs release held creators and allow only the failed source to retry', async () => {
  for (const fails of [false, true]) {
    const videos = deferred();
    const h = setup('song', {
      searchVideos: () => videos.promise,
      searchProducers: async () => ({ list: Array.from({ length: 5 }, (_, i) => item('producer', String(i))) }),
    });
    await settle(h);
    assert.equal(h.state().list.length, 2);
    if (fails) videos.reject(new Error('offline')); else videos.resolve({ list: [], hasMore: false });
    await settle(h);
    assert.equal(h.state().list.length, 5);
    assert.equal(h.state().bufferedCount, 0);
    assert.equal(Boolean(h.state().errors.videos), fails);
    h.session.dispose();
  }
});

test('buffered duplicates merge, exact IDs jump the queue, and pages wait for the buffer to drain', async () => {
  const exact = deferred();
  let calls = 0;
  const h = setup('123456', {
    searchVideoById: () => exact.promise,
    searchVideos: async () => { calls++; return { list: [item('video', '1'), item('video', '123456', { play: 99 })], hasMore: true, nextPage: 2 }; },
    searchProducers: async () => ({ list: [item('producer', '1'), item('producer', '2')] }),
  });
  await flush();
  exact.resolve({ list: [item('video', '123456', { bvid: 'BV123' })] }); await flush();
  assert.equal(h.state().bufferedCount, 3);
  await h.session.loadMore(); assert.equal(calls, 1);
  h.tick();
  assert.equal(ids(h.state())[1], 'video-123456');
  assert.deepEqual(h.state().list[1].payload, { play: 99, bvid: 'BV123' });
  h.drain();
  assert.equal(ids(h.state()).filter(x => x === 'video-123456').length, 1);
  await h.session.loadMore(); assert.equal(calls, 2);
  h.session.dispose();
});

test('disposing cancels queued releases as well as fetches', async () => {
  const h = setup('song', {
    searchVideos: async () => ({ list: [item('video', '1'), item('video', '2')], hasMore: false }),
  });
  await flush();
  assert.equal(h.state().list.length, 1);
  assert.equal(h.timers.size, 1);
  h.session.dispose();
  assert.equal(h.timers.size, 0);
  assert.equal(h.tick(), false);
  assert.equal(h.state().list.length, 1);
});
