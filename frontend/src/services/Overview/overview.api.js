/**
 * 总览页 API
 * 请求参数约定：startDate / endDate 为 YYYY-MM-DD
 * - MOCK 环境：返回本地模拟数据
 * - DEV/PROD：发起真实 HTTP 请求
 *
 * 当前 API 列表（草拟 URL，无域名）：
 * - fetchOverviewIndicators            -> /overview/get-indicators            （指标卡片）
 * - fetchOverviewTrend                 -> /overview/get-trend                 （折线图卡片）
 * - fetchOverviewPartitionSubmissions  -> /overview/get-partition-submissions （饼图卡片）
 * - fetchOverviewViewHistogram         -> /overview/get-view-histogram        （直方图卡片）
 * - fetchOverviewGateCrossings         -> /overview/get-gate-crossings        （过线明细）
 */
import { isMockEnv } from '../../config/runtimeEnv.js';
import { postJson } from '../http/client.js';

/** 与首页等服务对齐的业务成功码 */
export const OVERVIEW_API_CODE = {
  OK: 0,
};

/**
 * @typedef {Object} OverviewIndicator
 * @property {string} name 指标标识，如 newVideoCount、view、favorite
 * @property {number} value 当前值
 * @property {number} [yoy] 同比，可选
 * @property {number} [dod] 环比，可选
 */

/**
 * 单日趋势：日期 + 各指标当日值（name 与 OverviewIndicator.name 一致）
 * @typedef {Object} OverviewTrendDay
 * @property {string} date YYYY-MM-DD
 * @property {Record<string, number>} indicators 指标标识 → 数值
 */

/**
 * 二级分区投稿条数（MOCK / 将来与后端对齐）
 * @typedef {{ typeId: number, count: number }} OverviewPartitionSubmission
 */

/**
 * @typedef {Object} OverviewIndicatorsPayload
 * @property {string} startDate
 * @property {string} endDate
 * @property {OverviewIndicator[]} indicators
 */

/**
 * @typedef {{ code: string, label: string, count: number }} OverviewViewHistogramRow
 */

/**
 * @typedef {Object} OverviewGateCrossing
 * @property {number} id
 * @property {number} aid
 * @property {number} gateValue
 * @property {number|null} previousView
 * @property {number|null} currentView
 * @property {string} crossedAt
 * @property {string} createdAt
 */

/**
 * @typedef {Object} OverviewPartitionSubmissionsPayload
 * @property {string} startDate
 * @property {string} endDate
 * @property {OverviewPartitionSubmission[]} rows
 */

/**
 * @typedef {Object} OverviewTrendPayload
 * @property {string} startDate
 * @property {string} endDate
 * @property {OverviewTrendDay[]} rows
 */

/**
 * @typedef {Object} OverviewGateCrossingsPayload
 * @property {OverviewGateCrossing[]} rows
 * @property {number} total
 * @property {number} page
 * @property {number} pageSize
 */

/**
 * @template T
 * @typedef {Object} ApiResult
 * @property {number} code
 * @property {string} message
 * @property {T} [data]
 */

const MOCK_INDICATORS_BASE = [
  { name: 'newVideoCount', value: 1435, yoy: 0.15, dod: 0.11 },
  { name: 'activeUserCount', value: 107, yoy: -0.05, dod: -0.03 },
  { name: 'view', value: 1274561, yoy: 0.012, dod: 0.008 },
  { name: 'favorite', value: 109143, yoy: -0.011, dod: 0.015 },
];

/** 本地日历递增一天，返回 YYYY-MM-DD */
function nextDayYmd(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + 1);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * 生成 [startDate, endDate] 闭区间内每日趋势 MOCK（含周末波动）
 * @param {string} startDate YYYY-MM-DD
 * @param {string} endDate YYYY-MM-DD
 * @returns {OverviewTrendDay[]}
 */
export function buildMockTrendForRange(startDate, endDate) {
  if (!startDate || !endDate || startDate > endDate) {
    return [];
  }

  const rows = [];
  let cur = startDate;
  let idx = 0;

  while (cur <= endDate) {
    const wobble = Math.sin(idx * 0.35) * 9;
    const weekend = [0, 6].includes(new Date(`${cur}T12:00:00`).getDay()) ? -12 : 0;

    rows.push({
      date: cur,
      indicators: {
        newVideoCount: Math.max(0, Math.round(118 + wobble + weekend + (idx % 6) * 2)),
        activeUserCount: Math.max(0, Math.round(92 + wobble * 0.55 + weekend * 0.4 + (idx % 5))),
        view: Math.max(0, Math.round(920000 + idx * 11000 + wobble * 1800 + weekend * 4000)),
        favorite: Math.max(0, Math.round(88500 + idx * 320 + wobble * 160 + weekend * 350)),
        like: Math.max(0, Math.round(12100 + idx * 45 + wobble * 12 + weekend * 80)),
        coin: Math.max(0, Math.round(8200 + idx * 28 + wobble * 9 + weekend * 50)),
        share: Math.max(0, Math.round(2100 + idx * 9 + wobble * 4 + weekend * 15)),
        reply: Math.max(0, Math.round(5100 + idx * 22 + wobble * 7 + weekend * 40)),
        danmaku: Math.max(0, Math.round(1580 + idx * 7 + wobble * 3 + weekend * 12)),
      },
    });

    idx += 1;
    cur = nextDayYmd(cur);
  }

  return rows;
}

/** 固定区间示例数据（约两周），便于单独调试或 Storybook */
export const MOCK_INDICATORS_TREND = buildMockTrendForRange('2026-03-21', '2026-04-03');

/** MOCK：各二级分区投稿量（type_id → 投稿数） */
const MOCK_PARTITION_SUBMISSIONS = [
  { typeId: 30, count: 469 },
  { typeId: 21, count: 418 },
  { typeId: 31, count: 85 },
  { typeId: 28, count: 72 },
  { typeId: 47, count: 63 },
  { typeId: 27, count: 62 },
  { typeId: 130, count: 44 },
  { typeId: 25, count: 43 },
  { typeId: 59, count: 40 },
  { typeId: 242, count: 27 },
];

function cloneMockPartitionSubmissions() {
  return MOCK_PARTITION_SUBMISSIONS.map((row) => ({ ...row }));
}

/** 新投稿维度的分区投稿量 MOCK（用于饼图 Segmented） */
const MOCK_PARTITION_SUBMISSIONS_NEW = [
  { typeId: 30, count: 153 },
  { typeId: 21, count: 121 },
  { typeId: 31, count: 27 },
  { typeId: 28, count: 22 },
  { typeId: 47, count: 19 },
  { typeId: 27, count: 18 },
  { typeId: 130, count: 15 },
  { typeId: 25, count: 14 },
  { typeId: 59, count: 12 },
  { typeId: 242, count: 9 },
];

function cloneMockPartitionSubmissionsNew() {
  return MOCK_PARTITION_SUBMISSIONS_NEW.map((row) => ({ ...row }));
}

/**
 * 播放量分桶 MOCK（与 SQL 中 E02–E09 区间一致；label 为横轴展示用）
 * @type {OverviewViewHistogramRow[]}
 */
const MOCK_VIEW_HISTOGRAM_BASE = [
  { code: 'E02', label: '0-10', count: 60683 },
  { code: 'E03', label: '10-100', count: 19334 },
  { code: 'E04', label: '100-1000', count: 57788 },
  { code: 'E05', label: '1000-1万', count: 65705 },
  { code: 'E06', label: '1万-10万', count: 50877 },
  { code: 'E07', label: '10万-100万', count: 18633 },
  { code: 'E08', label: '100万-1000万', count: 2170 },
  { code: 'E09', label: '1000万+', count: 42 },
];

function cloneMockViewHistogram() {
  return MOCK_VIEW_HISTOGRAM_BASE.map((row) => ({ ...row }));
}

/** 新投稿维度的直方图 MOCK（与全部投稿同分桶，数量为独立 MOCK） */
const MOCK_VIEW_HISTOGRAM_NEW_BASE = [
  { code: 'E02', label: '0-10', count: 4820 },
  { code: 'E03', label: '10-100', count: 2104 },
  { code: 'E04', label: '100-1000', count: 8912 },
  { code: 'E05', label: '1000-1万', count: 12408 },
  { code: 'E06', label: '1万-10万', count: 9602 },
  { code: 'E07', label: '10万-100万', count: 3104 },
  { code: 'E08', label: '100万-1000万', count: 412 },
  { code: 'E09', label: '1000万+', count: 6 },
];

function cloneMockViewHistogramNew() {
  return MOCK_VIEW_HISTOGRAM_NEW_BASE.map((row) => ({ ...row }));
}

const MOCK_GATE_CROSSINGS = [
  {
    id: 1064,
    aid: 114953020368274,
    gateValue: 100000,
    previousView: 99872,
    currentView: 100138,
    crossedAt: '2026-04-03T18:24:10Z',
    createdAt: '2026-04-03T18:24:10Z',
  },
  {
    id: 1063,
    aid: 105602919693194,
    gateValue: 10000,
    previousView: 9941,
    currentView: 10016,
    crossedAt: '2026-04-03T16:41:32Z',
    createdAt: '2026-04-03T16:41:32Z',
  },
  {
    id: 1062,
    aid: 1906278059,
    gateValue: 1000000,
    previousView: 999410,
    currentView: 1000264,
    crossedAt: '2026-04-02T23:07:45Z',
    createdAt: '2026-04-02T23:07:45Z',
  },
  {
    id: 1061,
    aid: 701048642,
    gateValue: 1000,
    previousView: 982,
    currentView: 1003,
    crossedAt: '2026-04-02T14:19:02Z',
    createdAt: '2026-04-02T14:19:02Z',
  },
  {
    id: 1060,
    aid: 1558453307,
    gateValue: 200000,
    previousView: 199734,
    currentView: 200041,
    crossedAt: '2026-04-01T08:12:55Z',
    createdAt: '2026-04-01T08:12:55Z',
  },
];

function cloneMockGateCrossings(page, pageSize) {
  const start = (page - 1) * pageSize;
  return MOCK_GATE_CROSSINGS.slice(start, start + pageSize).map((row) => ({ ...row }));
}

/**
 * 构造与后端约定一致的请求体：
 * public class OverviewRequest { String startDate; String endDate; Map<String, String> addtionalParams; }
 * @param {string} startDate
 * @param {string} endDate
 * @param {Record<string, string>} [addtionalParams]
 */
function buildOverviewRequest(startDate, endDate, addtionalParams) {
  return {
    startDate,
    endDate,
    addtionalParams: addtionalParams ?? {},
  };
}

/**
 * 播放量直方图分桶（MOCK）
 * @param {string} startDate YYYY-MM-DD
 * @param {string} endDate YYYY-MM-DD
 * @param {'all'|'new'} [scope='all'] 投稿范围（通过请求参数区分，不在同一响应里返回两套 rows）
 * @returns {Promise<ApiResult<{ startDate: string, endDate: string, rows: OverviewViewHistogramRow[] }>>}
 */
export function fetchOverviewViewHistogram(startDate, endDate, scope = 'all') {
  const isNewScope = scope === 'new';

  if (!isMockEnv()) {
    return postJson('/overview/get-view-histogram', buildOverviewRequest(startDate, endDate, { scope }));
  }

  return Promise.resolve({
    startDate,
    endDate,
    rows: isNewScope ? cloneMockViewHistogramNew() : cloneMockViewHistogram(),
  });
}

/**
 * 获取播放量过线记录
 * @param {string} startDate YYYY-MM-DD
 * @param {string} endDate YYYY-MM-DD
 * @param {{ page?: number, pageSize?: number, aid?: string|number }} [options]
 * @returns {Promise<ApiResult<OverviewGateCrossingsPayload>>}
 */
export function fetchOverviewGateCrossings(startDate, endDate, options = {}) {
  const page = Math.max(1, Number(options.page ?? 1));
  const pageSize = Math.max(1, Number(options.pageSize ?? 8));
  const addtionalParams = {
    page: String(page),
    pageSize: String(pageSize),
  };

  if (options.aid != null && String(options.aid).trim()) {
    addtionalParams.aid = String(options.aid).trim();
  }

  if (!isMockEnv()) {
    return postJson('/overview/get-gate-crossings', buildOverviewRequest(startDate, endDate, addtionalParams));
  }

  return Promise.resolve({
    rows: cloneMockGateCrossings(page, pageSize),
    total: MOCK_GATE_CROSSINGS.length,
    page,
    pageSize,
  });
}

export const OVERVIEW_TREND_TYPE = Object.freeze({
  NEW_VIDEO: 'newVideo',
  ACTIVE_USER: 'activeUser',
  VIDEO_STATS: 'videoStats',
});

/**
 * 获取趋势折线数据（MOCK）
 * @param {string} startDate YYYY-MM-DD
 * @param {string} endDate YYYY-MM-DD
 * @param {string} [trendType='newVideo'] 趋势类型（由前端 Tab 选择）
 * @returns {Promise<ApiResult<OverviewTrendPayload>>}
 */
export function fetchOverviewTrend(startDate, endDate, trendType = OVERVIEW_TREND_TYPE.NEW_VIDEO) {
  if (!isMockEnv()) {
    const requestBody = buildOverviewRequest(startDate, endDate);
    requestBody.addtionalParams = {
      ...(requestBody.addtionalParams ?? {}),
      trendType,
    };
    return postJson('/overview/get-trend', requestBody);
  }

  return Promise.resolve({
    startDate,
    endDate,
    rows: buildMockTrendForRange(startDate, endDate),
  });
}

/**
 * 获取各二级分区投稿数量（MOCK）
 * @param {string} startDate YYYY-MM-DD
 * @param {string} endDate YYYY-MM-DD
 * @param {'all'|'new'} [scope='all'] 投稿范围（通过请求参数区分，不在同一响应里返回两套 rows）
 * @returns {Promise<ApiResult<OverviewPartitionSubmissionsPayload>>}
 */
export function fetchOverviewPartitionSubmissions(startDate, endDate, scope = 'all') {
  const isNewScope = scope === 'new';

  if (!isMockEnv()) {
    return postJson('/overview/get-partition-submissions', buildOverviewRequest(startDate, endDate, { scope }));
  }

  return Promise.resolve({
    startDate,
    endDate,
    rows: isNewScope ? cloneMockPartitionSubmissionsNew() : cloneMockPartitionSubmissions(),
  });
}

/**
 * 获取指标卡片数据（MOCK）
 * @param {string} startDate YYYY-MM-DD
 * @param {string} endDate YYYY-MM-DD
 * @returns {Promise<ApiResult<OverviewIndicatorsPayload>>}
 */
export function fetchOverviewIndicators(startDate, endDate) {
  if (!isMockEnv()) {
    return postJson('/overview/get-indicators', buildOverviewRequest(startDate, endDate));
  }

  return Promise.resolve({
    startDate,
    endDate,
    indicators: MOCK_INDICATORS_BASE.map((row) => ({ ...row })),
  });
}
