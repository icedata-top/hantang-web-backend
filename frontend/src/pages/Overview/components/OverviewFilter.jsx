import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { DatePicker, Tooltip } from 'antd';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import {
  MIN_METRICS_DATE as MIN_OVERVIEW_DATE, getMaxSelectableDate as getOverviewMaxSelectableDate,
  getDefaultDateRange as getDefaultOverviewFilter, getDateRangePresets as getOverviewRangePresets,
  isDateRangeDisabled as isOverviewDateDisabled,
} from '../../../utils/metricsDateRange.js';
export { getOverviewMaxSelectableDate, getDefaultOverviewFilter, getOverviewRangePresets };

const { RangePicker } = DatePicker;

/**
 * 指标时间窗说明：所选结束日期的次日 0 时 / 4 时为区间右端（T+1）。
 * @param {string} startDate YYYY-MM-DD
 * @param {string} endDate YYYY-MM-DD
 */
function buildFilterTimeHints(startDate, endDate, isZh) {
  const start = dayjs(startDate).startOf('day');
  const endNext = dayjs(endDate).add(1, 'day').startOf('day');
  if (!isZh) {
    const startDateLabel = start.locale('en').format('MMM D, YYYY');
    const endDateLabel = endNext.locale('en').format('MMM D, YYYY');
    return {
      submissionLine: `New videos and active producers are counted from ${startDateLabel} at 00:00 to ${endDateLabel} at 00:00.`,
      videoStatsLine: `Views, favorites, and other video metrics show increases from ${startDateLabel} at 04:00 to ${endDateLabel} at 04:00.`,
    };
  }
  const a0 = `${start.format('YYYY年M月D日')}0时`;
  const b0 = `${endNext.format('YYYY年M月D日')}0时`;
  const a4 = `${start.format('YYYY年M月D日')}4时`;
  const b4 = `${endNext.format('YYYY年M月D日')}4时`;
  return {
    submissionLine: `新投稿视频、活跃创作者指 ${a0} 至 ${b0} 之间投稿的视频、创作者。`,
    videoStatsLine: `播放量、收藏量等视频数据指 ${a4} 至 ${b4} 产生的增幅。`,
  };
}

/**
 * 弹层双月视图：左侧上月、右侧本月（与 Ant Design `defaultPickerValue` 约定一致，每次打开面板会重置）。
 * @returns {[import('dayjs').Dayjs, import('dayjs').Dayjs]}
 */
function getDefaultRangePanelMonths(locale) {
  return [dayjs().locale(locale).subtract(1, 'month').startOf('month'), dayjs().locale(locale).startOf('month')];
}

/**
 * @param {object} props
 * @param {string} [props.startDate] YYYY-MM-DD
 * @param {string} [props.endDate] YYYY-MM-DD
 * @param {(next: { startDate?: string, endDate?: string }) => void} [props.onFilterChange]
 */
export default function OverviewFilter({ startDate, endDate, onFilterChange }) {
  const { i18n } = useTranslation();
  const isZh = String(i18n?.language || 'zh').toLowerCase().startsWith('zh');
  const t = (zh, en) => (isZh ? zh : en);
  const dateLocale = isZh ? 'zh-cn' : 'en';
  const initialRange = useMemo(() => {
    if (startDate && endDate) return [dayjs(startDate), dayjs(endDate)];
    return null;
  }, [startDate, endDate]);

  const [draftRange, setDraftRange] = useState(initialRange);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (dirty) return;
    setDraftRange(initialRange);
  }, [initialRange, dirty]);

  const handleRangeChange = (dates) => {
    setDraftRange(dates);
    const nextStart = dates?.[0]?.format('YYYY-MM-DD');
    const nextEnd = dates?.[1]?.format('YYYY-MM-DD');
    setDirty(nextStart !== startDate || nextEnd !== endDate);
  };

  const handleReset = () => {
    setDraftRange(initialRange);
    setDirty(false);
  };

  const timeHints = useMemo(() => {
    if (!startDate || !endDate) return null;
    return buildFilterTimeHints(startDate, endDate, isZh);
  }, [startDate, endDate, isZh]);

  const calendarYearMonth = dayjs().format('YYYY-MM');
  const defaultPickerValue = useMemo(() => getDefaultRangePanelMonths(dateLocale), [calendarYearMonth, dateLocale]);
  const pickerRange = useMemo(() => draftRange?.map((date) => date?.locale(dateLocale)) ?? null, [draftRange, dateLocale]);

  const handleConfirm = () => {
    const maxEnd = getOverviewMaxSelectableDate();
    let start = draftRange?.[0]?.startOf('day');
    let end = draftRange?.[1]?.startOf('day');
    if (start && end) {
      if (start.isAfter(end, 'day')) {
        const t = start;
        start = end;
        end = t;
      }
      if (start.isBefore(MIN_OVERVIEW_DATE, 'day')) start = MIN_OVERVIEW_DATE;
      if (end.isAfter(maxEnd, 'day')) end = maxEnd;
      if (end.diff(start, 'day') > 29) {
        end = start.add(29, 'day');
        if (end.isAfter(maxEnd, 'day')) end = maxEnd;
      }
    }
    const nextStart = start?.format('YYYY-MM-DD');
    const nextEnd = end?.format('YYYY-MM-DD');
    onFilterChange?.({ startDate: nextStart, endDate: nextEnd });
    setDirty(false);
  };

  const dateLabelId = 'overview-filter-date-range-label';

  return (
    <div className="overview-filter">
      <div className="overview-filter-date-heading">
        <span className="overview-filter-date-label" id={dateLabelId}>
          {t('日期范围', 'Date range')}
        </span>
        {timeHints ? (
          <Tooltip
            overlayClassName="overview-filter-time-hint-tooltip"
            title={
              <div className="overview-filter-tooltip-body">
                <p className="overview-filter-tooltip-para">{timeHints.submissionLine}</p>
                <p className="overview-filter-tooltip-para">{timeHints.videoStatsLine}</p>
              </div>
            }
          >
            <span
              className="overview-filter-hint-trigger"
              role="button"
              tabIndex={0}
              aria-label={t('指标时间范围说明', 'Metric time window details')}
            >
              <QuestionCircleOutlined />
            </span>
          </Tooltip>
        ) : null}
      </div>
      <RangePicker
        value={pickerRange}
        presets={getOverviewRangePresets(isZh)}
        disabledDate={isOverviewDateDisabled}
        defaultPickerValue={defaultPickerValue}
        onChange={handleRangeChange}
        allowClear
        format="YYYY-MM-DD"
        placeholder={[t('开始日期', 'Start date'), t('结束日期', 'End date')]}
        aria-labelledby={dateLabelId}
      />
      {dirty ? (
        <div className="overview-filter-actions">
          <button type="button" className="ds-button" data-variant="secondary" onClick={handleReset}>{t('重置', 'Reset')}</button>
          <button type="button" className="ds-button" data-variant="primary" onClick={handleConfirm}>
            {t('确定', 'Apply')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
