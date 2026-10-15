import { Card, Pagination, Table, Tag, Typography } from 'antd';
import './OverviewGateCrossingsTable.css';

const { Text } = Typography;

function formatNumber(value) {
  if (value == null || Number.isNaN(Number(value))) {
    return '-';
  }
  return Number(value).toLocaleString('zh-CN');
}

function formatDateTime(value) {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDelta(row) {
  if (row.previousView == null || row.currentView == null) {
    return '-';
  }
  return formatNumber(Number(row.currentView) - Number(row.previousView));
}

const columns = [
  {
    title: 'AID',
    dataIndex: 'aid',
    key: 'aid',
    width: 150,
    render: (value) => <Text className="overview-gate-crossings-aid">{value}</Text>,
  },
  {
    title: '过线值',
    dataIndex: 'gateValue',
    key: 'gateValue',
    width: 120,
    render: (value) => <Tag className="overview-gate-crossings-gate">{formatNumber(value)}</Tag>,
  },
  {
    title: '上次播放',
    dataIndex: 'previousView',
    key: 'previousView',
    width: 120,
    align: 'right',
    render: formatNumber,
  },
  {
    title: '当前播放',
    dataIndex: 'currentView',
    key: 'currentView',
    width: 120,
    align: 'right',
    render: formatNumber,
  },
  {
    title: '增量',
    key: 'delta',
    width: 96,
    align: 'right',
    render: (_, row) => formatDelta(row),
  },
  {
    title: '过线时间',
    dataIndex: 'crossedAt',
    key: 'crossedAt',
    width: 142,
    render: formatDateTime,
  },
];

export default function OverviewGateCrossingsTable({
  rows,
  total,
  page,
  pageSize,
  loading,
  onPageChange,
}) {
  return (
    <Card className="overview-panel overview-panel--gate-crossings" bordered={false} title="播放过线记录">
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
          locale={{ emptyText: '暂无过线记录' }}
        />
        <div className="overview-gate-crossings-footer">
          <Text type="secondary" className="overview-gate-crossings-total">
            共 {formatNumber(total)} 条
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
