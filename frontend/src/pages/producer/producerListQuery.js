export const PRODUCER_LIST_DEFAULTS = Object.freeze({ minFans: null, minVideos: null, sortBy: 'fans', order: 'desc', page: 1, pageSize: 20 });

const integer = (raw, min, max, fallback) => /^(0|[1-9]\d*)$/.test(raw ?? '') && Number(raw) >= min && Number(raw) <= max ? Number(raw) : fallback;

export function parseProducerListQuery(params) {
  return {
    minFans: integer(params.get('minFans'), 0, Number.MAX_SAFE_INTEGER, null),
    minVideos: integer(params.get('minVideos'), 0, 2147483647, null),
    sortBy: ['videoCount', 'userId'].includes(params.get('sortBy')) ? params.get('sortBy') : 'fans',
    order: params.get('order') === 'asc' ? 'asc' : 'desc',
    page: integer(params.get('page'), 1, 2147483647, 1),
    pageSize: integer(params.get('pageSize'), 1, 100, 20),
  };
}

export function producerListParams(query) {
  return new URLSearchParams(Object.entries(query).filter(([key, value]) => Object.hasOwn(PRODUCER_LIST_DEFAULTS, key) && value != null && value !== ''));
}
