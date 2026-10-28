import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FilterOutlined } from '@ant-design/icons';
import { Card, ConfigProvider, Drawer, Spin, Typography, message } from 'antd';
import enUS from 'antd/locale/en_US';
import zhCN from 'antd/locale/zh_CN';
import OverviewFilter, { getDefaultOverviewFilter } from './components/OverviewFilter.jsx';
import OverviewTrendChart, { TAB_SUBMISSIONS } from './components/OverviewTrendChart.jsx';
import OverviewViewHistogramChart from './components/OverviewViewHistogramChart.jsx';
import OverviewGateCrossingsTable from './components/OverviewGateCrossingsTable.jsx';
import IndicatorCell from './components/IndicatorCell.jsx';
import { useMeshParallax } from '../../hooks/useMeshParallax.js';
import { ApiError } from '../../services/http/client.js';
import {
  fetchOverviewGateCrossings,
  fetchOverviewIndicators,
  fetchOverviewSubmissionTrend,
  fetchOverviewTrend,
  fetchOverviewViewHistogram,
  OVERVIEW_TREND_TYPE,
} from '../../services/Overview/overview.api.js';
import './index.css';

const { Text } = Typography;

/** 与 CSS 中 @media 一致：小于此宽度视为移动端，筛选走抽屉 */
const MOBILE_MAX_PX = 767;
const GATE_CROSSINGS_PAGE_SIZE = 8;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= MOBILE_MAX_PX : false,
  );

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_MAX_PX}px)`);
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return isMobile;
}

export default function Overview() {
  const { i18n } = useTranslation();
  const isZh = String(i18n?.language || 'zh').toLowerCase().startsWith('zh');
  const t = (zh, en) => (isZh ? zh : en);
  useMeshParallax(true);

  const [filter, setFilter] = useState(() => getDefaultOverviewFilter());
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState({
    indicators: [],
    viewHistogram: [],
    gateCrossings: [],
    gateCrossingsTotal: 0,
  });
  const [gateCrossingsLoading, setGateCrossingsLoading] = useState(false);
  const [gateCrossingsPage, setGateCrossingsPage] = useState(1);
  const [histogramScope, setHistogramScope] = useState('all');
  const [trendType, setTrendType] = useState(TAB_SUBMISSIONS);
  const [trendResult, setTrendResult] = useState({ key: null, rows: [], loading: false });
  const trendStartDate = filter?.startDate;
  const trendEndDate = filter?.endDate;
  const trendKey = JSON.stringify([trendStartDate, trendEndDate, trendType]);
  const hasTrendRange = Boolean(trendStartDate && trendEndDate);
  const trendLoading = hasTrendRange && (trendResult.key !== trendKey || trendResult.loading);
  const trendRows = hasTrendRange && trendResult.key === trendKey ? trendResult.rows : [];

  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const isMobile = useIsMobile();

  const showApiError = useCallback((err) => {
    const isChinese = String(i18n.language || 'zh').toLowerCase().startsWith('zh');
    const errorMessage = isChinese ? (err?.message || '请求失败') : 'Request failed. Please try again.';
    if (err instanceof ApiError) {
      message.error(`[${err.code}] ${errorMessage}`);
      return;
    }
    message.error(errorMessage);
  }, [i18n]);

  const loadIndicators = useCallback((startDate, endDate) => {
    setLoading(true);
    fetchOverviewIndicators(startDate, endDate)
      .then((indicatorsData) => {
        setPayload((prev) => ({
          ...prev,
          indicators: indicatorsData?.indicators ?? [],
        }));
      })
      .catch((err) => {
        setPayload((prev) => ({ ...prev, indicators: [] }));
        showApiError(err);
      })
      .finally(() => setLoading(false));
  }, [showApiError]);

  const loadHistogram = useCallback(
    (startDate, endDate, scope) => {
      fetchOverviewViewHistogram(startDate, endDate, scope)
        .then((data) => {
          setPayload((prev) => ({ ...prev, viewHistogram: data?.rows ?? [] }));
        })
        .catch((err) => {
          setPayload((prev) => ({ ...prev, viewHistogram: [] }));
          showApiError(err);
        });
    },
    [showApiError],
  );

  const loadGateCrossings = useCallback(
    (startDate, endDate, page) => {
      setGateCrossingsLoading(true);
      fetchOverviewGateCrossings(startDate, endDate, {
        page,
        pageSize: GATE_CROSSINGS_PAGE_SIZE,
      })
        .then((data) => {
          setPayload((prev) => ({
            ...prev,
            gateCrossings: data?.rows ?? [],
            gateCrossingsTotal: data?.total ?? 0,
          }));
        })
        .catch((err) => {
          setPayload((prev) => ({ ...prev, gateCrossings: [], gateCrossingsTotal: 0 }));
          showApiError(err);
        })
        .finally(() => setGateCrossingsLoading(false));
    },
    [showApiError],
  );

  useEffect(() => {
    if (filter?.startDate && filter?.endDate) {
      loadIndicators(filter.startDate, filter.endDate);
    } else {
      setPayload({
        indicators: [],
        viewHistogram: [],
        gateCrossings: [],
        gateCrossingsTotal: 0,
      });
    }
  }, [filter, loadIndicators]);

  useEffect(() => {
    if (!trendStartDate || !trendEndDate) return undefined;
    let cancelled = false;
    setTrendResult({ key: trendKey, rows: [], loading: true });
    const request = trendType === TAB_SUBMISSIONS
      ? fetchOverviewSubmissionTrend(trendStartDate, trendEndDate)
      : fetchOverviewTrend(trendStartDate, trendEndDate, OVERVIEW_TREND_TYPE.VIDEO_STATS);
    request
      .then((data) => {
        if (cancelled) return;
        setTrendResult({ key: trendKey, rows: data?.rows ?? [], loading: false });
      })
      .catch((err) => {
        if (cancelled) return;
        setTrendResult({ key: trendKey, rows: [], loading: false });
        showApiError(err);
      });
    return () => {
      cancelled = true;
    };
  }, [trendStartDate, trendEndDate, trendType, trendKey, showApiError]);

  useEffect(() => {
    if (!filter?.startDate || !filter?.endDate) return;
    loadHistogram(filter.startDate, filter.endDate, histogramScope);
  }, [filter, histogramScope, loadHistogram]);

  useEffect(() => {
    setGateCrossingsPage(1);
  }, [filter]);

  useEffect(() => {
    if (!filter?.startDate || !filter?.endDate) return;
    loadGateCrossings(filter.startDate, filter.endDate, gateCrossingsPage);
  }, [filter, gateCrossingsPage, loadGateCrossings]);

  useEffect(() => {
    if (!isMobile) {
      setFilterDrawerOpen(false);
    }
  }, [isMobile]);

  const handleFilterChange = ({ startDate, endDate }) => {
    setFilter({ startDate, endDate });
    if (isMobile) {
      setFilterDrawerOpen(false);
    }
  };

  const filterBlock = (
    <OverviewFilter
      startDate={filter?.startDate}
      endDate={filter?.endDate}
      onFilterChange={handleFilterChange}
    />
  );

  return (
    <ConfigProvider locale={isZh ? zhCN : enUS}>
      <div className="overview-page">
        <div className="overview-layout">
          {!isMobile && (
            <aside className="overview-sidebar" aria-label={t('筛选条件', 'Filters')}>
              <Card className="overview-panel ds-surface overview-panel--filter" variant="borderless" title={t('筛选条件', 'Filters')}>
                {filterBlock}
              </Card>
            </aside>
          )}

          {isMobile && (
            <>
              <div className="overview-mobile-filter-bar">
                <button
                  type="button"
                  className="ds-button overview-mobile-filter-btn"
                  data-variant="secondary"
                  onClick={() => setFilterDrawerOpen(true)}
                  aria-expanded={filterDrawerOpen}
                  aria-controls="overview-filter-drawer"
                >
                  <FilterOutlined />{t('筛选条件', 'Filters')}
                </button>
              </div>
              <Drawer
                id="overview-filter-drawer"
                title={t('筛选条件', 'Filters')}
                placement="left"
                width={320}
                open={filterDrawerOpen}
                onClose={() => setFilterDrawerOpen(false)}
                destroyOnClose={false}
                className="overview-filter-drawer"
                styles={{ body: { paddingTop: 12 } }}
              >
                {filterBlock}
              </Drawer>
            </>
          )}

          <div className="overview-main-scroll">
            <section className="overview-metrics" aria-label={t('指标数值', 'Metrics')} aria-live="polite" aria-busy={loading}>
              <Spin spinning={loading}>
                {!filter?.startDate || !filter?.endDate ? (
                  <Text type="secondary">{t('请选择日期范围以查看指标。', 'Select a date range to view metrics.')}</Text>
                ) : payload?.indicators?.length ? (
                  <div className="overview-indicator-grid">
                    {payload.indicators.map((row) => (
                      <Card key={row.name} className="overview-panel ds-surface overview-indicator-card" variant="borderless">
                        <IndicatorCell data={row} precision={1} />
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Text type="secondary">{loading ? t('加载指标中…', 'Loading metrics…') : t('暂无数据', 'No data')}</Text>
                )}
              </Spin>
            </section>

            <OverviewTrendChart
              trend={trendRows}
              loading={trendLoading}
              activeTab={trendType}
              onTabChange={setTrendType}
            />

            {/* 分区饼图暂时隐藏，同时停用其请求；组件和 API 保留。 */}

            <OverviewViewHistogramChart
              rows={payload?.viewHistogram ?? []}
              asOfDate={filter?.endDate}
              scope={histogramScope}
              onScopeChange={setHistogramScope}
            />

            <OverviewGateCrossingsTable
              rows={payload?.gateCrossings ?? []}
              total={payload?.gateCrossingsTotal ?? 0}
              page={gateCrossingsPage}
              pageSize={GATE_CROSSINGS_PAGE_SIZE}
              loading={gateCrossingsLoading}
              onPageChange={setGateCrossingsPage}
            />
          </div>
        </div>
      </div>
    </ConfigProvider>
  );
}
