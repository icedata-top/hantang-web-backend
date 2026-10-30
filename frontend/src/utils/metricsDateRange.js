import dayjs from 'dayjs';

/** 可选数据的最早日期（含） */
export const MIN_METRICS_DATE = dayjs('2025-10-01').startOf('day');

/** 可选的最晚日期：昨天（含），不含今天 */
export function getMaxSelectableDate() {
  return dayjs().subtract(1, 'day').startOf('day');
}

/**
 * 页面初始筛选：最近 7 个自然日（以昨天为结束日，不含今天），并受 MIN 日期夹取。
 * @returns {{ startDate: string, endDate: string }}
 */
export function getDefaultDateRange() {
  const end = getMaxSelectableDate();
  let start = end.subtract(6, 'day');
  if (start.isBefore(MIN_METRICS_DATE, 'day')) {
    start = MIN_METRICS_DATE;
  }
  return {
    startDate: start.format('YYYY-MM-DD'),
    endDate: end.format('YYYY-MM-DD'),
  };
}

/**
 * 不含今天的快捷范围：结束日为昨天，「最近7天」为昨天起往前共 7 天（含），「最近30天」同理。
 */
export function getDateRangePresets(isZh = true) {
  return [
    {
      label: isZh ? '最近7天' : 'Last 7 days',
      value: () => {
        const end = getMaxSelectableDate();
        let start = end.subtract(6, 'day');
        if (start.isBefore(MIN_METRICS_DATE, 'day')) {
          start = MIN_METRICS_DATE;
        }
        return [start.startOf('day'), end.endOf('day')];
      },
    },
    {
      label: isZh ? '最近14天' : 'Last 14 days',
      value: () => {
        const end = getMaxSelectableDate();
        let start = end.subtract(13, 'day');
        if (start.isBefore(MIN_METRICS_DATE, 'day')) {
          start = MIN_METRICS_DATE;
        }
        return [start.startOf('day'), end.endOf('day')];
      },
    },
    {
      label: isZh ? '最近30天' : 'Last 30 days',
      value: () => {
        const end = getMaxSelectableDate();
        let start = end.subtract(29, 'day');
        if (start.isBefore(MIN_METRICS_DATE, 'day')) {
          start = MIN_METRICS_DATE;
        }
        return [start.startOf('day'), end.endOf('day')];
      },
    },
  ];
}

/**
 * @param {import('dayjs').Dayjs} current
 * @param {{ from?: import('dayjs').Dayjs }} [info]
 */
export function isDateRangeDisabled(current, info) {
  const cur = current.startOf('day');
  if (cur.isBefore(MIN_METRICS_DATE, 'day')) return true;

  const maxDay = getMaxSelectableDate();
  if (cur.isAfter(maxDay, 'day')) return true;

  const from = info?.from?.startOf('day');
  if (from) {
    if (cur.isBefore(from, 'day')) return true;
    if (cur.diff(from, 'day') > 29) return true;
  }

  return false;
}
