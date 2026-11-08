import { getLanguageSettings } from '../../../locales/languages.js';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Table } from 'antd';
import { SwapOutlined } from '@ant-design/icons';
import { DsPagination } from '../../../components/design-system/DataDisplay.jsx';
import VideoInfo from '../../../components/custom/VideoInfo/VideoInfo.jsx';
import RelativeTime from '../../../components/custom/RelativeTime/RelativeTime.jsx';
import { getTranslator } from '../../../i18n.js';
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

function buildColumns(language, isMobile) {
  const t = getTranslator(language);
  const locale = getLanguageSettings(language).lang;
  return [
    {
      title: t("视频"),
      dataIndex: 'aid',
      key: 'aid',
      width: isMobile ? 160 : undefined,
      fixed: isMobile ? 'left' : undefined,
      render: (value) => <div className="overview-gate-crossings-video"><VideoInfo aid={value} /></div>,
    },
    {
      title: t("过线值"),
      dataIndex: 'gateValue',
      key: 'gateValue',
      width: isMobile ? 112 : undefined,
      className: 'overview-gate-crossings-value-cell',
      align: 'right',
      render: (value) => <span className="ds-chip overview-gate-crossings-gate" data-variant="neutral">{formatNumber(value, locale)}</span>,
    },
    {
      title: t("上次播放"),
      dataIndex: 'previousView',
      key: 'previousView',
      width: isMobile ? 128 : undefined,
      className: 'overview-gate-crossings-value-cell',
      align: 'right',
      render: (value) => formatNumber(value, locale),
    },
    {
      title: t("当前播放"),
      dataIndex: 'currentView',
      key: 'currentView',
      width: isMobile ? 128 : undefined,
      className: 'overview-gate-crossings-value-cell',
      align: 'right',
      render: (value) => formatNumber(value, locale),
    },
    {
      title: t("增量"),
      key: 'delta',
      width: isMobile ? 104 : undefined,
      className: 'overview-gate-crossings-value-cell',
      align: 'right',
      render: (_, row) => formatDelta(row, locale),
    },
    {
      title: t("过线时间"),
      dataIndex: 'crossedAt',
      key: 'crossedAt',
      width: isMobile ? 168 : undefined,
      className: 'overview-gate-crossings-value-cell',
      render: (value) => <RelativeTime value={value} />,
    },
  ];
}

export default function OverviewGateCrossingsTable({
  isMobile = false,
  rows,
  total,
  page,
  pageSize,
  loading,
  onPageChange,
}) {
  const { i18n, t } = useTranslation();
  const language = i18n.resolvedLanguage || i18n.language;

  const columns = useMemo(() => buildColumns(language, isMobile), [language, isMobile]);
  const scroll = isMobile ? { x: columns.reduce((width, column) => width + column.width, 0) } : undefined;

  return (
    <Card className="overview-panel ds-surface overview-section-card overview-panel--gate-crossings" variant="borderless" title={t("播放过线记录")}>
      <div className={`overview-gate-crossings${isMobile ? ' overview-gate-crossings--mobile' : ''}`}>
        {isMobile && (
          <p className="overview-gate-crossings-scroll-hint">
            <SwapOutlined aria-hidden="true" />{t('左右滑动查看，视频列固定')}
          </p>
        )}
        <Table
          className="overview-gate-crossings-table"
          columns={columns}
          dataSource={rows}
          loading={loading}
          pagination={false}
          rowKey={(row) => row.id ?? `${row.aid}-${row.gateValue}-${row.crossedAt}`}
          size="small"
          scroll={scroll}
          tableLayout={isMobile ? 'fixed' : 'auto'}
          locale={{ emptyText: t("暂无过线记录") }}
        />
        <div className="overview-gate-crossings-footer">
          <DsPagination
            current={page}
            pageSize={pageSize}
            total={total}
            disabled={loading}
            onChange={onPageChange}
            label={t("播放过线记录分页")}
          />
        </div>
      </div>
    </Card>
  );
}
