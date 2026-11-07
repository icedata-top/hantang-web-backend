import dayjs from 'dayjs';

export const VIDEO_LIST_DEFAULTS = Object.freeze({ startDate: '', endDate: '', honor: 'all', typeId: null, minView: null, sortBy: 'pubdate', order: 'desc', page: 1, pageSize: 20 });
const integer = (raw, min, max, fallback) => /^(0|[1-9]\d*)$/.test(raw ?? '') && Number(raw) >= min && Number(raw) <= max ? Number(raw) : fallback;
const date = (raw) => /^\d{4}-\d{2}-\d{2}$/.test(raw ?? '') && dayjs(raw).isValid() && dayjs(raw).format('YYYY-MM-DD') === raw && raw >= '2009-01-01' && raw <= '2100-12-31' ? raw : '';

export function parseVideoListQuery(params) {
  const query = { ...VIDEO_LIST_DEFAULTS,
    startDate: date(params.get('startDate')), endDate: date(params.get('endDate')),
    honor: ['none', 'hall', 'legend', 'myth'].includes(params.get('honor')) ? params.get('honor') : 'all',
    typeId: integer(params.get('typeId'), 1, 2147483647, null),
    minView: integer(params.get('minView'), 0, Number.MAX_SAFE_INTEGER, null),
    sortBy: ['view', 'favorite'].includes(params.get('sortBy')) ? params.get('sortBy') : 'pubdate',
    order: params.get('order') === 'asc' ? 'asc' : 'desc',
    page: integer(params.get('page'), 1, 2147483647, 1), pageSize: integer(params.get('pageSize'), 1, 100, 20),
  };
  if (query.startDate && query.endDate && query.startDate > query.endDate) { query.startDate = ''; query.endDate = ''; }
  return query;
}

export function videoListParams(query) {
  return new URLSearchParams(Object.entries(query).filter(([key, value]) => Object.hasOwn(VIDEO_LIST_DEFAULTS, key) && value != null && value !== ''));
}
