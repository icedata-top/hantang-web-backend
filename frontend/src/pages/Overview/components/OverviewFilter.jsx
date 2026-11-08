import { getLanguageSettings } from '../../../locales/languages.js';
import { getTranslator } from '../../../i18n.js';
import { useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { QuestionCircleOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { Button, DatePicker, Tooltip } from 'antd';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import {
  MIN_METRICS_DATE as MIN_OVERVIEW_DATE, getMaxSelectableDate as getOverviewMaxSelectableDate,
  isDateRangeDisabled as isOverviewDateDisabled,
} from '../../../utils/metricsDateRange.js';
import { getDefaultOverviewFilter, getOverviewRangePresets } from '../overviewDateRange.js';
import { createDebouncedAction } from '../../../utils/debounce.js';
import './OverviewFilter.css';
export { getOverviewMaxSelectableDate, getDefaultOverviewFilter, getOverviewRangePresets };

const { RangePicker } = DatePicker;

/**
 * 指标时间窗说明：所选结束日期的次日 0 时 / 4 时为区间右端（T+1）。
 * @param {string} startDate YYYY-MM-DD
 * @param {string} endDate YYYY-MM-DD
 */
function buildFilterTimeHints(startDate, endDate, language) {
  const t = getTranslator(language);
  const { dateLocale } = getLanguageSettings(language);
  const dateFormat = t('date.filterFormat');
  const start = dayjs(startDate).locale(dateLocale).format(dateFormat);
  const end = dayjs(endDate).add(1, 'day').locale(dateLocale).format(dateFormat);
  return {
    submissionLine: t('overview.submissionWindow', { start, end }),
    videoStatsLine: t('overview.metricsWindow', { start, end }),
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
 * @param {string|null} props.latestRecordDate 最新快照日，默认与快捷范围结束于其前一天
 * @param {boolean} [props.dateLoading]
 * @param {boolean} [props.queryLoading]
 * @param {(next: { startDate?: string, endDate?: string }) => void} [props.onFilterChange]
 */
export default function OverviewFilter({ startDate, endDate, latestRecordDate = null, dateLoading = false, queryLoading = false, onFilterChange }) {
  const { i18n, t } = useTranslation();
  const language = i18n.resolvedLanguage || i18n.language;

  const dateLocale = getLanguageSettings(language).dateLocale;
  const initialRange = useMemo(() => {
    if (startDate && endDate) return [dayjs(startDate), dayjs(endDate)];
    return null;
  }, [startDate, endDate]);

  const [draftRange, setDraftRange] = useState(initialRange);
  const [dirty, setDirty] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const dateLabelId = useId();
  const debouncedQuery = useMemo(() => createDebouncedAction((nextFilter) => {
    onFilterChange?.(nextFilter);
    setDirty(false);
  }), [onFilterChange]);

  useEffect(() => () => debouncedQuery.cancel(), [debouncedQuery]);

  useEffect(() => {
    if (dateLoading || queryLoading) debouncedQuery.cancel();
  }, [dateLoading, queryLoading, debouncedQuery]);

  useEffect(() => {
    if (dirty) return;
    setDraftRange(initialRange);
  }, [initialRange, dirty]);

  const handleRangeChange = (dates) => {
    debouncedQuery.cancel();
    setDraftRange(dates);
    const nextStart = dates?.[0]?.format('YYYY-MM-DD');
    const nextEnd = dates?.[1]?.format('YYYY-MM-DD');
    setDirty(nextStart !== startDate || nextEnd !== endDate);
  };

  const handleReset = () => {
    debouncedQuery.cancel();
    setDraftRange(initialRange);
    setDirty(false);
  };

  const timeHints = useMemo(() => {
    if (!startDate || !endDate) return null;
    return buildFilterTimeHints(startDate, endDate, language);
  }, [startDate, endDate, language]);

  const calendarYearMonth = dayjs().format('YYYY-MM');
  const defaultPickerValue = useMemo(() => getDefaultRangePanelMonths(dateLocale), [calendarYearMonth, dateLocale]);
  const pickerRange = useMemo(() => draftRange?.map((date) => date?.locale(dateLocale)) ?? null, [draftRange, dateLocale]);
  const canQuery = Boolean(draftRange?.[0]?.isValid() && draftRange?.[1]?.isValid());

  const handleQuery = () => {
    if (dateLoading || queryLoading || !canQuery) return;
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
    debouncedQuery({ startDate: nextStart, endDate: nextEnd });
  };

  return (
    <div className="overview-filter">
      <div className="overview-filter-date-heading">
        <span className="overview-filter-date-label" id={dateLabelId}>
          {t("日期范围")}
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
              aria-label={t("指标时间范围说明")}
            >
              <QuestionCircleOutlined />
            </span>
          </Tooltip>
        ) : null}
      </div>
      <RangePicker
        variant="borderless"
        data-open={pickerOpen}
        value={pickerRange}
        presets={getOverviewRangePresets(language, latestRecordDate)}
        disabled={dateLoading}
        disabledDate={isOverviewDateDisabled}
        defaultPickerValue={defaultPickerValue}
        onChange={handleRangeChange}
        onOpenChange={setPickerOpen}
        allowClear
        format="YYYY-MM-DD"
        placeholder={[t("开始日期"), t("结束日期")]}
        aria-labelledby={dateLabelId}
      />
      <div className="overview-filter-actions">
        <Button
          className="ds-button"
          data-variant="secondary"
          icon={<ReloadOutlined aria-hidden="true" />}
          disabled={dateLoading}
          onClick={handleReset}
        >{t("重置")}</Button>
        <Button
          className="ds-button"
          data-variant="primary"
          icon={<SearchOutlined aria-hidden="true" />}
          loading={queryLoading}
          disabled={dateLoading || queryLoading || !canQuery}
          aria-busy={queryLoading}
          onClick={handleQuery}
        >{t("查询")}</Button>
      </div>
    </div>
  );
}
