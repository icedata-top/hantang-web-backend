import { useCallback, useEffect, useState } from 'react';
import { FilterOutlined } from '@ant-design/icons';
import { Button, Card, Drawer, Spin, Typography, message } from 'antd';
import OverviewFilter, { getDefaultOverviewFilter } from './components/OverviewFilter.jsx';
import OverviewTrendChart from './components/OverviewTrendChart.jsx';
import OverviewPartitionPieChart from './components/OverviewPartitionPieChart.jsx';
import OverviewViewHistogramChart from './components/OverviewViewHistogramChart.jsx';
import OverviewGateCrossingsTable from './components/OverviewGateCrossingsTable.jsx';
import IndicatorCell from './components/IndicatorCell.jsx';
import { ApiError } from '../../services/http/client.js';
import {
  fetchOverviewGateCrossings,
  fetchOverviewIndicators,
  fetchOverviewPartitionSubmissions,
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
  const [filter, setFilter] = useState(() => getDefaultOverviewFilter());
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState({
    indicators: [],
    trend: [],
    partitionSubmissions: [],
    viewHistogram: [],
    gateCrossings: [],
    gateCrossingsTotal: 0,
  });
  const [gateCrossingsLoading, setGateCrossingsLoading] = useState(false);
  const [gateCrossingsPage, setGateCrossingsPage] = useState(1);
  const [partitionScope, setPartitionScope] = useState('all');
  const [histogramScope, setHistogramScope] = useState('all');
  const [trendType, setTrendType] = useState(OVERVIEW_TREND_TYPE.NEW_VIDEO);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const isMobile = useIsMobile();

  const showApiError = useCallback((err) => {
    if (err instanceof ApiError) {
      message.error(`[${err.code}] ${err.message}`);
      return;
    }
    message.error(err?.message || '请求失败');
  }, []);

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

  const loadTrend = useCallback(
    (startDate, endDate, type) => {
      fetchOverviewTrend(startDate, endDate, type)
        .then((trendData) => {
          setPayload((prev) => ({
            ...prev,
            trend: trendData?.rows ?? [],
          }));
        })
        .catch((err) => {
          setPayload((prev) => ({ ...prev, trend: [] }));
          showApiError(err);
        });
    },
    [showApiError],
  );

  const loadPartition = useCallback(
    (startDate, endDate, scope) => {
      fetchOverviewPartitionSubmissions(startDate, endDate, scope)
        .then((data) => {
          setPayload((prev) => ({ ...prev, partitionSubmissions: data?.rows ?? [] }));
        })
        .catch((err) => {
          setPayload((prev) => ({ ...prev, partitionSubmissions: [] }));
          showApiError(err);
        });
    },
    [showApiError],
  );

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
        trend: [],
        partitionSubmissions: [],
        viewHistogram: [],
        gateCrossings: [],
        gateCrossingsTotal: 0,
      });
    }
  }, [filter, loadIndicators]);

  useEffect(() => {
    if (!filter?.startDate || !filter?.endDate) return;
    loadTrend(filter.startDate, filter.endDate, trendType);
  }, [filter, trendType, loadTrend]);

  useEffect(() => {
    if (!filter?.startDate || !filter?.endDate) return;
    loadPartition(filter.startDate, filter.endDate, partitionScope);
  }, [filter, partitionScope, loadPartition]);

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
    <div className="overview-page">
      <div className="overview-layout">
        {!isMobile && (
          <aside className="overview-sidebar" aria-label="筛选条件">
            <Card className="overview-panel overview-panel--filter" bordered={false} title="筛选条件">
              {filterBlock}
            </Card>
          </aside>
        )}

        {isMobile && (
          <>
            <div className="overview-mobile-filter-bar">
              <Button
                type="default"
                className="overview-mobile-filter-btn"
                icon={<FilterOutlined />}
                onClick={() => setFilterDrawerOpen(true)}
                aria-expanded={filterDrawerOpen}
                aria-controls="overview-filter-drawer"
              >
                筛选条件
              </Button>
            </div>
            <Drawer
              id="overview-filter-drawer"
              title="筛选条件"
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
          <Card className="overview-panel overview-panel--metrics" bordered={false} title="指标数值">
            <section className="overview-metrics" aria-live="polite">
              <Spin spinning={loading}>
                {!filter?.startDate || !filter?.endDate ? (
                  <Text type="secondary">请选择日期范围以查看指标。</Text>
                ) : payload?.indicators?.length ? (
                  <div className="overview-meta">
                    <div className="overview-indicator-grid">
                      {payload.indicators.map((row) => (
                        <div key={row.name} className="overview-indicator-item">
                          <IndicatorCell data={row} precision={1} />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Text type="secondary">暂无数据</Text>
                )}
              </Spin>
            </section>
          </Card>

          <OverviewTrendChart
            trend={payload?.trend ?? []}
            activeTab={trendType}
            onTabChange={setTrendType}
          />

          <OverviewPartitionPieChart
            rows={payload?.partitionSubmissions ?? []}
            scope={partitionScope}
            onScopeChange={setPartitionScope}
          />

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
  );
}
