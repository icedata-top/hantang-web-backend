import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Table } from 'antd';
import { DsPagination } from '../../../components/design-system/DataDisplay.jsx';
import VideoInfo from '../../../components/custom/VideoInfo/VideoInfo.jsx';
import RelativeTime from '../../../components/custom/RelativeTime/RelativeTime.jsx';
import './OverviewGateCrossingsTable.css';

function formatNumber(value, locale) {
  if (value == null || Number.isNaN(Number(value))) {
    return '-';
  }
  return Number(value).toLocaleString(locale);
}

function formatDelta(row, locale) {
  if (row.previousView == null || row.currentView == null) {
    return '-';
  }
  return formatNumber(Number(row.currentView) - Number(row.previousView), locale);
}

function buildColumns(isZh) {
  const locale = isZh ? 'zh-CN' : 'en-US';
  return [
    {
      title: isZh ? '视频' : 'Video',
      dataIndex: 'aid',
      key: 'aid',
      render: (value) => <div className="overview-gate-crossings-video"><VideoInfo aid={value} /></div>,
    },
    {
      title: isZh ? '过线值' : 'Milestone',
      dataIndex: 'gateValue',
      key: 'gateValue',
      className: 'overview-gate-crossings-value-cell',
      align: 'right',
      render: (value) => <span className="ds-chip overview-gate-crossings-gate" data-variant="neutral">{formatNumber(value, locale)}</span>,
    },
    {
      title: isZh ? '上次播放' : 'Previous Views',
      dataIndex: 'previousView',
      key: 'previousView',
      className: 'overview-gate-crossings-value-cell',
      align: 'right',
      render: (value) => formatNumber(value, locale),
    },
    {
      title: isZh ? '当前播放' : 'Current Views',
      dataIndex: 'currentView',
      key: 'currentView',
      className: 'overview-gate-crossings-value-cell',
      align: 'right',
      render: (value) => formatNumber(value, locale),
    },
    {
      title: isZh ? '增量' : 'Increase',
      key: 'delta',
      className: 'overview-gate-crossings-value-cell',
      align: 'right',
      render: (_, row) => formatDelta(row, locale),
    },
    {
      title: isZh ? '过线时间' : 'Reached At',
      dataIndex: 'crossedAt',
      key: 'crossedAt',
      className: 'overview-gate-crossings-value-cell',
      render: (value) => <RelativeTime value={value} />,
    },
  ];
}

export default function OverviewGateCrossingsTable({
  rows,
  total,
  page,
  pageSize,
  loading,
  onPageChange,
}) {
  const { i18n } = useTranslation();
  const isZh = String(i18n?.language || 'zh').toLowerCase().startsWith('zh');
  const t = (zh, en) => (isZh ? zh : en);
  const columns = useMemo(() => buildColumns(isZh), [isZh]);

  return (
    <Card className="overview-panel ds-surface overview-section-card overview-panel--gate-crossings" variant="borderless" title={t('播放过线记录', 'View Milestones')}>
      <div className="overview-gate-crossings">
        <Table
          className="overview-gate-crossings-table"
          columns={columns}
          dataSource={rows}
          loading={loading}
          pagination={false}
          rowKey={(row) => row.id ?? `${row.aid}-${row.gateValue}-${row.crossedAt}`}
          size="small"
          tableLayout="auto"
          locale={{ emptyText: t('暂无过线记录', 'No view milestones') }}
        />
        <div className="overview-gate-crossings-footer">
          <DsPagination
            current={page}
            pageSize={pageSize}
            total={total}
            disabled={loading}
            onChange={onPageChange}
            label={t('播放过线记录分页', 'View milestones pagination')}
          />
        </div>
      </div>
    </Card>
  );
}
