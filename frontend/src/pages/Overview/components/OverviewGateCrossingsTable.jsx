import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Pagination, Table, Tag, Typography } from 'antd';
import './OverviewGateCrossingsTable.css';

const { Text } = Typography;

function formatNumber(value, locale) {
  if (value == null || Number.isNaN(Number(value))) {
    return '-';
  }
  return Number(value).toLocaleString(locale);
}

function formatDateTime(value, locale) {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
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
      title: 'AID',
      dataIndex: 'aid',
      key: 'aid',
      width: 150,
      render: (value) => <Text className="overview-gate-crossings-aid">{value}</Text>,
    },
    {
      title: isZh ? '过线值' : 'Milestone',
      dataIndex: 'gateValue',
      key: 'gateValue',
      width: 120,
      render: (value) => <Tag className="overview-gate-crossings-gate">{formatNumber(value, locale)}</Tag>,
    },
    {
      title: isZh ? '上次播放' : 'Previous Views',
      dataIndex: 'previousView',
      key: 'previousView',
      width: 120,
      align: 'right',
      render: (value) => formatNumber(value, locale),
    },
    {
      title: isZh ? '当前播放' : 'Current Views',
      dataIndex: 'currentView',
      key: 'currentView',
      width: 120,
      align: 'right',
      render: (value) => formatNumber(value, locale),
    },
    {
      title: isZh ? '增量' : 'Increase',
      key: 'delta',
      width: 96,
      align: 'right',
      render: (_, row) => formatDelta(row, locale),
    },
    {
      title: isZh ? '过线时间' : 'Reached At',
      dataIndex: 'crossedAt',
      key: 'crossedAt',
      width: 142,
      render: (value) => formatDateTime(value, locale),
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
  const locale = isZh ? 'zh-CN' : 'en-US';
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
          scroll={{ x: 760 }}
          locale={{ emptyText: t('暂无过线记录', 'No view milestones') }}
        />
        <div className="overview-gate-crossings-footer">
          <Text type="secondary" className="overview-gate-crossings-total">
            {isZh ? `共 ${formatNumber(total, locale)} 条` : `${formatNumber(total, locale)} ${Number(total) === 1 ? 'record' : 'records'}`}
          </Text>
          <Pagination
            size="small"
            current={page}
            pageSize={pageSize}
            total={total}
            showSizeChanger={false}
            onChange={onPageChange}
          />
        </div>
      </div>
    </Card>
  );
}
