/**
 * 单视频播放过线记录的量级档位与展示工具。
 *
 * 量级范围按契约固定、含两端且互不重叠；1000 以下的记录只在「全部」中出现。
 * 标签使用中文原文作为 i18n key，由页面翻译；模块里不存已翻译文案。
 */

export const GATE_CROSSING_ALL_LEVEL = Object.freeze({ id: 'all', label: '全部' });

export const GATE_CROSSING_LEVELS = Object.freeze([
  Object.freeze({ id: 'thousand', min: 1_000, max: 9_999, label: '整千' }),
  Object.freeze({ id: 'tenThousand', min: 10_000, max: 99_999, label: '整万' }),
  Object.freeze({ id: 'hundredThousand', min: 100_000, max: 999_999, label: '整十万' }),
  Object.freeze({ id: 'million', min: 1_000_000, max: 9_999_999, label: '整百万' }),
  Object.freeze({ id: 'tenMillion', min: 10_000_000, max: 99_999_999, label: '整千万' }),
  Object.freeze({ id: 'hundredMillion', min: 100_000_000, max: Infinity, label: '整亿' }),
]);

/** 每页 10 条，由契约固定；分页在筛选后的前端集合上完成。 */
export const GATE_CROSSING_PAGE_SIZE = 10;

/**
 * 过线值必须是 JSON 数字形式的非负安全整数；字符串、小数等非法值返回 null。
 * @param {unknown} value
 * @returns {number | null}
 */
function toGateValue(value) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

/**
 * 播放累计数转成有限数字；null / undefined / 空字符串视为缺失。
 * @param {unknown} value
 * @returns {number | null}
 */
function toViewCount(value) {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * 过线值所属量级；1000 以下或非法值不属于任何量级，返回 null。
 * @param {unknown} gateValue
 * @returns {{ id: string, min: number, max: number, label: string } | null}
 */
export function classifyGateCrossingLevel(gateValue) {
  const value = toGateValue(gateValue);
  if (value == null) return null;
  return GATE_CROSSING_LEVELS.find(({ min, max }) => value >= min && value <= max) ?? null;
}

/**
 * 统计总条数与各量级条数；无效行只计入「全部」，不计入任何量级。
 * @param {ReadonlyArray<{ gateValue?: unknown }>} [rows]
 * @returns {Record<string, number>} 以档位 id 为键，含 all
 */
export function countGateCrossings(rows) {
  const counts = { [GATE_CROSSING_ALL_LEVEL.id]: 0 };
  for (const { id } of GATE_CROSSING_LEVELS) counts[id] = 0;
  for (const row of rows ?? []) {
    counts[GATE_CROSSING_ALL_LEVEL.id] += 1;
    const level = classifyGateCrossingLevel(row?.gateValue);
    if (level) counts[level.id] += 1;
  }
  return counts;
}

/**
 * 按量级筛选记录；全部或未知档位（null / 'all'）返回浅拷贝的全部记录。
 * 未知档位 id 视为数据异常，回退到「全部」而不是清空列表。
 * @param {ReadonlyArray<{ gateValue?: unknown }>} [rows]
 * @param {string | null | undefined} levelId
 */
export function filterGateCrossings(rows, levelId) {
  const source = rows ?? [];
  if (levelId == null || levelId === GATE_CROSSING_ALL_LEVEL.id) return [...source];
  const level = GATE_CROSSING_LEVELS.find(({ id }) => id === levelId);
  if (!level) return [...source];
  return source.filter((row) => classifyGateCrossingLevel(row?.gateValue)?.id === level.id);
}

/**
 * 过线增量 = currentView - previousView；任一端缺失返回 null，真实零保留。
 * @param {{ previousView?: unknown, currentView?: unknown }} [row]
 * @returns {number | null}
 */
export function getGateCrossingDelta(row) {
  const previous = toViewCount(row?.previousView);
  const current = toViewCount(row?.currentView);
  if (previous == null || current == null) return null;
  return current - previous;
}

/**
 * 前端分页；页码越界时收敛到有效范围，空集合仍返回第 1 页。
 * @param {ReadonlyArray<unknown>} [rows]
 * @param {number} [page]
 * @param {number} [pageSize]
 */
export function paginateGateCrossings(rows = [], page = 1, pageSize = GATE_CROSSING_PAGE_SIZE) {
  const source = rows ?? [];
  const size = Number.isSafeInteger(pageSize) && pageSize > 0 ? pageSize : GATE_CROSSING_PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(source.length / size));
  const requested = Number.isFinite(Number(page)) ? Math.trunc(Number(page)) : 1;
  const safePage = Math.min(Math.max(1, requested), pageCount);
  const start = (safePage - 1) * size;
  return { rows: source.slice(start, start + size), page: safePage, pageCount, total: source.length };
}

/**
 * 供 Select 使用的档位选项：全部在前，其余按量级升序。
 * 没有记录的档位禁用；「全部」始终可选。
 * @param {ReadonlyArray<{ gateValue?: unknown }>} [rows]
 */
export function buildGateCrossingLevelOptions(rows) {
  const counts = countGateCrossings(rows);
  return [GATE_CROSSING_ALL_LEVEL, ...GATE_CROSSING_LEVELS].map((level) => ({
    level,
    count: counts[level.id],
    disabled: level.id !== GATE_CROSSING_ALL_LEVEL.id && counts[level.id] === 0,
  }));
}
