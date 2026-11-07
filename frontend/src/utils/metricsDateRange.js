import dayjs from 'dayjs';
import { getTranslator } from '../i18n.js';

/** 可选数据的最早日期（含） */
export const MIN_METRICS_DATE = dayjs('2025-10-01').startOf('day');

/** 可选的最晚日期：昨天（含），不含今天 */
export function getMaxSelectableDate() {
  return dayjs().subtract(1, 'day').startOf('day');
}

/** 凌晨快照 D 对应的最后一个完整业务日为 D-1。 */
export function getLatestBusinessDate(latestRecordDate) {
  if (!latestRecordDate) return null;
  const snapshotDate = dayjs(latestRecordDate);
  return snapshotDate.isValid() ? snapshotDate.subtract(1, 'day').format('YYYY-MM-DD') : null;
}

/** 指定快捷范围的基准日；省略时沿用昨天，null 表示尚无可用基准。 */
function getRangeEnd(referenceDate, minDate) {
  const end = referenceDate === undefined ? getMaxSelectableDate()
    : referenceDate ? dayjs(referenceDate).startOf('day') : null;
  if (!end?.isValid()) return null;
  const max = getMaxSelectableDate();
  const boundedEnd = end.isAfter(max, 'day') ? max : end;
  return boundedEnd.isBefore(minDate, 'day') ? null : boundedEnd;
}

function getRangeForDays(days, referenceDate, minDate) {
  const end = getRangeEnd(referenceDate, minDate);
  if (!end) return null;
  const start = end.subtract(days - 1, 'day');
  return [start.isBefore(minDate, 'day') ? dayjs(minDate).startOf('day') : start, end];
}

/** 最近 days 个自然日（含基准日），并受可选日期上下限夹取。 */
export function getDefaultDateRange(referenceDate, { days = 7, minDate = MIN_METRICS_DATE } = {}) {
  const range = getRangeForDays(days, referenceDate, minDate);
  if (!range) return null;
  const [start, end] = range;
  return {
    startDate: start.format('YYYY-MM-DD'),
    endDate: end.format('YYYY-MM-DD'),
  };
}

/**
 * 最近 7 / 14 / 30 天：含基准日在内的自然日。省略基准日时仍以昨天为结束日。
 */
export function getDateRangePresets(language = 'zh', referenceDate, { minDate = MIN_METRICS_DATE } = {}) {
  if (!getRangeEnd(referenceDate, minDate)) return [];
  const t = getTranslator(language);
  return [7, 14, 30].map((days) => ({
    label: t(`最近${days}天`),
    value: () => {
      const [start, end] = getRangeForDays(days, referenceDate, minDate);
      return [start.startOf('day'), end.endOf('day')];
    },
  }));
}

/**
 * @param {import('dayjs').Dayjs} current
 * @param {{ from?: import('dayjs').Dayjs }} [info]
 */
export function isDateRangeDisabled(current, info, { minDate = MIN_METRICS_DATE } = {}) {
  const cur = current.startOf('day');
  if (cur.isBefore(minDate, 'day')) return true;

  const maxDay = getMaxSelectableDate();
  if (cur.isAfter(maxDay, 'day')) return true;

  const from = info?.from?.startOf('day');
  if (from) {
    if (cur.isBefore(from, 'day')) return true;
    if (cur.diff(from, 'day') > 29) return true;
  }

  return false;
}
