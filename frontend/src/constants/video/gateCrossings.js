/**
 * 单视频播放过线记录的取整精度档位与展示工具。
 *
 * 每个过线值只归入「最粗」的一档：先看能否被 1 亿整除，再看 1 千万、1 百万……到 1 千；
 * 例如 1,930,000 是 193 个万，归入整万；2,000,000 是 2 个百万，归入整百万。
 * 不足 1 千或不是 1 千整数倍的记录只出现在「全部」中。
 * 标签使用中文原文作为 i18n key，由页面翻译；模块里不存已翻译文案。
 */

export const GATE_CROSSING_ALL_LEVEL = Object.freeze({ id: 'all', label: '全部' });

/** 由粗到细；分类时按顺序命中第一个能整除的档位。 */
export const GATE_CROSSING_LEVELS_DESCENDING = Object.freeze([
  Object.freeze({ id: 'hundredMillion', unit: 100_000_000, label: '整亿' }),
  Object.freeze({ id: 'tenMillion', unit: 10_000_000, label: '整千万' }),
  Object.freeze({ id: 'million', unit: 1_000_000, label: '整百万' }),
  Object.freeze({ id: 'hundredThousand', unit: 100_000, label: '整十万' }),
  Object.freeze({ id: 'tenThousand', unit: 10_000, label: '整万' }),
  Object.freeze({ id: 'thousand', unit: 1_000, label: '整千' }),
]);

/** 由细到粗，供筛选选项按「整千 … 整亿」展示。 */
export const GATE_CROSSING_LEVELS = Object.freeze([...GATE_CROSSING_LEVELS_DESCENDING].reverse());

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
 * 过线值所属的取整精度档位（最粗一档）；不足 1 千、非 1 千整数倍或非法值返回 null。
 * @param {unknown} gateValue
 * @returns {{ id: string, unit: number, label: string } | null}
 */
export function classifyGateCrossingLevel(gateValue) {
  const value = toGateValue(gateValue);
  if (value == null) return null;
  return GATE_CROSSING_LEVELS_DESCENDING.find(({ unit }) => value >= unit && value % unit === 0) ?? null;
}

/**
 * 统计总条数与各精度档位条数；不属于任何档位的行只计入「全部」。
 * 各档位互不重叠，已归档条数之和 = 全部 − 未归档条数。
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
 * 按精度档位筛选记录；全部或未知档位（null / 'all'）返回浅拷贝的全部记录。
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
 * 供 Select 使用的档位选项：全部在前，其余按整千到整亿展示。
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
