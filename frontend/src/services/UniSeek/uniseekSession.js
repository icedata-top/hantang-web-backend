import { searchTargets } from './uniseekLocal.js';

/** Own one keyword's concurrent requests. Disposing prevents stale responses and cancels fetches. */
export function createUniSeekSession(keyword, api, onChange) {
  const controller = new AbortController();
  const options = { signal: controller.signal };
  const items = new Map();
  const pending = new Set();
  const errors = {};
  const jobs = new Map();
  let active = true;
  let started = false;
  let nextPage = null;
  let loadingMore = false;
  let moreError = null;
  let videoLimit = 1000;
  const snapshot = () => ({
    list: [...items.values()], pending: [...pending], errors: { ...errors },
    nextPage, loadingMore, moreError, videoLimit,
  });
  const emit = () => { if (active) onChange(snapshot()); };
  const append = list => {
    for (const item of list ?? []) {
      const key = `${item.type}-${item.id}`;
      const previous = items.get(key);
      // Map retains the first arrival's position; later data fills in metrics/details in place.
      items.set(key, previous ? { ...previous, ...item, payload: { ...previous.payload, ...item.payload } } : item);
    }
  };
  const videosArrived = data => {
    append(data.list);
    nextPage = data.hasMore ? data.nextPage : null;
    videoLimit = data.videoLimit ?? 1000;
  };
  const run = name => {
    if (!active || pending.has(name) || !jobs.has(name)) return;
    delete errors[name];
    pending.add(name);
    emit();
    const { fetch, receive } = jobs.get(name);
    Promise.resolve().then(fetch).then(data => {
      if (!active) return;
      receive(data);
    }).catch(error => {
      if (active) errors[name] = error;
    }).finally(() => {
      if (!active) return;
      pending.delete(name);
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
      if (targets.aid) jobs.set('videoId', { fetch: () => api.searchVideoById(targets.aid, options), receive: data => append(data.list) });
      if (targets.userId) jobs.set('producerId', { fetch: () => api.searchProducerById(targets.userId, options), receive: data => append(data.list) });
      jobs.set('producers', { fetch: () => api.searchProducers(keyword, options), receive: data => append(data.list) });
      if (targets.searchVideos) jobs.set('videos', { fetch: () => api.searchVideos({ keyword, page: 1, pageSize: 30 }, options), receive: videosArrived });
      for (const name of jobs.keys()) run(name);
    },
    retry: run,
    async loadMore() {
      if (!active || loadingMore || pending.has('videos') || !nextPage) return;
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
    dispose() { active = false; controller.abort(); },
  };
}
