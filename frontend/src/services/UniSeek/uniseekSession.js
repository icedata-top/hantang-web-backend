import { searchTargets } from './uniseekLocal.js';

/** Own one keyword's concurrent requests. Disposing prevents stale responses and cancels fetches. */
export function createUniSeekSession(keyword, api, onChange, scheduler = globalThis) {
  const controller = new AbortController();
  const options = { signal: controller.signal };
  const items = new Map();
  const buffer = new Map();
  const released = { video: 0, producer: 0 };
  const completed = new Set();
  const pending = new Set();
  const errors = {};
  const jobs = new Map();
  let active = true;
  let started = false;
  let nextPage = null;
  let loadingMore = false;
  let moreError = null;
  let videoLimit = 1000;
  let revealTimer = null;
  let firstVideosSettled = !searchTargets(keyword).searchVideos;
  const snapshot = () => ({
    list: [...items.values()], pending: [...pending], errors: { ...errors },
    nextPage, loadingMore, moreError, videoLimit, bufferedCount: buffer.size,
  });
  const emit = () => { if (active) onChange(snapshot()); };
  const pickNext = () => {
    const entries = [...buffer.entries()];
    const vocal = entries.find(([, entry]) => entry.item.type === 'vocal');
    const exact = entries.find(([, entry]) => entry.exact);
    if (vocal || exact) return vocal ?? exact;
    // Weighted fair queue: take the smallest (released + 1) / weight.
    // Songs have weight 3 and creators 1. A late song batch catches up immediately;
    // source order and already visible positions stay stable. This is provisional,
    // not a unified relevance score for the three entity types.
    const video = entries.find(([, entry]) => entry.item.type === 'video');
    const producer = firstVideosSettled || released.producer < 2
      ? entries.find(([, entry]) => entry.item.type === 'producer') : null;
    if (video && producer) return (released.video + 1) / 3 <= released.producer + 1 ? video : producer;
    return video ?? producer;
  };
  const reveal = () => {
    if (!active || revealTimer !== null) return;
    const next = pickNext();
    if (!next) return;
    const [key, { item }] = next;
    buffer.delete(key);
    items.set(key, item);
    if (item.type in released) released[item.type]++;
    emit();
    // One timer for the entire session, at most one new card per 90 ms.
    revealTimer = scheduler.setTimeout(() => { revealTimer = null; reveal(); }, 90);
  };
  const append = (list, exact = false) => {
    for (const item of list ?? []) {
      const key = `${item.type}-${item.id}`;
      const queued = buffer.get(key);
      const previous = items.get(key) ?? queued?.item;
      const merged = previous ? { ...previous, ...item, payload: { ...previous.payload, ...item.payload } } : item;
      if (items.has(key)) items.set(key, merged);
      else buffer.set(key, { item: merged, exact: exact || queued?.exact });
    }
    reveal();
  };
  const videosArrived = data => {
    append(data.list);
    nextPage = data.hasMore ? data.nextPage : null;
    videoLimit = data.videoLimit ?? 1000;
  };
  const run = name => {
    if (!active || pending.has(name) || completed.has(name) || !jobs.has(name)) return;
    delete errors[name];
    pending.add(name);
    emit();
    const { fetch, receive } = jobs.get(name);
    Promise.resolve().then(fetch).then(data => {
      if (!active) return;
      receive(data);
      completed.add(name);
    }).catch(error => {
      if (active) errors[name] = error;
    }).finally(() => {
      if (!active) return;
      if (name === 'videos') firstVideosSettled = true;
      pending.delete(name);
      reveal();
      emit();
    });
  };

  return {
    start() {
      if (started || !active) return;
      started = true;
      append(api.searchVocals(keyword));
      emit();
      const targets = searchTargets(keyword);
      if (targets.aid) jobs.set('videoId', { fetch: () => api.searchVideoById(targets.aid, options), receive: data => append(data.list, true) });
      if (targets.userId) jobs.set('producerId', { fetch: () => api.searchProducerById(targets.userId, options), receive: data => append(data.list, true) });
      jobs.set('producers', { fetch: () => api.searchProducers(keyword, options), receive: data => append(data.list) });
      if (targets.searchVideos) jobs.set('videos', { fetch: () => api.searchVideos({ keyword, page: 1, pageSize: 30 }, options), receive: videosArrived });
      for (const name of jobs.keys()) run(name);
    },
    retry: run,
    async loadMore() {
      if (!active || loadingMore || buffer.size || pending.has('videos') || !nextPage) return;
      loadingMore = true;
      moreError = null;
      emit();
      try {
        const data = await api.searchVideos({ keyword, page: nextPage, pageSize: 30 }, options);
        if (active) videosArrived(data);
      } catch (error) { if (active) moreError = error; }
      finally {
        loadingMore = false;
        emit();
      }
    },
    dispose() {
      active = false;
      controller.abort();
      if (revealTimer !== null) scheduler.clearTimeout(revealTimer);
      buffer.clear();
    },
  };
}
